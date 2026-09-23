import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  Coins,
  Gem,
  Loader2,
  RefreshCw,
  Share2,
  Shuffle,
  Trophy,
  Users,
  WifiOff,
  X,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useProfile } from "@/contexts/ProfileContext";
import {
  jogoApi,
  mensagemDeErroApi,
  type PerguntaJogoPublica,
  type RespostaOpcaoJogo,
  type ValidarRespostaJogoResponse,
} from "@/lib/apiClient";
import { OPCOES, PATAMARES, TOTAL_PATAMARES, calcularRecompensaCliente, formatarKz, valorDoPatamar } from "./jogoConfig";
import { obterPerguntaOfflineNaoVista, obterPerguntaOfflinePorId, obterPerguntasDoPatamar } from "./perguntasOffline";

const TEMPO_SPLASH_MS = 2500;

const TEMPO_POR_PERGUNTA = 45;

interface ResultadoResposta {
  correta: boolean;
  resposta_correta: RespostaOpcaoJogo;
  explicacao: string | null;
  tempoEsgotado: boolean;
}

interface RecompensaLocal {
  moedas: number;
  diamantes: number;
}

// Simula uma sondagem: a opção certa fica sempre entre 55% e 75%, o resto
// reparte-se pelas outras três de forma plausível (nunca 0%, soma sempre 100).
const gerarOpiniaoPublico = (correta: RespostaOpcaoJogo): Record<RespostaOpcaoJogo, number> => {
  const percentagemCorreta = 55 + Math.floor(Math.random() * 21);
  const restantes = OPCOES.filter((o) => o !== correta);
  const pesos = restantes.map(() => Math.random() + 0.1);
  const somaPesos = pesos.reduce((a, b) => a + b, 0);
  const disponivel = 100 - percentagemCorreta;
  const valores = pesos.map((p) => Math.max(1, Math.round((p / somaPesos) * disponivel)));
  valores[0] += disponivel - valores.reduce((a, b) => a + b, 0);

  const resultado = { A: 0, B: 0, C: 0, D: 0 } as Record<RespostaOpcaoJogo, number>;
  resultado[correta] = percentagemCorreta;
  restantes.forEach((opcao, i) => {
    resultado[opcao] = valores[i];
  });
  return resultado;
};

const JogoCuriosidades = () => {
  const { profile } = useProfile();

  const [mostrarSplash, setMostrarSplash] = useState(true);

  const [patamar, setPatamar] = useState(1);
  const [pergunta, setPergunta] = useState<PerguntaJogoPublica | null>(null);
  const [aCarregarPergunta, setACarregarPergunta] = useState(true);
  const [emModoOffline, setEmModoOffline] = useState(false);

  const [opcaoSelecionada, setOpcaoSelecionada] = useState<RespostaOpcaoJogo | null>(null);
  const [aValidar, setAValidar] = useState(false);
  const [resultado, setResultado] = useState<ResultadoResposta | null>(null);
  const [mostrarModalErrado, setMostrarModalErrado] = useState(false);

  const [opcoesEliminadas, setOpcoesEliminadas] = useState<RespostaOpcaoJogo[]>([]);
  const [ajudaCincoUsada, setAjudaCincoUsada] = useState(false);
  const [ajudaTrocarUsada, setAjudaTrocarUsada] = useState(false);
  const [ajudaPublicoUsada, setAjudaPublicoUsada] = useState(false);
  const [opiniaoPublico, setOpiniaoPublico] = useState<Record<RespostaOpcaoJogo, number> | null>(null);
  const [mostrarModalPublico, setMostrarModalPublico] = useState(false);

  const [tempoRestante, setTempoRestante] = useState(TEMPO_POR_PERGUNTA);
  const [jogoTerminado, setJogoTerminado] = useState(false);

  const [recompensaEnviada, setRecompensaEnviada] = useState(false);
  const [recompensaLocal, setRecompensaLocal] = useState<RecompensaLocal | null>(null);

  // Ids das perguntas offline já mostradas nesta sessão -- evita repetição
  // enquanto a reserva do patamar não se esgota. Guardado também numa ref
  // porque é lido de dentro de `carregarPergunta` (async, `useCallback` com
  // deps vazias) depois de um `await` -- sem a ref, essa leitura veria
  // sempre o valor de quando o componente montou, nunca as atualizações
  // seguintes (incluindo o reset em `reiniciarJogo`).
  const [perguntasVistas, setPerguntasVistas] = useState<string[]>([]);
  const perguntasVistasRef = useRef<string[]>([]);

  const atualizarPerguntasVistas = useCallback((atualizador: (atual: string[]) => string[]) => {
    const novo = atualizador(perguntasVistasRef.current);
    perguntasVistasRef.current = novo;
    setPerguntasVistas(novo);
  }, []);

  // Escolhe (e regista como vista) uma pergunta offline para `novoPatamar`,
  // já convertida para a forma pública usada no ecrã. Se a reserva desse
  // patamar já tiver sido totalmente mostrada nesta sessão, reinicia só o
  // rastreio dele -- o jogador volta a poder ver as mesmas 5, em vez de o
  // jogo ficar preso ou de misturar patamares diferentes.
  const escolherPerguntaOfflineParaPatamar = useCallback(
    (novoPatamar: number): PerguntaJogoPublica => {
      const idsDoPatamar = obterPerguntasDoPatamar(novoPatamar).map((p) => p.id);
      const vistosAtuais = perguntasVistasRef.current;
      const vistosDoPatamar = vistosAtuais.filter((id) => idsDoPatamar.includes(id));
      const esgotado = idsDoPatamar.length > 0 && vistosDoPatamar.length >= idsDoPatamar.length;
      const escolhida = obterPerguntaOfflineNaoVista(novoPatamar, vistosAtuais);
      atualizarPerguntasVistas((atual) =>
        esgotado
          ? [...atual.filter((id) => !idsDoPatamar.includes(id)), escolhida.id]
          : [...atual, escolhida.id]
      );
      return {
        id: escolhida.id,
        texto_pergunta: escolhida.texto_pergunta,
        opcao_a: escolhida.opcao_a,
        opcao_b: escolhida.opcao_b,
        opcao_c: escolhida.opcao_c,
        opcao_d: escolhida.opcao_d,
      };
    },
    [atualizarPerguntasVistas]
  );

  // Nunca deixa o modo "Um Jogador" bloqueado por falta de servidor: se o
  // pedido falhar (sem internet, backend em baixo), serve silenciosamente a
  // pergunta estática de contingência para este patamar (perguntasOffline.ts)
  // e o jogo continua -- só o pequeno aviso "Modo offline" no ecrã denuncia.
  const carregarPergunta = useCallback(async (novoPatamar: number) => {
    setACarregarPergunta(true);
    setPergunta(null);
    setOpcaoSelecionada(null);
    setResultado(null);
    setMostrarModalErrado(false);
    setOpcoesEliminadas([]);
    setTempoRestante(TEMPO_POR_PERGUNTA);
    try {
      const nova = await jogoApi.obterPerguntaAleatoria(novoPatamar);
      setPergunta(nova);
      setEmModoOffline(false);
    } catch (err) {
      console.error("Falha ao contactar a API do jogo, a usar o modo offline:", err);
      setPergunta(escolherPerguntaOfflineParaPatamar(novoPatamar));
      setEmModoOffline(true);
    } finally {
      setPatamar(novoPatamar);
      setACarregarPergunta(false);
    }
  }, [escolherPerguntaOfflineParaPatamar]);

  // Arranque do jogo -- corre em paralelo com o ecrã de apresentação, para a
  // pergunta já estar pronta quando o "splash" da escada terminar.
  useEffect(() => {
    void carregarPergunta(1);
  }, [carregarPergunta]);

  // Ecrã de apresentação com a escada completa -- unico este 2,5s ou até o
  // jogador clicar em "Começar".
  useEffect(() => {
    if (!mostrarSplash) return;
    const id = setTimeout(() => setMostrarSplash(false), TEMPO_SPLASH_MS);
    return () => clearTimeout(id);
  }, [mostrarSplash]);

  // Temporizador -- pára assim que a pergunta é respondida, o jogo termina
  // ou o ecrã de apresentação ainda está visível.
  useEffect(() => {
    if (!pergunta || resultado || jogoTerminado || mostrarSplash) return;
    if (tempoRestante <= 0) {
      void aoTempoEsgotar();
      return;
    }
    const id = setTimeout(() => setTempoRestante((t) => t - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pergunta, resultado, jogoTerminado, mostrarSplash, tempoRestante]);

  // Avança automaticamente ao acertar; ao errar ou esgotar o tempo, abre já
  // o modal com a explicação -- não há motivo para atrasar essa revelação.
  useEffect(() => {
    if (!resultado) return;
    if (resultado.correta) {
      const id = setTimeout(() => {
        if (patamar >= TOTAL_PATAMARES) {
          setJogoTerminado(true);
        } else {
          void carregarPergunta(patamar + 1);
        }
      }, 1200);
      return () => clearTimeout(id);
    }
    setMostrarModalErrado(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultado]);

  // Sincroniza a recompensa da partida com a conta assim que o jogo termina
  // (vitória ou derrota) -- uma única vez por partida. Sem sessão, guarda-se
  // só localmente para mostrar no ecrã; mesmo padrão de
  // `sessoesExercicioApi.registar` (CerebroExercise.tsx): nunca bloqueia o
  // ecrã final, uma falha de rede só fica no `console.error`.
  //
  // `registarRecompensa` já não recebe o patamar -- o servidor paga com
  // base no progresso que ele próprio rastreou a partir das respostas
  // certas confirmadas em `validarResposta` (JogoService). O valor local
  // (`calcularRecompensaCliente`) é só para o ecrã não ficar vazio antes da
  // resposta do servidor chegar; se os dois divergirem (ex.: perguntas
  // reutilizadas de nível errado), quem manda é sempre o servidor.
  useEffect(() => {
    if (recompensaEnviada || (!jogoTerminado && !mostrarModalErrado)) return;
    const patamarAlcancado = jogoTerminado ? TOTAL_PATAMARES : Math.max(patamar - 1, 0);
    setRecompensaEnviada(true);
    setRecompensaLocal(calcularRecompensaCliente(patamarAlcancado));
    if (!profile?.id) return;
    jogoApi.registarRecompensa().catch((err: unknown) => {
      console.error("Falha ao sincronizar a recompensa do jogo:", err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jogoTerminado, mostrarModalErrado, recompensaEnviada]);

  // Compara localmente contra a reserva de contingência -- só chamado
  // quando `emModoOffline` já garantiu que `pergunta.id` é um dos ids
  // "offline-N", nunca para uma pergunta vinda do servidor.
  const validarLocalmente = (opcaoEscolhida: RespostaOpcaoJogo): ValidarRespostaJogoResponse => {
    const local = pergunta && obterPerguntaOfflinePorId(pergunta.id);
    return {
      correta: !!local && opcaoEscolhida === local.resposta_correta,
      resposta_correta: local?.resposta_correta ?? "A",
      explicacao: local?.explicacao ?? null,
    };
  };

  const aoTempoEsgotar = async () => {
    if (!pergunta || aValidar) return;
    if (emModoOffline) {
      setResultado({ ...validarLocalmente("A"), tempoEsgotado: true });
      return;
    }
    setAValidar(true);
    try {
      const resp = await jogoApi.validarResposta(pergunta.id, "A");
      setResultado({
        correta: false,
        resposta_correta: resp.resposta_correta,
        explicacao: resp.explicacao,
        tempoEsgotado: true,
      });
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível terminar a pergunta."));
    } finally {
      setAValidar(false);
    }
  };

  const selecionarOpcao = async (opcao: RespostaOpcaoJogo) => {
    if (!pergunta || resultado || aValidar || opcoesEliminadas.includes(opcao)) return;
    setOpcaoSelecionada(opcao);
    if (emModoOffline) {
      setResultado({ ...validarLocalmente(opcao), tempoEsgotado: false });
      return;
    }
    setAValidar(true);
    try {
      const resp = await jogoApi.validarResposta(pergunta.id, opcao);
      setResultado({
        correta: resp.correta,
        resposta_correta: resp.resposta_correta,
        explicacao: resp.explicacao,
        tempoEsgotado: false,
      });
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível validar a resposta. Tente outra vez."));
      setOpcaoSelecionada(null);
    } finally {
      setAValidar(false);
    }
  };

  const usar5050 = async () => {
    if (!pergunta || ajudaCincoUsada || resultado || aValidar) return;
    setAjudaCincoUsada(true);
    if (emModoOffline) {
      const respostaCerta = obterPerguntaOfflinePorId(pergunta.id)?.resposta_correta ?? "A";
      const erradas = OPCOES.filter((o) => o !== respostaCerta);
      setOpcoesEliminadas(erradas.sort(() => Math.random() - 0.5).slice(0, 2));
      return;
    }
    try {
      // Chamada silenciosa: só serve para saber quais são as 2 opções erradas
      // a esconder -- a letra enviada aqui é arbitrária e nunca é mostrada
      // como "a tua resposta".
      const resp = await jogoApi.validarResposta(pergunta.id, "A");
      const erradas = OPCOES.filter((o) => o !== resp.resposta_correta);
      const paraEsconder = erradas.sort(() => Math.random() - 0.5).slice(0, 2);
      setOpcoesEliminadas(paraEsconder);
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível usar a ajuda 50:50."));
      setAjudaCincoUsada(false);
    }
  };

  const usarOpiniaoPublico = async () => {
    if (!pergunta || ajudaPublicoUsada || resultado || aValidar) return;
    setAjudaPublicoUsada(true);
    if (emModoOffline) {
      const respostaCerta = obterPerguntaOfflinePorId(pergunta.id)?.resposta_correta ?? "A";
      setOpiniaoPublico(gerarOpiniaoPublico(respostaCerta));
      setMostrarModalPublico(true);
      return;
    }
    try {
      // Mesma técnica do 50:50 -- só usa a resposta para gerar a sondagem
      // simulada, nunca a revela directamente.
      const resp = await jogoApi.validarResposta(pergunta.id, "A");
      setOpiniaoPublico(gerarOpiniaoPublico(resp.resposta_correta));
      setMostrarModalPublico(true);
    } catch (err) {
      toast.error(mensagemDeErroApi(err, "Não foi possível consultar a opinião do público."));
      setAjudaPublicoUsada(false);
    }
  };

  const trocarPergunta = () => {
    if (ajudaTrocarUsada || resultado || aValidar || aCarregarPergunta) return;
    setAjudaTrocarUsada(true);
    if (emModoOffline) {
      // Sem rede, troca dentro da própria reserva local do patamar (5
      // perguntas, filtrando as já vistas) em vez de tentar o servidor outra
      // vez -- substitui a pergunta no ecrã sem qualquer pedido de rede.
      setPergunta(escolherPerguntaOfflineParaPatamar(patamar));
      setOpcaoSelecionada(null);
      setResultado(null);
      setOpcoesEliminadas([]);
      setTempoRestante(TEMPO_POR_PERGUNTA);
      return;
    }
    void carregarPergunta(patamar);
  };

  const reiniciarJogo = () => {
    setAjudaCincoUsada(false);
    setAjudaTrocarUsada(false);
    setAjudaPublicoUsada(false);
    setJogoTerminado(false);
    setRecompensaEnviada(false);
    setRecompensaLocal(null);
    // Limpa já a pergunta e o patamar anteriores -- não basta confiar só no
    // que `carregarPergunta` faz lá dentro: isto garante que o ecrã nunca
    // mostra a pergunta da partida anterior, mesmo por um instante, e que o
    // sorteio seguinte parte sempre do patamar 1.
    setPergunta(null);
    setPatamar(1);
    // Nova jogada, novo leque de perguntas offline disponível outra vez.
    atualizarPerguntasVistas(() => []);
    void carregarPergunta(1);
  };

  const partilhar = async () => {
    const texto =
      'Completei o jogo "Inclusivamente" da Janelas Para a Alma e dominei o conhecimento em saúde ocular!';
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Inclusivamente", text: texto, url });
      } catch {
        // utilizador cancelou a partilha -- não é um erro a reportar.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${texto} ${url}`);
      toast.success("Link copiado! Partilhe com os seus amigos.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const textoDaOpcao = (opcao: RespostaOpcaoJogo): string => {
    if (!pergunta) return "";
    return { A: pergunta.opcao_a, B: pergunta.opcao_b, C: pergunta.opcao_c, D: pergunta.opcao_d }[opcao];
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <BackButton fallbackPath="/jogo-curiosidades" label="Voltar ao menu" />

      <main className="flex-1">
        <div className="container pb-16">
          {mostrarSplash ? (
            <div className="max-w-lg mx-auto rounded-2xl bg-card border border-border/60 shadow-elevated p-6 sm:p-8 text-center space-y-6 animate-scale-in">
              <div>
                <span className="text-sm font-medium tracking-widest uppercase text-teal">
                  Inclusivamente
                </span>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground mt-1">
                  Prepare-se para subir a escada
                </h1>
                <p className="text-sm text-muted-foreground mt-2">
                  Responda corretamente e avance patamar a patamar até {formatarKz(valorDoPatamar(TOTAL_PATAMARES))}.
                </p>
              </div>
              <EscadaPatamares patamarAtual={1} />
              <Button
                onClick={() => setMostrarSplash(false)}
                size="lg"
                className="w-full bg-teal text-teal-foreground hover:bg-teal/90"
              >
                Começar
              </Button>
            </div>
          ) : (
            <>
              <header className="max-w-2xl mx-auto text-center space-y-3 mb-8">
                <span className="text-sm font-medium tracking-widest uppercase text-teal">
                  Inclusivamente
                </span>
                <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                  O Jogo da Saúde Ocular
                </h1>
                <p className="text-muted-foreground">
                  Suba os 15 patamares respondendo a perguntas reais sobre visão e estrabismo.
                </p>
              </header>

              {/* Patamar atual em mobile -- gaveta com a escada completa. */}
              <div className="md:hidden max-w-2xl mx-auto mb-6">
                <Sheet>
                  <SheetTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between rounded-2xl bg-card border border-border/60 shadow-card px-5 py-4"
                    >
                      <span className="text-sm text-muted-foreground">
                        Patamar <span className="font-bold text-foreground">{patamar}</span> de {TOTAL_PATAMARES}
                      </span>
                      <span className="inline-flex items-center gap-2 font-bold text-gold">
                        {formatarKz(valorDoPatamar(patamar))}
                        <ChevronDown className="w-4 h-4" />
                      </span>
                    </button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="max-h-[75vh] overflow-y-auto rounded-t-2xl">
                    <SheetHeader>
                      <SheetTitle>Escada de prémios</SheetTitle>
                    </SheetHeader>
                    <EscadaPatamares patamarAtual={patamar} className="mt-4" />
                  </SheetContent>
                </Sheet>
              </div>

              <div className="max-w-5xl mx-auto grid md:grid-cols-[minmax(0,1fr)_240px] gap-6 items-start">
                {/* Área central */}
                <div className="order-2 md:order-1">
                  {aCarregarPergunta && (
                    <div className="rounded-2xl bg-card border border-border/60 shadow-card p-16 flex justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-teal" />
                    </div>
                  )}

                  {!aCarregarPergunta && jogoTerminado && (
                    <div className="rounded-2xl bg-card border border-gold/40 shadow-elevated p-8 sm:p-12 text-center space-y-5">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-gold to-teal mx-auto shadow-elevated">
                        <Trophy className="w-8 h-8 text-navy" />
                      </div>
                      <h2 className="text-2xl md:text-3xl font-bold text-foreground">Parabéns!</h2>
                      <p className="text-muted-foreground max-w-md mx-auto">
                        Completou os 15 patamares e mostrou que domina o conhecimento em saúde ocular.
                      </p>
                      <p className="text-3xl font-bold text-gold">{formatarKz(valorDoPatamar(TOTAL_PATAMARES))}</p>
                      <RecompensaGanha recompensa={recompensaLocal} autenticado={!!profile?.id} />
                      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                        <Button onClick={partilhar} variant="outline" className="border-teal text-teal hover:bg-teal/10">
                          <Share2 className="w-4 h-4" />
                          Partilhar
                        </Button>
                        <Button onClick={reiniciarJogo} className="bg-teal text-teal-foreground hover:bg-teal/90">
                          <RefreshCw className="w-4 h-4" />
                          Jogar novamente
                        </Button>
                      </div>
                    </div>
                  )}

                  {!aCarregarPergunta && !jogoTerminado && pergunta && (
                    <div className="rounded-2xl bg-card border border-border/60 shadow-card p-6 sm:p-8 space-y-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
                            Patamar {patamar} de {TOTAL_PATAMARES}
                          </p>
                          <p className="text-2xl font-bold text-gold">{formatarKz(valorDoPatamar(patamar))}</p>
                          {emModoOffline && (
                            <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                              <WifiOff className="w-3 h-3" />
                              Modo offline
                            </span>
                          )}
                        </div>
                        <TemporizadorCircular tempoRestante={tempoRestante} tempoTotal={TEMPO_POR_PERGUNTA} />
                      </div>

                      <p className="text-lg md:text-xl font-semibold text-foreground leading-relaxed">
                        {pergunta.texto_pergunta}
                      </p>

                      <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                        {OPCOES.map((opcao) => {
                          const eliminada = opcoesEliminadas.includes(opcao);
                          const ehSelecionada = opcaoSelecionada === opcao;
                          const ehCorreta = resultado?.resposta_correta === opcao;
                          const mostrarComoErrada = !!resultado && ehSelecionada && !resultado.correta;
                          const mostrarComoCerta = !!resultado && ehCorreta;

                          return (
                            <button
                              key={opcao}
                              type="button"
                              disabled={!!resultado || aValidar || eliminada}
                              onClick={() => void selecionarOpcao(opcao)}
                              className={cn(
                                "flex items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-all duration-300",
                                "disabled:cursor-not-allowed",
                                eliminada && "opacity-30",
                                !resultado &&
                                  !eliminada &&
                                  "border-border bg-background hover:border-teal hover:bg-teal/5",
                                mostrarComoCerta && "border-green bg-green/10",
                                mostrarComoErrada && "border-destructive bg-destructive/10"
                              )}
                            >
                              <span
                                className={cn(
                                  "flex items-center justify-center w-8 h-8 shrink-0 rounded-full border-2 font-bold text-sm",
                                  mostrarComoCerta && "border-green bg-green text-green-foreground",
                                  mostrarComoErrada && "border-destructive bg-destructive text-destructive-foreground",
                                  !mostrarComoCerta && !mostrarComoErrada && "border-teal text-teal"
                                )}
                              >
                                {mostrarComoCerta ? <Check className="w-4 h-4" /> : mostrarComoErrada ? <X className="w-4 h-4" /> : opcao}
                              </span>
                              <span className="text-sm sm:text-base text-foreground">{textoDaOpcao(opcao)}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-3 border-t border-border/50 pt-5">
                        <Button
                          variant="outline"
                          onClick={() => void usar5050()}
                          disabled={ajudaCincoUsada || !!resultado || aValidar}
                          className="border-teal/50 text-teal hover:bg-teal/10"
                        >
                          50:50
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => void usarOpiniaoPublico()}
                          disabled={ajudaPublicoUsada || !!resultado || aValidar}
                          className="border-teal/50 text-teal hover:bg-teal/10"
                        >
                          <Users className="w-4 h-4" />
                          Opinião do público
                        </Button>
                        <Button
                          variant="outline"
                          onClick={trocarPergunta}
                          disabled={ajudaTrocarUsada || !!resultado || aValidar}
                          className="border-teal/50 text-teal hover:bg-teal/10"
                        >
                          <Shuffle className="w-4 h-4" />
                          Trocar pergunta
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Escada de prémios -- desktop */}
                <div className="order-1 md:order-2 hidden md:block sticky top-24">
                  <EscadaPatamares patamarAtual={patamar} />
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <Dialog
        open={mostrarModalErrado}
        onOpenChange={(open) => {
          if (!open) reiniciarJogo();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {resultado?.tempoEsgotado ? "Tempo esgotado!" : "Essa não era a resposta certa"}
            </DialogTitle>
            <DialogDescription>
              Veja a resposta certa e a explicação antes de tentar novamente.
            </DialogDescription>
          </DialogHeader>

          {resultado && (
            <div className="space-y-4">
              <div className="rounded-xl bg-green/10 border border-green/30 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-green mb-1">
                  Resposta correta
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {resultado.resposta_correta}) {textoDaOpcao(resultado.resposta_correta)}
                </p>
              </div>
              {resultado.explicacao && (
                <p className="text-sm text-muted-foreground leading-relaxed">{resultado.explicacao}</p>
              )}
              <p className="text-sm text-foreground">
                Chegou ao patamar {patamar} de {TOTAL_PATAMARES}. Volte a tentar para chegar mais longe.
              </p>
              <RecompensaGanha recompensa={recompensaLocal} autenticado={!!profile?.id} />
            </div>
          )}

          <DialogFooter>
            <Button onClick={reiniciarJogo} className="w-full bg-teal text-teal-foreground hover:bg-teal/90">
              <RefreshCw className="w-4 h-4" />
              Tentar novamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mostrarModalPublico} onOpenChange={setMostrarModalPublico}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Opinião do público</DialogTitle>
            <DialogDescription>
              Assim responderam outros jogadores a perguntas parecidas com esta.
            </DialogDescription>
          </DialogHeader>

          {opiniaoPublico && (
            <div className="space-y-4 py-2">
              {OPCOES.map((opcao) => (
                <div key={opcao} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                    <span>Opção {opcao}</span>
                    <span className="text-teal">{opiniaoPublico[opcao]}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-teal transition-all duration-700 ease-out"
                      style={{ width: `${opiniaoPublico[opcao]}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => setMostrarModalPublico(false)}
              className="w-full bg-teal text-teal-foreground hover:bg-teal/90"
            >
              Continuar a jogar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

interface RecompensaGanhaProps {
  recompensa: RecompensaLocal | null;
  autenticado: boolean;
}

const RecompensaGanha = ({ recompensa, autenticado }: RecompensaGanhaProps) => {
  if (!recompensa) return null;
  return (
    <div className="rounded-xl bg-muted/60 border border-border/50 p-4 space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prémio ganho</p>
      <div className="flex items-center justify-center gap-6">
        <span className="inline-flex items-center gap-1.5 font-bold text-gold">
          <Coins className="w-4 h-4" />+{recompensa.moedas}
        </span>
        <span className="inline-flex items-center gap-1.5 font-bold text-teal">
          <Gem className="w-4 h-4" />+{recompensa.diamantes}
        </span>
      </div>
      {!autenticado && (
        <p className="text-xs text-muted-foreground">
          Inicie sessão para guardar estes prémios na sua conta.
        </p>
      )}
    </div>
  );
};

interface TemporizadorCircularProps {
  tempoRestante: number;
  tempoTotal: number;
}

const TAMANHO_TEMPORIZADOR = 76;
const ESPESSURA_TEMPORIZADOR = 6;
const RAIO_TEMPORIZADOR = (TAMANHO_TEMPORIZADOR - ESPESSURA_TEMPORIZADOR) / 2;
const CIRCUNFERENCIA_TEMPORIZADOR = 2 * Math.PI * RAIO_TEMPORIZADOR;

const TemporizadorCircular = ({ tempoRestante, tempoTotal }: TemporizadorCircularProps) => {
  const fracao = Math.max(0, Math.min(1, tempoRestante / tempoTotal));
  const offset = CIRCUNFERENCIA_TEMPORIZADOR * (1 - fracao);
  const urgente = tempoRestante <= 10;

  return (
    <div
      className="relative shrink-0"
      style={{ width: TAMANHO_TEMPORIZADOR, height: TAMANHO_TEMPORIZADOR }}
      role="timer"
      aria-label={`${tempoRestante} segundos restantes`}
    >
      <svg width={TAMANHO_TEMPORIZADOR} height={TAMANHO_TEMPORIZADOR} className="-rotate-90">
        <circle
          cx={TAMANHO_TEMPORIZADOR / 2}
          cy={TAMANHO_TEMPORIZADOR / 2}
          r={RAIO_TEMPORIZADOR}
          strokeWidth={ESPESSURA_TEMPORIZADOR}
          className="fill-none stroke-muted"
        />
        <circle
          cx={TAMANHO_TEMPORIZADOR / 2}
          cy={TAMANHO_TEMPORIZADOR / 2}
          r={RAIO_TEMPORIZADOR}
          strokeWidth={ESPESSURA_TEMPORIZADOR}
          strokeDasharray={CIRCUNFERENCIA_TEMPORIZADOR}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(
            "fill-none transition-[stroke-dashoffset] duration-1000 ease-linear",
            urgente ? "stroke-destructive" : "stroke-teal"
          )}
        />
      </svg>
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center text-base font-bold",
          urgente ? "text-destructive" : "text-foreground"
        )}
      >
        {tempoRestante}
      </div>
    </div>
  );
};

interface EscadaPatamaresProps {
  patamarAtual: number;
  className?: string;
}

const EscadaPatamares = ({ patamarAtual, className }: EscadaPatamaresProps) => (
  <div className={cn("rounded-2xl bg-card border border-border/60 shadow-card p-3", className)}>
    <ul className="flex flex-col-reverse gap-1">
      {PATAMARES.map(({ numero, valorKz }) => {
        const ativo = numero === patamarAtual;
        const superado = numero < patamarAtual;
        return (
          <li
            key={numero}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
              ativo && "bg-teal/10 border border-teal text-foreground font-bold",
              superado && "text-muted-foreground",
              !ativo && !superado && "text-muted-foreground/70"
            )}
          >
            {superado && <Check className="w-3.5 h-3.5 text-green shrink-0" />}
            <span className={cn(ativo && "text-gold font-bold", superado && "text-foreground/70")}>
              {formatarKz(valorKz)}
            </span>
          </li>
        );
      })}
    </ul>
  </div>
);

export default JogoCuriosidades;
