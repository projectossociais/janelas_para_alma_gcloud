import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, Coins, Copy, Crown, Flag, Loader2, MessageCircle, Send, Share2, Trophy, WifiOff, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TemporizadorCircular from "@/components/jogo/TemporizadorCircular";
import { useProfile } from "@/contexts/ProfileContext";
import { useCarteiraJogo } from "@/contexts/CarteiraJogoContext";
import { jogoOnlineApi, type JogadorSalaJogo, type RespostaOpcaoJogo, type SalaJogo } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { localizar } from "@/i18n/rotas";
import { useIdioma } from "@/i18n/useIdioma";
import { IDIOMA_EN } from "@/i18n/idiomas";
import { OPCOES } from "./jogoConfig";

const CHAVE_SALA = "jogo.salaOnline";
const TAMANHO_DO_CODIGO = 6;
const TAMANHO_MAXIMO_MENSAGEM = 200;
const CORES_JOGADOR = ["bg-teal text-teal-foreground", "bg-gold text-navy"];

// A sala em que se está fica guardada no separador: recarregar a página a
// meio de uma partida volta à sala em vez de contar como desistência.
const lerSalaGuardada = (): string | null => {
  try {
    return window.sessionStorage.getItem(CHAVE_SALA);
  } catch {
    return null;
  }
};
const guardarSala = (codigo: string | null) => {
  try {
    if (codigo) window.sessionStorage.setItem(CHAVE_SALA, codigo);
    else window.sessionStorage.removeItem(CHAVE_SALA);
  } catch {
    // Sem armazenamento, recarregar a página perde a sala.
  }
};

const estadoDoErro = (err: unknown) => (err as { status?: unknown } | null)?.status;
const detalheDoErro = (err: unknown) => String((err as { message?: unknown } | null)?.message ?? "");

interface JogoOnlineProps {
  /** De quanto em quanto tempo se pergunta pelo estado da sala (os testes encurtam). */
  intervaloMs?: number;
}

/**
 * Multijogador Online -- duas pessoas, cada uma no seu aparelho, na mesma
 * sala (entra-se pelo código, nunca com desconhecidos sorteados). Este ecrã
 * só mostra o estado que o servidor devolve e envia as respostas: a pergunta,
 * o prazo, os pontos, o vencedor e o prémio são decididos pela API.
 *
 * O chat só aparece quando o servidor diz que está disponível (os dois
 * jogadores adultos); as mensagens recusadas pelo filtro mostram o motivo.
 */
const JogoOnline = ({ intervaloMs = 1500 }: JogoOnlineProps) => {
  const { t } = useTranslation();
  const { profile, loading: aCarregarPerfil } = useProfile();
  const { recarregar } = useCarteiraJogo();
  const emIngles = useIdioma() === IDIOMA_EN;
  const [parametros] = useSearchParams();

  const [sala, setSala] = useState<SalaJogo | null>(null);
  const [codigoEscrito, setCodigoEscrito] = useState(() =>
    (parametros.get("sala") ?? "").toUpperCase().slice(0, TAMANHO_DO_CODIGO)
  );
  const [aPedir, setAPedir] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [semLigacao, setSemLigacao] = useState(false);
  const [segundos, setSegundos] = useState<number | null>(null);
  const [aResponder, setAResponder] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erroChat, setErroChat] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);
  const [confirmarDenuncia, setConfirmarDenuncia] = useState(false);

  // Só a resposta mais recente do servidor se aplica: um pedido de estado
  // antigo que chegue depois de uma resposta não a pode desfazer.
  const pedidos = useRef(0);
  const aplicado = useRef(0);
  const falhasSeguidas = useRef(0);
  const premioVisto = useRef<string | null>(null);

  const aplicar = useCallback((numero: number, nova: SalaJogo) => {
    if (numero < aplicado.current) return;
    aplicado.current = numero;
    setSala(nova);
    setSegundos(nova.segundos_restantes);
    guardarSala(nova.estado === "abandonada" ? null : nova.codigo);
  }, []);

  const esquecerSala = useCallback(() => {
    aplicado.current = ++pedidos.current;
    setSala(null);
    setSegundos(null);
    guardarSala(null);
  }, []);

  const codigo = sala?.codigo ?? null;
  const estado = sala?.estado ?? null;

  // Voltar à sala guardada neste separador (página recarregada a meio).
  useEffect(() => {
    if (!profile?.id || emIngles || sala) return;
    const guardada = lerSalaGuardada();
    if (!guardada) return;
    const numero = ++pedidos.current;
    jogoOnlineApi
      .estado(guardada)
      .then((nova) => aplicar(numero, nova))
      .catch(() => guardarSala(null));
    // Só ao abrir a página com sessão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, emIngles]);

  // Perguntar pelo estado de tempos a tempos enquanto a sala está viva. É
  // também o sinal de vida deste jogador e o que faz a partida avançar.
  const chatAberto = sala?.chat.disponivel ?? false;
  useEffect(() => {
    if (!codigo || estado === "abandonada" || (estado === "terminada" && !chatAberto)) return;
    let cancelado = false;
    let temporizador: number | undefined;
    const perguntar = async () => {
      const numero = ++pedidos.current;
      try {
        const nova = await jogoOnlineApi.estado(codigo);
        if (cancelado) return;
        falhasSeguidas.current = 0;
        setSemLigacao(false);
        aplicar(numero, nova);
      } catch (err) {
        if (cancelado) return;
        if (estadoDoErro(err) === 404) {
          esquecerSala();
          setErro(t("JogoOnline.salaJaNaoExiste"));
          return;
        }
        falhasSeguidas.current++;
        if (falhasSeguidas.current >= 2) setSemLigacao(true);
      }
      if (!cancelado) temporizador = window.setTimeout(perguntar, estado === "terminada" ? intervaloMs * 3 : intervaloMs);
    };
    temporizador = window.setTimeout(perguntar, intervaloMs);
    return () => {
      cancelado = true;
      window.clearTimeout(temporizador);
    };
  }, [codigo, estado, chatAberto, intervaloMs, aplicar, esquecerSala, t]);

  // Contagem entre pedidos: o valor certo volta sempre do servidor.
  useEffect(() => {
    if (segundos === null || segundos <= 0 || sala?.fase !== "pergunta") return;
    const temporizador = window.setTimeout(() => setSegundos((s) => (s === null ? s : Math.max(0, s - 1))), 1000);
    return () => window.clearTimeout(temporizador);
  }, [segundos, sala?.fase]);

  // O prémio já está na conta quando a sala chega terminada: actualiza a carteira.
  useEffect(() => {
    if (sala?.estado === "terminada" && sala.premio && premioVisto.current !== sala.codigo) {
      premioVisto.current = sala.codigo;
      void recarregar();
    }
  }, [sala, recarregar]);

  const pedir = async (accao: () => Promise<SalaJogo>, mensagens: Record<string, string> = {}) => {
    if (aPedir) return;
    setAPedir(true);
    setErro(null);
    const numero = ++pedidos.current;
    try {
      aplicar(numero, await accao());
    } catch (err) {
      console.error("Falha num pedido do Multijogador Online:", err);
      const chave = estadoDoErro(err) === 404 ? "404" : detalheDoErro(err);
      setErro(mensagens[chave] ?? t("JogoOnline.naoFoiPossivel"));
    } finally {
      setAPedir(false);
    }
  };

  const criar = () => pedir(() => jogoOnlineApi.criar());

  const entrar = (evento: FormEvent) => {
    evento.preventDefault();
    if (codigoEscrito.length < TAMANHO_DO_CODIGO) return;
    void pedir(() => jogoOnlineApi.entrar(codigoEscrito), {
      "404": t("JogoOnline.salaNaoEncontrada"),
      sala_cheia: t("JogoOnline.salaCheia"),
      sala_ja_comecou: t("JogoOnline.salaJaComecou"),
    });
  };

  const comecar = () => sala && pedir(() => jogoOnlineApi.comecar(sala.codigo));

  const responder = async (opcao: RespostaOpcaoJogo) => {
    if (!sala?.pergunta || aResponder || sala.minha_resposta) return;
    setAResponder(true);
    setErro(null);
    const numero = ++pedidos.current;
    try {
      aplicar(numero, await jogoOnlineApi.responder(sala.codigo, sala.pergunta.id, opcao));
    } catch (err) {
      // "ronda_fechada": o prazo passou ou já tinha respondido -- o próximo
      // pedido de estado mostra o que ficou; qualquer outro erro, pode tentar de novo.
      if (detalheDoErro(err) !== "ronda_fechada") setErro(t("JogoOnline.naoFoiPossivelResponder"));
    } finally {
      setAResponder(false);
    }
  };

  const sair = async () => {
    if (!sala) return;
    const actual = sala.codigo;
    esquecerSala();
    setErro(null);
    try {
      await jogoOnlineApi.sair(actual);
    } catch (err) {
      // Mesmo sem conseguir avisar, a sala dá pela ausência ao fim de uns segundos.
      console.error("Falha ao sair da sala:", err);
    }
  };

  const ligacao = sala ? `${window.location.origin}${localizar("/jogo-curiosidades/online")}?sala=${sala.codigo}` : "";

  const copiarCodigo = async () => {
    if (!sala) return;
    try {
      await navigator.clipboard.writeText(sala.codigo);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem área de transferência, o código continua escrito no ecrã.
    }
  };

  const enviarMensagem = async (evento: FormEvent) => {
    evento.preventDefault();
    const texto = mensagem.trim();
    if (!sala || !texto || aEnviar) return;
    setAEnviar(true);
    setErroChat(null);
    const numero = ++pedidos.current;
    try {
      aplicar(numero, await jogoOnlineApi.enviarMensagem(sala.codigo, texto));
      setMensagem("");
    } catch (err) {
      const detalhe = detalheDoErro(err);
      const motivo = detalhe.startsWith("mensagem_recusada:") ? detalhe.split(":")[1] : null;
      const chaves: Record<string, string> = {
        linguagem: "JogoOnline.chat.recusadaLinguagem",
        contacto: "JogoOnline.chat.recusadaContacto",
        dados_pessoais: "JogoOnline.chat.recusadaDadosPessoais",
        comprida: "JogoOnline.chat.recusadaComprida",
        limite: "JogoOnline.chat.recusadaLimite",
        vazia: "JogoOnline.chat.recusadaVazia",
      };
      setErroChat(
        motivo && chaves[motivo]
          ? t(chaves[motivo])
          : estadoDoErro(err) === 429
            ? t("JogoOnline.chat.depressaDemais")
            : t("JogoOnline.chat.naoEnviada")
      );
    } finally {
      setAEnviar(false);
    }
  };

  const denunciar = async () => {
    if (!sala) return;
    setConfirmarDenuncia(false);
    const numero = ++pedidos.current;
    try {
      aplicar(numero, await jogoOnlineApi.denunciarChat(sala.codigo));
    } catch (err) {
      console.error("Falha ao denunciar o chat:", err);
      setErroChat(t("JogoOnline.chat.naoDenunciada"));
    }
  };

  const eu = sala?.jogadores.find((j) => j.eu) ?? null;
  const adversario = sala?.jogadores.find((j) => !j.eu) ?? null;
  const rotuloDaRonda = sala
    ? sala.desempate > 0
      ? t("JogoOnline.desempate", { numero: sala.desempate })
      : t("JogoOnline.rondaDe", { ronda: sala.ronda, rondas: sala.rondas })
    : "";

  const placar = (jogadores: JogadorSalaJogo[], final: boolean) => (
    <ol className="space-y-2" aria-label={t("JogoOnline.pontuacao")}>
      {[...jogadores]
        .map((jogador, indice) => ({ jogador, indice }))
        .sort((a, b) => b.jogador.pontos - a.jogador.pontos || a.indice - b.indice)
        .map(({ jogador, indice }) => (
          <li
            key={indice}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-2",
              final && jogador.vencedor ? "border-gold bg-gold/10" : "border-border/60 bg-background"
            )}
          >
            <span
              className={cn(
                "w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold",
                CORES_JOGADOR[indice % CORES_JOGADOR.length]
              )}
              aria-hidden="true"
            >
              {jogador.nome[0]?.toUpperCase()}
            </span>
            <span className="flex-1 min-w-0 truncate font-semibold text-foreground">
              {jogador.nome}
              {jogador.eu && <span className="font-normal text-muted-foreground"> {t("JogoOnline.tu")}</span>}
            </span>
            {final && jogador.vencedor && <Crown className="w-4 h-4 text-gold" />}
            {!final && sala?.fase === "pergunta" && (
              <span className="text-xs text-muted-foreground">
                {jogador.respondeu ? t("JogoOnline.jaRespondeu") : t("JogoOnline.aPensar")}
              </span>
            )}
            {!final && sala?.fase === "revelacao" && jogador.pontos_ronda !== null && (
              <span className={cn("text-xs font-bold", jogador.certa ? "text-green" : "text-destructive")}>
                +{jogador.pontos_ronda}
              </span>
            )}
            <span className="font-bold text-foreground tabular-nums">{jogador.pontos}</span>
          </li>
        ))}
    </ol>
  );

  const cartao = "rounded-2xl bg-card border border-border/60 shadow-card p-6 sm:p-8";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <BackButton fallbackPath={localizar("/jogo-curiosidades")} label={t("JogoOnline.voltarAoMenu")} />

      <main className="flex-1">
        <div className="container pb-16">
          <header className="max-w-2xl mx-auto text-center space-y-3 mb-8">
            <span className="text-sm font-medium tracking-widest uppercase text-teal">{t("JogoOnline.inclusivamente")}</span>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">{t("JogoOnline.titulo")}</h1>
            {!sala && <p className="text-muted-foreground">{t("JogoOnline.descricao")}</p>}
          </header>

          <div className="max-w-xl mx-auto space-y-4">
            {semLigacao && sala && (
              <p role="status" className="flex items-center gap-2 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                <WifiOff className="w-4 h-4 shrink-0" />
                {t("JogoOnline.semLigacao")}
              </p>
            )}
            {erro && (
              <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
                {erro}
              </p>
            )}

            {emIngles ? (
              <div className={cn(cartao, "text-center text-muted-foreground")}>{t("JogoOnline.soEmPortugues")}</div>
            ) : aCarregarPerfil ? (
              <div className={cn(cartao, "flex justify-center")}>
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !profile ? (
              <div className={cn(cartao, "text-center space-y-4")}>
                <p className="text-muted-foreground">{t("JogoOnline.precisaDeSessao")}</p>
                <Button asChild className="bg-teal text-teal-foreground hover:bg-teal/90">
                  <Link to={localizar("/auth")}>{t("JogoOnline.iniciarSessao")}</Link>
                </Button>
              </div>
            ) : !sala ? (
              <div className={cn(cartao, "space-y-6")}>
                <div className="space-y-3">
                  <h2 className="font-bold text-foreground">{t("JogoOnline.criarTitulo")}</h2>
                  <p className="text-sm text-muted-foreground">{t("JogoOnline.criarDescricao")}</p>
                  <Button
                    onClick={() => void criar()}
                    disabled={aPedir}
                    className="w-full bg-teal text-teal-foreground hover:bg-teal/90"
                  >
                    {t("JogoOnline.criarSala")}
                  </Button>
                </div>
                <form onSubmit={entrar} className="space-y-3 border-t border-border/50 pt-6">
                  <h2 className="font-bold text-foreground">{t("JogoOnline.entrarTitulo")}</h2>
                  <div className="flex gap-2">
                    <Input
                      value={codigoEscrito}
                      onChange={(e) =>
                        setCodigoEscrito(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, TAMANHO_DO_CODIGO))
                      }
                      placeholder={t("JogoOnline.codigoDaSala")}
                      aria-label={t("JogoOnline.codigoDaSala")}
                      autoComplete="off"
                      autoCapitalize="characters"
                      className="font-mono tracking-widest text-center uppercase"
                    />
                    <Button type="submit" variant="outline" disabled={aPedir || codigoEscrito.length < TAMANHO_DO_CODIGO}>
                      {t("JogoOnline.entrar")}
                    </Button>
                  </div>
                </form>
                <div className="flex items-start gap-3 rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm text-foreground">
                  <Coins className="w-5 h-5 shrink-0 text-gold mt-0.5" />
                  <p>{t("JogoOnline.premio")}</p>
                </div>
              </div>
            ) : sala.estado === "a_aguardar" ? (
              <div className={cn(cartao, "space-y-6 text-center")}>
                <div className="space-y-2">
                  <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
                    {t("JogoOnline.codigoDaSala")}
                  </p>
                  <p className="text-4xl font-bold font-mono tracking-[0.3em] text-foreground" data-testid="codigo-da-sala">
                    {sala.codigo}
                  </p>
                  {sala.sou_anfitriao && <p className="text-sm text-muted-foreground">{t("JogoOnline.partilheOCodigo")}</p>}
                </div>
                {sala.sou_anfitriao && (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="outline" onClick={() => void copiarCodigo()}>
                      {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiado ? t("JogoOnline.copiado") : t("JogoOnline.copiarCodigo")}
                    </Button>
                    <Button asChild variant="outline">
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(t("JogoOnline.convite", { ligacao }))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Share2 className="w-4 h-4" />
                        {t("JogoOnline.partilhar")}
                      </a>
                    </Button>
                  </div>
                )}
                <div className="text-left">{placar(sala.jogadores, false)}</div>
                {sala.jogadores.length < 2 ? (
                  <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("JogoOnline.aEsperaDoSegundo")}
                  </p>
                ) : sala.sou_anfitriao ? (
                  <Button
                    onClick={() => void comecar()}
                    disabled={aPedir}
                    className="w-full bg-teal text-teal-foreground hover:bg-teal/90"
                  >
                    {t("JogoOnline.comecar")}
                  </Button>
                ) : (
                  <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("JogoOnline.aEsperaDoAnfitriao", { nome: adversario?.nome ?? "" })}
                  </p>
                )}
                <Button variant="ghost" onClick={() => void sair()} className="text-muted-foreground">
                  {t("JogoOnline.sairDaSala")}
                </Button>
              </div>
            ) : sala.estado === "em_curso" && sala.pergunta ? (
              <div className={cn(cartao, "space-y-6")}>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground">{rotuloDaRonda}</p>
                  {sala.fase === "pergunta" && segundos !== null && (
                    <TemporizadorCircular tempoRestante={segundos} tempoTotal={sala.tempo_por_pergunta} />
                  )}
                </div>
                <p className="text-lg md:text-xl font-semibold text-foreground leading-relaxed">
                  {sala.pergunta.texto_pergunta}
                </p>
                <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                  {OPCOES.map((opcao) => {
                    const minha = (sala.fase === "revelacao" ? eu?.resposta : sala.minha_resposta) === opcao;
                    const certa = sala.revelacao?.resposta_correta === opcao;
                    const errada = !!sala.revelacao && minha && !certa;
                    const fechado = sala.fase !== "pergunta" || !!sala.minha_resposta || aResponder || segundos === 0;
                    const texto = { A: sala.pergunta!.opcao_a, B: sala.pergunta!.opcao_b, C: sala.pergunta!.opcao_c, D: sala.pergunta!.opcao_d }[opcao];
                    return (
                      <button
                        key={opcao}
                        type="button"
                        disabled={fechado}
                        onClick={() => void responder(opcao)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-all duration-300",
                          "disabled:cursor-not-allowed",
                          !fechado && "border-border bg-background hover:border-teal hover:bg-teal/5",
                          fechado && !certa && !errada && !minha && "border-border bg-background",
                          minha && !sala.revelacao && "border-teal bg-teal/5",
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
                        <span className="text-sm sm:text-base text-foreground flex-1">{texto}</span>
                      </button>
                    );
                  })}
                </div>

                {sala.fase === "pergunta" && sala.minha_resposta && (
                  <p role="status" className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("JogoOnline.aEsperaDe", { nome: adversario?.nome ?? "" })}
                  </p>
                )}
                {sala.fase === "revelacao" && eu && (
                  <div className="space-y-2 border-t border-border/50 pt-5">
                    <p role="status" className={cn("text-lg font-bold", eu.certa ? "text-green" : "text-destructive")}>
                      {eu.certa
                        ? t("JogoOnline.certo", { pontos: eu.pontos_ronda ?? 0 })
                        : eu.resposta === null
                          ? t("JogoOnline.tempoEsgotado")
                          : t("JogoOnline.errado")}
                    </p>
                    {sala.revelacao?.explicacao && <p className="text-sm text-muted-foreground">{sala.revelacao.explicacao}</p>}
                    <p className="text-xs text-muted-foreground">{t("JogoOnline.proximaASeguir")}</p>
                  </div>
                )}

                <div className="border-t border-border/50 pt-5 space-y-3">
                  {placar(sala.jogadores, false)}
                  <Button variant="ghost" onClick={() => void sair()} className="w-full text-muted-foreground">
                    {t("JogoOnline.desistir")}
                  </Button>
                </div>
              </div>
            ) : sala.estado === "terminada" ? (
              <div className={cn(cartao, "space-y-6 text-center")}>
                <div className="w-16 h-16 mx-auto rounded-full bg-gold/15 text-gold flex items-center justify-center">
                  <Trophy className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
                    {t("JogoOnline.fimDaPartida")}
                  </p>
                  <h2 className="text-2xl font-bold text-foreground">
                    {sala.jogadores.filter((j) => j.vencedor).length > 1
                      ? t("JogoOnline.vitoriaPartilhada")
                      : eu?.vencedor
                        ? t("JogoOnline.ganhou")
                        : t("JogoOnline.ganhouOutro", { nome: sala.jogadores.find((j) => j.vencedor)?.nome ?? "" })}
                  </h2>
                  {sala.motivo_fim === "desistencia" && (
                    <p className="text-sm text-muted-foreground">
                      {eu?.vencedor ? t("JogoOnline.outroSaiu") : t("JogoOnline.saiuDaPartida")}
                    </p>
                  )}
                </div>
                <div className="text-left">{placar(sala.jogadores, true)}</div>
                {sala.premio && (
                  <p role="status" className="rounded-xl border border-gold/40 bg-gold/10 p-4 font-semibold text-foreground">
                    {sala.premio.moedas_ganhas > 0
                      ? t(sala.premio.limite_diario_atingido ? "JogoOnline.premioGanhoNoLimite" : "JogoOnline.premioGanho", {
                          moedas: sala.premio.moedas_ganhas,
                        })
                      : sala.premio.limite_diario_atingido
                        ? t("JogoOnline.premioLimiteDiario")
                        : t("JogoOnline.premioZero")}
                  </p>
                )}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button onClick={esquecerSala} className="flex-1 bg-teal text-teal-foreground hover:bg-teal/90">
                    {t("JogoOnline.novaSala")}
                  </Button>
                  <Button asChild variant="outline" className="flex-1">
                    <Link to={localizar("/jogo-curiosidades")}>{t("JogoOnline.voltarAoMenu")}</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className={cn(cartao, "space-y-4 text-center")}>
                <p className="text-muted-foreground">{t("JogoOnline.salaFechada")}</p>
                <Button onClick={esquecerSala} className="bg-teal text-teal-foreground hover:bg-teal/90">
                  {t("JogoOnline.novaSala")}
                </Button>
              </div>
            )}

            {sala && profile && !emIngles && sala.chat.motivo !== "a_espera" && sala.estado !== "abandonada" && (
              <section className={cn(cartao, "space-y-3")} aria-label={t("JogoOnline.chat.titulo")}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-bold text-foreground flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-teal" />
                    {t("JogoOnline.chat.titulo")}
                  </h2>
                  {sala.chat.disponivel &&
                    (confirmarDenuncia ? (
                      <span className="flex items-center gap-2 text-xs">
                        <Button size="sm" variant="destructive" onClick={() => void denunciar()}>
                          {t("JogoOnline.chat.confirmarDenuncia")}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmarDenuncia(false)}>
                          {t("JogoOnline.chat.cancelar")}
                        </Button>
                      </span>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setConfirmarDenuncia(true)} className="text-muted-foreground">
                        <Flag className="w-4 h-4" />
                        {t("JogoOnline.chat.denunciar")}
                      </Button>
                    ))}
                </div>

                {sala.chat.disponivel ? (
                  <>
                    <p className="text-xs text-muted-foreground">{t("JogoOnline.chat.regras")}</p>
                    <ul className="space-y-2 max-h-56 overflow-y-auto" aria-live="polite">
                      {sala.chat.mensagens.length === 0 && (
                        <li className="text-sm text-muted-foreground">{t("JogoOnline.chat.semMensagens")}</li>
                      )}
                      {sala.chat.mensagens.map((m) => (
                        <li key={m.id} className={cn("flex", m.minha ? "justify-end" : "justify-start")}>
                          <span
                            className={cn(
                              "max-w-[80%] rounded-2xl px-3 py-2 text-sm break-words",
                              m.minha ? "bg-teal text-teal-foreground" : "bg-muted text-foreground"
                            )}
                          >
                            {!m.minha && <span className="block text-[11px] font-bold opacity-70">{m.nome}</span>}
                            {m.texto}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <form onSubmit={enviarMensagem} className="flex gap-2">
                      <Input
                        value={mensagem}
                        onChange={(e) => setMensagem(e.target.value)}
                        maxLength={TAMANHO_MAXIMO_MENSAGEM}
                        placeholder={t("JogoOnline.chat.escreva")}
                        aria-label={t("JogoOnline.chat.escreva")}
                        autoComplete="off"
                      />
                      <Button type="submit" size="icon" disabled={aEnviar || !mensagem.trim()} aria-label={t("JogoOnline.chat.enviar")}>
                        <Send className="w-4 h-4" />
                      </Button>
                    </form>
                    {erroChat && (
                      <p role="alert" className="text-sm text-destructive">
                        {erroChat}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground space-y-1">
                    {sala.chat.motivo === "so_adultos" &&
                      (sala.chat.eu_adulto ? (
                        <p>{t("JogoOnline.chat.soAdultosOutro")}</p>
                      ) : (
                        <>
                          <p>{t("JogoOnline.chat.soAdultosEu")}</p>
                          <Link to={localizar("/editar-perfil")} className="text-teal hover:underline">
                            {t("JogoOnline.chat.irAoPerfil")}
                          </Link>
                        </>
                      ))}
                    {sala.chat.motivo === "denunciado" && <p>{t("JogoOnline.chat.denunciado")}</p>}
                    {sala.chat.motivo === "fechado" && <p>{t("JogoOnline.chat.fechado")}</p>}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default JogoOnline;
