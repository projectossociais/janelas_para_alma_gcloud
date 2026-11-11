import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Coins, Crown, Loader2, RefreshCw, Trophy, Users, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TemporizadorCircular from "@/components/jogo/TemporizadorCircular";
import { useProfile } from "@/contexts/ProfileContext";
import { useCarteiraJogo } from "@/contexts/CarteiraJogoContext";
import {
  jogoLocalApi,
  type PartidaLocalTerminadaJogo,
  type PerguntaJogoPublica,
  type RespostaLocalJogo,
  type RespostaOpcaoJogo,
} from "@/lib/apiClient";
import {
  MAXIMO_JOGADORES,
  PONTOS_POR_ACERTO,
  RONDAS,
  TAMANHO_MAXIMO_NOME,
  TEMPO_POR_PERGUNTA_LOCAL,
  classificacao,
  criarPartidaLocal,
  indiceDaVez,
  normalizarNomes,
  patamarActual,
  pontosDaResposta,
  registarResposta,
  type EstadoPartidaLocal,
} from "@/lib/jogo/partidaLocal";
import { cn } from "@/lib/utils";
import { localizar } from "@/i18n/rotas";
import { useIdioma } from "@/i18n/useIdioma";
import { IDIOMA_EN } from "@/i18n/idiomas";
import { OPCOES } from "./jogoConfig";
import { criarFonteReservaLocal, criarFonteServidor, type FontePerguntasLocal } from "./fontePerguntasLocal";

type Fase = "configuracao" | "passar" | "pergunta" | "final";

interface RespostaDada {
  opcao: RespostaOpcaoJogo | null;
  tempoRestante: number;
}

type EstadoPremio =
  | { estado: "sem_premio" }
  | { estado: "a_guardar" }
  | { estado: "guardado"; resultado: PartidaLocalTerminadaJogo }
  | { estado: "erro" };

// Só para mostrar as regras antes de começar -- espelha
// `api/app/services/jogo_local_service.py`. Quem decide o que se credita é
// sempre o servidor, ao terminar a partida.
const PREMIO_LOCAL = { moedasPorAcerto: 10, maximoPorPartida: 100, limiteDiario: 400 };

// Uma cor por jogador, sempre a mesma durante a partida.
const CORES_JOGADOR = ["bg-teal text-teal-foreground", "bg-gold text-navy"];

const textoDaOpcao = (pergunta: PerguntaJogoPublica, opcao: RespostaOpcaoJogo) =>
  ({ A: pergunta.opcao_a, B: pergunta.opcao_b, C: pergunta.opcao_c, D: pergunta.opcao_d })[opcao];

/**
 * Multijogador Local -- 2 pessoas à vez no mesmo aparelho. As regras dos
 * turnos e dos empates são de `lib/jogo/partidaLocal.ts`; os nomes e os pontos
 * ficam só em memória (nunca se gravam nem se enviam).
 *
 * Com sessão (site português), as perguntas e a validação são do servidor e a
 * partida paga moedas à conta do aparelho. Sem sessão, no site inglês, ou se
 * o servidor não responder ao abrir a partida, joga-se com a reserva local,
 * sem prémio -- e o ecrã diz isso antes de começar a jogar.
 */
const JogoLocal = () => {
  const { t } = useTranslation();
  const { profile, loading: aCarregarPerfil } = useProfile();
  const { definirPerfil } = useCarteiraJogo();
  const emIngles = useIdioma() === IDIOMA_EN;
  const usaServidor = !!profile?.id && !emIngles;

  const [fase, setFase] = useState<Fase>("configuracao");
  const [nomes, setNomes] = useState<string[]>(() => Array(MAXIMO_JOGADORES).fill(""));
  const [aPreparar, setAPreparar] = useState(false);
  const [semPremioPorFalha, setSemPremioPorFalha] = useState(false);
  const [partida, setPartida] = useState<EstadoPartidaLocal | null>(null);
  const fonte = useRef<FontePerguntasLocal | null>(null);

  const [pergunta, setPergunta] = useState<PerguntaJogoPublica | null>(null);
  const [erroPergunta, setErroPergunta] = useState(false);
  const [tempoRestante, setTempoRestante] = useState(TEMPO_POR_PERGUNTA_LOCAL);
  const [respostaDada, setRespostaDada] = useState<RespostaDada | null>(null);
  const [aValidar, setAValidar] = useState(false);
  const [erroValidar, setErroValidar] = useState(false);
  const [resultado, setResultado] = useState<RespostaLocalJogo | null>(null);
  const [premio, setPremio] = useState<EstadoPremio>({ estado: "sem_premio" });
  // Uma resposta por pergunta: o toque e o fim do tempo podem chegar juntos.
  const respondida = useRef(false);

  const definirNome = (indice: number, valor: string) =>
    setNomes((actuais) => actuais.map((nome, i) => (i === indice ? valor : nome)));

  const comecar = async () => {
    if (aPreparar) return;
    const limpos = normalizarNomes(nomes, (numero) => t("JogoLocal.jogadorN", { numero }));
    setAPreparar(true);
    setSemPremioPorFalha(false);
    fonte.current = criarFonteReservaLocal();
    if (usaServidor) {
      try {
        const aberta = await jogoLocalApi.iniciar(limpos.length);
        fonte.current = criarFonteServidor(aberta.id);
      } catch (err) {
        // Sem servidor joga-se na mesma, com a reserva local -- mas sem
        // prémio, e dito no ecrã antes da primeira pergunta.
        console.error("Falha ao abrir a partida local no servidor, a jogar sem prémio:", err);
        setSemPremioPorFalha(true);
      }
    }
    setNomes(limpos);
    setPartida(criarPartidaLocal(limpos));
    setPremio({ estado: "sem_premio" });
    setAPreparar(false);
    setFase("passar");
  };

  const carregarPergunta = useCallback(async (estado: EstadoPartidaLocal) => {
    if (!fonte.current) return;
    setPergunta(null);
    setErroPergunta(false);
    setResultado(null);
    setRespostaDada(null);
    setErroValidar(false);
    respondida.current = false;
    setTempoRestante(TEMPO_POR_PERGUNTA_LOCAL);
    try {
      setPergunta(await fonte.current.obterPergunta(patamarActual(estado)));
    } catch (err) {
      console.error("Falha ao carregar a pergunta da partida local:", err);
      setErroPergunta(true);
    }
  }, []);

  const estouPronto = () => {
    if (!partida) return;
    setFase("pergunta");
    void carregarPergunta(partida);
  };

  const validar = useCallback(
    async (dada: RespostaDada) => {
      if (!fonte.current || !pergunta) return;
      setRespostaDada(dada);
      setAValidar(true);
      setErroValidar(false);
      try {
        setResultado(await fonte.current.responder(pergunta.id, dada.opcao));
      } catch (err) {
        console.error("Falha ao validar a resposta da partida local:", err);
        setErroValidar(true);
      } finally {
        setAValidar(false);
      }
    },
    [pergunta]
  );

  const responder = useCallback(
    (opcao: RespostaOpcaoJogo | null, tempo: number) => {
      if (respondida.current) return;
      respondida.current = true;
      void validar({ opcao, tempoRestante: tempo });
    },
    [validar]
  );

  // Relógio da pergunta: só conta com a pergunta no ecrã e ainda sem resposta.
  useEffect(() => {
    if (fase !== "pergunta" || !pergunta || respostaDada) return;
    if (tempoRestante <= 0) {
      responder(null, 0);
      return;
    }
    const temporizador = window.setTimeout(() => setTempoRestante((s) => s - 1), 1000);
    return () => window.clearTimeout(temporizador);
  }, [fase, pergunta, respostaDada, tempoRestante, responder]);

  const guardarPremio = useCallback(async () => {
    if (!fonte.current?.comPremio) return;
    setPremio({ estado: "a_guardar" });
    try {
      const terminada = await fonte.current.terminar();
      if (!terminada) {
        setPremio({ estado: "sem_premio" });
        return;
      }
      definirPerfil(terminada.perfil);
      setPremio({ estado: "guardado", resultado: terminada });
    } catch (err) {
      // Nunca se mostra o prémio como ganho a partir de um erro.
      console.error("Falha ao guardar o prémio da partida local:", err);
      setPremio({ estado: "erro" });
    }
  }, [definirPerfil]);

  const continuar = () => {
    if (!partida || !resultado || !respostaDada) return;
    const seguinte = registarResposta(partida, resultado.correta, respostaDada.tempoRestante);
    setPartida(seguinte);
    setPergunta(null);
    setResultado(null);
    setRespostaDada(null);
    if (seguinte.terminada) {
      setFase("final");
      void guardarPremio();
    } else {
      setFase("passar");
    }
  };

  const jogarOutraVez = () => {
    setPartida(null);
    setFase("configuracao");
  };

  const quem = partida && !partida.terminada ? indiceDaVez(partida) : null;
  const jogadorDaVez = partida && quem !== null ? partida.jogadores[quem] : null;
  const rotuloDaRonda = partida
    ? partida.desempate > 0
      ? t("JogoLocal.desempate", { numero: partida.desempate })
      : t("JogoLocal.rondaDe", { ronda: partida.ronda, rondas: RONDAS })
    : "";

  const placar = partida && (
    <ol className="space-y-2" aria-label={t("JogoLocal.pontuacao")}>
      {classificacao(partida).map(({ indice, jogador }, posicao) => (
        <li
          key={indice}
          className={cn(
            "flex items-center gap-3 rounded-xl border px-3 py-2",
            partida.terminada && partida.vencedores.includes(indice)
              ? "border-gold bg-gold/10"
              : "border-border/60 bg-background"
          )}
        >
          <span className="w-5 text-sm font-bold text-muted-foreground">{posicao + 1}</span>
          <span
            className={cn(
              "w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold",
              CORES_JOGADOR[indice]
            )}
            aria-hidden="true"
          >
            {jogador.nome[0]?.toUpperCase()}
          </span>
          <span className="flex-1 min-w-0 truncate font-semibold text-foreground">{jogador.nome}</span>
          {partida.terminada && partida.vencedores.includes(indice) && <Crown className="w-4 h-4 text-gold" />}
          <span className="text-sm text-muted-foreground">{t("JogoLocal.acertosDe", { acertos: jogador.acertos })}</span>
          <span className="font-bold text-foreground tabular-nums">{jogador.pontos}</span>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <BackButton fallbackPath={localizar("/jogo-curiosidades")} label={t("JogoLocal.voltarAoMenu")} />

      <main className="flex-1">
        <div className="container pb-16">
          <header className="max-w-2xl mx-auto text-center space-y-3 mb-8">
            <span className="text-sm font-medium tracking-widest uppercase text-teal">{t("JogoLocal.inclusivamente")}</span>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">{t("JogoLocal.titulo")}</h1>
            {fase === "configuracao" && <p className="text-muted-foreground">{t("JogoLocal.descricao")}</p>}
          </header>

          <div className="max-w-xl mx-auto">
            {fase === "configuracao" && (
              <div className="rounded-2xl bg-card border border-border/60 shadow-card p-6 sm:p-8 space-y-6">
                <div className="space-y-3">
                  <h2 className="font-bold text-foreground flex items-center gap-2">
                    <Users className="w-5 h-5 text-teal" />
                    {t("JogoLocal.quemJoga")}
                  </h2>
                  {nomes.map((nome, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span
                        className={cn(
                          "w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-sm font-bold",
                          CORES_JOGADOR[i]
                        )}
                        aria-hidden="true"
                      >
                        {i + 1}
                      </span>
                      <Input
                        value={nome}
                        onChange={(e) => definirNome(i, e.target.value)}
                        maxLength={TAMANHO_MAXIMO_NOME}
                        placeholder={t("JogoLocal.jogadorN", { numero: i + 1 })}
                        aria-label={t("JogoLocal.nomeDoJogador", { numero: i + 1 })}
                        autoComplete="off"
                      />
                    </div>
                  ))}
                </div>

                <div className="rounded-xl bg-muted/50 p-4 space-y-2 text-sm text-muted-foreground">
                  <p className="font-bold text-foreground">{t("JogoLocal.comoSeJoga")}</p>
                  <p>{t("JogoLocal.regra1", { rondas: RONDAS })}</p>
                  <p>{t("JogoLocal.regra2", { pontos: PONTOS_POR_ACERTO, segundos: TEMPO_POR_PERGUNTA_LOCAL })}</p>
                  <p>{t("JogoLocal.regra3")}</p>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm">
                  <Coins className="w-5 h-5 shrink-0 text-gold mt-0.5" />
                  <div className="space-y-1 text-foreground">
                    {usaServidor ? (
                      <p>
                        {t("JogoLocal.premioComSessao", {
                          moedas: PREMIO_LOCAL.moedasPorAcerto,
                          maximo: PREMIO_LOCAL.maximoPorPartida,
                          diario: PREMIO_LOCAL.limiteDiario,
                        })}
                      </p>
                    ) : emIngles ? (
                      <p>{t("JogoLocal.premioSoEmPortugues")}</p>
                    ) : (
                      <>
                        <p>{t("JogoLocal.premioSemSessao")}</p>
                        <Link to={localizar("/auth")} className="text-teal hover:underline">
                          {t("JogoLocal.iniciarSessao")}
                        </Link>
                      </>
                    )}
                  </div>
                </div>

                <Button
                  onClick={() => void comecar()}
                  disabled={aPreparar || aCarregarPerfil}
                  className="w-full bg-teal text-teal-foreground hover:bg-teal/90"
                >
                  {aPreparar && <Loader2 className="w-4 h-4 animate-spin" />}
                  {aPreparar ? t("JogoLocal.aPreparar") : t("JogoLocal.comecar")}
                </Button>
              </div>
            )}

            {fase === "passar" && partida && jogadorDaVez && quem !== null && (
              <div className="rounded-2xl bg-card border border-border/60 shadow-card p-6 sm:p-8 space-y-6 text-center">
                {semPremioPorFalha && (
                  <p role="alert" className="rounded-xl bg-muted text-sm text-muted-foreground p-3">
                    {t("JogoLocal.semLigacaoSemPremio")}
                  </p>
                )}
                <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground">{rotuloDaRonda}</p>
                <div
                  className={cn(
                    "w-20 h-20 mx-auto rounded-full flex items-center justify-center text-3xl font-bold",
                    CORES_JOGADOR[quem]
                  )}
                  aria-hidden="true"
                >
                  {jogadorDaVez.nome[0]?.toUpperCase()}
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold text-foreground">{t("JogoLocal.vezDe", { nome: jogadorDaVez.nome })}</h2>
                  <p className="text-muted-foreground">{t("JogoLocal.passaOAparelho", { nome: jogadorDaVez.nome })}</p>
                  {partida.desempate > 0 && <p className="text-sm text-gold font-medium">{t("JogoLocal.empatados")}</p>}
                </div>
                <Button onClick={estouPronto} className="w-full bg-teal text-teal-foreground hover:bg-teal/90">
                  {t("JogoLocal.estouPronto")}
                </Button>
                <div className="text-left border-t border-border/50 pt-5">{placar}</div>
              </div>
            )}

            {fase === "pergunta" && partida && jogadorDaVez && (
              <div className="rounded-2xl bg-card border border-border/60 shadow-card p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground">{rotuloDaRonda}</p>
                    <p className="text-xl font-bold text-foreground">{jogadorDaVez.nome}</p>
                  </div>
                  {pergunta && <TemporizadorCircular tempoRestante={tempoRestante} tempoTotal={TEMPO_POR_PERGUNTA_LOCAL} />}
                </div>

                {!pergunta && !erroPergunta && (
                  <p className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t("JogoLocal.aCarregarPergunta")}
                  </p>
                )}

                {erroPergunta && (
                  <div className="text-center space-y-4 py-4">
                    <p role="alert" className="text-muted-foreground">
                      {t("JogoLocal.naoFoiPossivelCarregar")}
                    </p>
                    <Button variant="outline" onClick={() => void carregarPergunta(partida)}>
                      <RefreshCw className="w-4 h-4" />
                      {t("JogoLocal.tentarNovamente")}
                    </Button>
                  </div>
                )}

                {pergunta && (
                  <>
                    <p className="text-lg md:text-xl font-semibold text-foreground leading-relaxed">
                      {pergunta.texto_pergunta}
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                      {OPCOES.map((opcao) => {
                        const escolhida = respostaDada?.opcao === opcao;
                        const certa = resultado?.resposta_correta === opcao;
                        const errada = !!resultado && escolhida && !resultado.correta;
                        return (
                          <button
                            key={opcao}
                            type="button"
                            disabled={!!respostaDada}
                            onClick={() => responder(opcao, tempoRestante)}
                            className={cn(
                              "flex items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-all duration-300",
                              "disabled:cursor-not-allowed",
                              !respostaDada && "border-border bg-background hover:border-teal hover:bg-teal/5",
                              !!respostaDada && !certa && !errada && "border-border bg-background",
                              escolhida && !resultado && "border-teal bg-teal/5",
                              certa && "border-green bg-green/10",
                              errada && "border-destructive bg-destructive/10"
                            )}
                          >
                            <span
                              className={cn(
                                "flex items-center justify-center w-8 h-8 shrink-0 rounded-full border-2 font-bold text-sm",
                                certa && "border-green bg-green text-green-foreground",
                                errada && "border-destructive bg-destructive text-destructive-foreground",
                                !certa && !errada && "border-teal text-teal"
                              )}
                            >
                              {certa ? <Check className="w-4 h-4" /> : errada ? <X className="w-4 h-4" /> : opcao}
                            </span>
                            <span className="text-sm sm:text-base text-foreground flex-1">
                              {textoDaOpcao(pergunta, opcao)}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {aValidar && (
                      <p className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </p>
                    )}

                    {erroValidar && respostaDada && (
                      <div className="text-center space-y-3">
                        <p role="alert" className="text-muted-foreground">
                          {t("JogoLocal.naoFoiPossivelValidar")}
                        </p>
                        <Button variant="outline" onClick={() => void validar(respostaDada)}>
                          <RefreshCw className="w-4 h-4" />
                          {t("JogoLocal.tentarNovamente")}
                        </Button>
                      </div>
                    )}

                    {resultado && respostaDada && (
                      <div className="space-y-4 border-t border-border/50 pt-5">
                        <p
                          role="status"
                          className={cn("text-lg font-bold", resultado.correta ? "text-green" : "text-destructive")}
                        >
                          {resultado.correta
                            ? t("JogoLocal.certo", { pontos: pontosDaResposta(true, respostaDada.tempoRestante) })
                            : respostaDada.opcao === null
                              ? t("JogoLocal.tempoEsgotado")
                              : t("JogoLocal.errado")}
                        </p>
                        {resultado.explicacao && <p className="text-sm text-muted-foreground">{resultado.explicacao}</p>}
                        <Button onClick={continuar} className="w-full bg-teal text-teal-foreground hover:bg-teal/90">
                          {t("JogoLocal.continuar")}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {fase === "final" && partida && (
              <div className="rounded-2xl bg-card border border-border/60 shadow-card p-6 sm:p-8 space-y-6 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-gold/15 text-gold flex items-center justify-center">
                  <Trophy className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
                    {t("JogoLocal.fimDaPartida")}
                  </p>
                  <h2 className="text-2xl font-bold text-foreground">
                    {partida.vencedores.length === 1
                      ? t("JogoLocal.vencedor", { nome: partida.jogadores[partida.vencedores[0]].nome })
                      : t("JogoLocal.vitoriaPartilhada", {
                          nomes: partida.vencedores.map((i) => partida.jogadores[i].nome).join(", "),
                        })}
                  </h2>
                </div>

                <div className="text-left">{placar}</div>

                {premio.estado === "a_guardar" && (
                  <p className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("JogoLocal.aGuardarPremio")}
                  </p>
                )}
                {premio.estado === "guardado" && (
                  <p role="status" className="rounded-xl border border-gold/40 bg-gold/10 p-4 font-semibold text-foreground">
                    {premio.resultado.moedas_ganhas > 0
                      ? t(
                          premio.resultado.limite_diario_atingido
                            ? "JogoLocal.premioGanhoNoLimite"
                            : "JogoLocal.premioGanho",
                          { moedas: premio.resultado.moedas_ganhas }
                        )
                      : premio.resultado.limite_diario_atingido
                        ? t("JogoLocal.premioLimiteDiario")
                        : t("JogoLocal.premioZero")}
                  </p>
                )}
                {premio.estado === "erro" && (
                  <div className="space-y-3">
                    <p role="alert" className="text-muted-foreground">
                      {t("JogoLocal.naoFoiPossivelGuardarPremio")}
                    </p>
                    <Button variant="outline" onClick={() => void guardarPremio()}>
                      <RefreshCw className="w-4 h-4" />
                      {t("JogoLocal.tentarNovamente")}
                    </Button>
                  </div>
                )}
                {premio.estado === "sem_premio" && (
                  <p className="text-sm text-muted-foreground">
                    {semPremioPorFalha
                      ? t("JogoLocal.semLigacaoSemPremio")
                      : emIngles
                        ? t("JogoLocal.premioSoEmPortugues")
                        : t("JogoLocal.premioSemSessao")}
                  </p>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button onClick={jogarOutraVez} className="flex-1 bg-teal text-teal-foreground hover:bg-teal/90">
                    {t("JogoLocal.jogarOutraVez")}
                  </Button>
                  <Button asChild variant="outline" className="flex-1">
                    <Link to={localizar("/jogo-curiosidades")}>{t("JogoLocal.voltarAoMenu")}</Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default JogoLocal;
