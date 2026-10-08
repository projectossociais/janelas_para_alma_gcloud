import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useProfile } from "@/contexts/ProfileContext";
import { useCarteiraJogo } from "@/contexts/CarteiraJogoContext";
import type { RecompensaSequenciaMostrada } from "@/components/jogo/RecompensaSequenciaModal";
import {
  jogoApi,
  mensagemDeErroApi,
  type AjudaMercado,
  type OfertaVidaExtra,
  type PerguntaJogoPublica,
  type RespostaOpcaoJogo,
  type ValidarRespostaJogoResponse,
  type VidaExtraJogo,
} from "@/lib/apiClient";
import { gerarOpiniaoPublico } from "@/lib/jogo/opiniaoPublico";
import { localizar } from "@/i18n/rotas";
import { useIdioma } from "@/i18n/useIdioma";
import { IDIOMA_EN } from "@/i18n/idiomas";
import { OPCOES, TOTAL_PATAMARES, calcularRecompensaCliente } from "../jogoConfig";
import { obterPerguntaOfflineNaoVista, obterPerguntaOfflinePorId, obterPerguntasDoPatamar } from "../perguntasOffline";

const TEMPO_SPLASH_MS = 2500;

export const TEMPO_POR_PERGUNTA = 45;

export interface ResultadoResposta {
  correta: boolean;
  // `null` enquanto a partida (com sessão) está à espera da decisão sobre a
  // vida extra -- a API só revela a resposta ao terminar a partida.
  resposta_correta: RespostaOpcaoJogo | null;
  explicacao: string | null;
  tempoEsgotado: boolean;
  vidaExtra?: OfertaVidaExtra | null;
}

export interface RecompensaLocal {
  moedas: number;
  diamantes: number;
}

/**
 * Toda a lógica de uma partida do Inclusivamente (estado, temporizador, ajudas,
 * vida extra, sequências, fim de partida), sem ecrã. Extraída tal e qual de
 * `JogoCuriosidades.tsx` (o ecrã só a mostra); as regras e os comentários são os
 * de sempre.
 */
export function usePartidaJogo() {
  const { t: tr } = useTranslation();
  const navigate = useNavigate();
  const { profile, loading: aCarregarPerfil } = useProfile();
  const { definirPerfil } = useCarteiraJogo();
  // As perguntas da API (base de dados) só existem em português: no site
  // inglês o jogo usa sempre a reserva local, traduzida em
  // perguntasOffline.en-US.ts. Não é "modo offline" -- o aviso não aparece.
  const emIngles = useIdioma() === IDIOMA_EN;
  // Perguntas, partida e prémios do servidor só com sessão (desde 2026-09-24:
  // sem sessão, `/jogo/validar` servia de oráculo para a resposta certa).
  // Convidados -- e o site inglês -- jogam com a reserva local, sem prémio.
  const usaServidor = !!profile?.id && !emIngles;
  const modoRecompensa: "servidor" | "treino" | "convidado" = usaServidor ? "servidor" : profile ? "treino" : "convidado";

  const [mostrarSplash, setMostrarSplash] = useState(true);

  const [patamar, setPatamar] = useState(1);
  const [pergunta, setPergunta] = useState<PerguntaJogoPublica | null>(null);
  const [aCarregarPergunta, setACarregarPergunta] = useState(true);
  const [emModoOffline, setEmModoOffline] = useState(false);
  // Com sessão, alguma pergunta desta partida veio da reserva local (o
  // servidor falhou)? Essas respostas o servidor nunca viu, por isso não
  // entram no prémio -- que ele paga só pelos patamares que confirmou.
  const [partidaComPerguntasOffline, setPartidaComPerguntasOffline] = useState(false);
  // Com sessão, o servidor respondeu com erro ao pedir a pergunta (ex.: 404
  // sem perguntas, 5xx) -- mostra-se o erro com "Tentar novamente" em vez de
  // cair calado na reserva local, onde os acertos não contam para o prémio.
  const [erroPerguntaServidor, setErroPerguntaServidor] = useState(false);
  // O motivo que a API deu (ex.: "sem perguntas disponíveis") -- mostrado
  // por baixo, para um erro em produção ser diagnosticável sem consola.
  const [detalheErroPergunta, setDetalheErroPergunta] = useState("");

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
  const [mostrarMercado, setMostrarMercado] = useState(false);
  // Sugestão comprada no Mercado para a pergunta em curso (só se mostra;
  // quem responde continua a ser o jogador).
  const [sugestaoMercado, setSugestaoMercado] = useState<AjudaMercado | null>(null);

  const [tempoRestante, setTempoRestante] = useState(TEMPO_POR_PERGUNTA);
  const [jogoTerminado, setJogoTerminado] = useState(false);

  const [recompensaEnviada, setRecompensaEnviada] = useState(false);
  const [recompensaLocal, setRecompensaLocal] = useState<RecompensaLocal | null>(null);
  // Oferta de vida extra em cima da mesa (modal aberto) -- vem da API ao errar.
  const [ofertaVidaExtra, setOfertaVidaExtra] = useState<OfertaVidaExtra | null>(null);

  // Partida no servidor (só com sessão). As respostas esperam por este pedido:
  // se `iniciarPartida` chegasse depois da primeira resposta, terminaria a
  // partida que essa resposta acabou de criar.
  const inicioPartida = useRef<Promise<unknown>>(Promise.resolve());
  const iniciarPartidaNoServidor = useCallback(() => {
    inicioPartida.current = jogoApi.iniciarPartida().catch((err: unknown) => {
      // Sem bloquear o jogo -- o servidor cria a partida na primeira resposta.
      console.error("Falha ao iniciar a partida no servidor:", err);
    });
  }, []);

  // Acertos seguidos nesta partida (vem da API) e o marco a celebrar.
  const [sequenciaAcertos, setSequenciaAcertos] = useState(0);
  const [recompensaSequencia, setRecompensaSequencia] = useState<RecompensaSequenciaMostrada | null>(null);

  // Ids das perguntas offline já mostradas nesta sessão -- evita repetição
  // enquanto a reserva do patamar não se esgota. Guardado também numa ref
  // porque é lido de dentro de `carregarPergunta` (async, `useCallback` com
  // deps vazias) depois de um `await` -- sem a ref, essa leitura veria
  // sempre o valor de quando o componente montou, nunca as atualizações
  // seguintes (incluindo o reset em `reiniciarJogo`).
  const [, setPerguntasVistas] = useState<string[]>([]);
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
  const carregarPergunta = useCallback(async (novoPatamar: number, trocar = false) => {
    setACarregarPergunta(true);
    setPergunta(null);
    setOpcaoSelecionada(null);
    setResultado(null);
    setMostrarModalErrado(false);
    setOpcoesEliminadas([]);
    setSugestaoMercado(null);
    setMostrarMercado(false);
    setTempoRestante(TEMPO_POR_PERGUNTA);
    setErroPerguntaServidor(false);
    if (!usaServidor) {
      setPergunta(escolherPerguntaOfflineParaPatamar(novoPatamar));
      setEmModoOffline(true);
      setPatamar(novoPatamar);
      setACarregarPergunta(false);
      return;
    }
    try {
      await inicioPartida.current;
      // O servidor decide o patamar (o da partida) -- o do cliente é só o
      // que se esperava; se divergirem, manda o servidor.
      const nova = await jogoApi.obterPerguntaDaPartida(trocar);
      setPergunta(nova);
      setPatamar(nova.patamar);
      setEmModoOffline(false);
    } catch (err) {
      // Duck-typing no `status` (CLAUDE.md secção 6): só uma falha de rede
      // (sem resposta, status 0/ausente) justifica o modo offline.
      const status = (err as { status?: unknown } | null)?.status;
      if (typeof status === "number" && status > 0) {
        console.error("A API do jogo respondeu com erro ao pedir a pergunta:", err);
        setPatamar(novoPatamar);
        setErroPerguntaServidor(true);
        setDetalheErroPergunta(mensagemDeErroApi(err, ""));
        return;
      }
      console.error("Falha ao contactar a API do jogo, a usar o modo offline:", err);
      setPergunta(escolherPerguntaOfflineParaPatamar(novoPatamar));
      setPatamar(novoPatamar);
      setEmModoOffline(true);
      setPartidaComPerguntasOffline(true);
    } finally {
      setACarregarPergunta(false);
    }
  }, [escolherPerguntaOfflineParaPatamar, usaServidor]);

  // Arranque do jogo -- espera só por saber se há sessão (define o modo) e
  // corre em paralelo com o ecrã de apresentação, para a pergunta já estar
  // pronta quando o "splash" da escada terminar. Uma única vez.
  const arrancou = useRef(false);
  useEffect(() => {
    if (aCarregarPerfil || arrancou.current) return;
    arrancou.current = true;
    if (usaServidor) iniciarPartidaNoServidor();
    void carregarPergunta(1);
  }, [aCarregarPerfil, usaServidor, carregarPergunta, iniciarPartidaNoServidor]);

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
    // Também em pausa enquanto se celebra um marco de sequência.
    if (!pergunta || resultado || jogoTerminado || mostrarSplash || recompensaSequencia) return;
    if (tempoRestante <= 0) {
      void aoTempoEsgotar();
      return;
    }
    const id = setTimeout(() => setTempoRestante((t) => t - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pergunta, resultado, jogoTerminado, mostrarSplash, tempoRestante, recompensaSequencia]);

  // Avança automaticamente ao acertar; ao errar ou esgotar o tempo, abre já
  // o modal com a explicação -- não há motivo para atrasar essa revelação.
  useEffect(() => {
    if (!resultado) return;
    // O tempo pode esgotar com o Mercado aberto -- fecha-o antes do resultado.
    setMostrarMercado(false);
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
    // Já revelado (terminou) -- nada a decidir.
    if (resultado.resposta_correta !== null || !resultado.vidaExtra || resultado.vidaExtra.restantes <= 0) {
      setMostrarModalErrado(true);
      return;
    }
    setOfertaVidaExtra(resultado.vidaExtra);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultado]);

  // Termina a partida assim que o jogo acaba (vitória, ou derrota depois de
  // recusar a vida extra) -- uma única vez por partida. Sem sessão não há
  // prémio nenhum (a reserva local é só treino). Com sessão, é o servidor que paga,
  // pelos patamares que ele próprio confirmou, e que revela a resposta certa
  // que ficou por mostrar; o valor local só enche o ecrã até ele responder.
  // Nunca bloqueia o ecrã final: uma falha de rede fica no `console.error`.
  useEffect(() => {
    if (recompensaEnviada || (!jogoTerminado && !mostrarModalErrado)) return;
    setRecompensaEnviada(true);
    // Sem servidor (convidado ou site inglês) não há partida nem prémio.
    if (!usaServidor) return;
    // A estimativa local só enche o ecrã quando o servidor viu a partida
    // toda -- com perguntas offline, mostraria um valor que ele não paga.
    if (!partidaComPerguntasOffline) {
      const patamarAlcancado = jogoTerminado ? TOTAL_PATAMARES : Math.max(patamar - 1, 0);
      setRecompensaLocal(calcularRecompensaCliente(patamarAlcancado));
    }
    jogoApi
      .terminarPartida()
      .then((terminada) => {
        definirPerfil(terminada.perfil);
        setRecompensaLocal({ moedas: terminada.moedas_ganhas, diamantes: terminada.diamantes_ganhos });
        if (terminada.resposta_correta) {
          const revelada = terminada.resposta_correta;
          setResultado((atual) =>
            atual && atual.resposta_correta === null
              ? { ...atual, resposta_correta: revelada, explicacao: terminada.explicacao }
              : atual
          );
        }
      })
      .catch((err: unknown) => {
        console.error("Falha ao terminar a partida no servidor:", err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jogoTerminado, mostrarModalErrado, recompensaEnviada]);

  const aoUsarVidaExtra = (vida: VidaExtraJogo) => {
    // Mesmo patamar, mesma pergunta, sem a opção falhada e com o tempo todo.
    const falhada = vida.opcao_falhada;
    if (falhada) setOpcoesEliminadas((atuais) => (atuais.includes(falhada) ? atuais : [...atuais, falhada]));
    setOfertaVidaExtra(null);
    setOpcaoSelecionada(null);
    setResultado(null);
    setTempoRestante(TEMPO_POR_PERGUNTA);
  };

  const aoRecusarVidaExtra = () => {
    setOfertaVidaExtra(null);
    setMostrarModalErrado(true);
  };

  // Sair para o menu do jogo -- o "×" (ou Esc / clique fora) do modal de
  // resposta errada e o botão "Voltar ao menu". Nunca recomeça a partida:
  // só "Tentar novamente" faz isso. O modal de Vida Extra não tem saída
  // directa (só "Encerrar partida", que passa por aqui depois do ecrã
  // educativo). Se a partida ainda não foi terminada no servidor, termina-a
  // -- rede de segurança; normalmente o efeito do fim de partida já o fez.
  // Não bloqueia a saída: uma falha fica na consola.
  const sairParaMenu = () => {
    if (usaServidor && !recompensaEnviada) {
      setRecompensaEnviada(true);
      jogoApi
        .terminarPartida()
        .then((terminada) => definirPerfil(terminada.perfil))
        .catch((err: unknown) => console.error("Falha ao terminar a partida ao sair:", err));
    }
    setOfertaVidaExtra(null);
    setMostrarModalErrado(false);
    navigate(localizar("/jogo-curiosidades"));
  };

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
      // O tempo esgotado é sempre um erro: a "A" serve só para obter a resposta
      // certa e a explicação. Antes, se a certa fosse A, contava como acerto.
      setResultado({ ...validarLocalmente("A"), correta: false, tempoEsgotado: true });
      return;
    }
    setAValidar(true);
    try {
      await inicioPartida.current;
      const resp = await jogoApi.tempoEsgotado(pergunta.id);
      setSequenciaAcertos(0);
      setResultado({
        correta: false,
        resposta_correta: resp.resposta_correta,
        explicacao: resp.explicacao,
        tempoEsgotado: true,
        vidaExtra: resp.vida_extra,
      });
    } catch (err) {
      toast.error(mensagemDeErroApi(err, tr("JogoCuriosidades.naoFoiPossivelTerminar")));
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
      await inicioPartida.current;
      const resp = await jogoApi.validarResposta(pergunta.id, opcao);
      setSequenciaAcertos(resp.sequencia_acertos ?? 0);
      if (resp.recompensa_sequencia) {
        // Os diamantes já estão na conta (creditados na validação) -- a barra
        // actualiza já, e o marco celebra-se por cima da pergunta seguinte.
        definirPerfil(resp.recompensa_sequencia.perfil);
        setRecompensaSequencia({
          sequencia: resp.recompensa_sequencia.sequencia,
          diamantes: resp.recompensa_sequencia.diamantes,
          limiteDiarioAtingido: resp.recompensa_sequencia.limite_diario_atingido,
        });
      }
      setResultado({
        correta: resp.correta,
        resposta_correta: resp.resposta_correta,
        explicacao: resp.explicacao,
        tempoEsgotado: false,
        vidaExtra: resp.vida_extra,
      });
    } catch (err) {
      toast.error(mensagemDeErroApi(err, tr("JogoCuriosidades.naoFoiPossivelValidar")));
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
      await inicioPartida.current;
      const resp = await jogoApi.cinquentaCinquenta(pergunta.id);
      setOpcoesEliminadas(resp.opcoes_eliminadas);
    } catch (err) {
      toast.error(mensagemDeErroApi(err, tr("JogoCuriosidades.naoFoiPossivelUsar")));
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
      await inicioPartida.current;
      const resp = await jogoApi.opiniaoPublico(pergunta.id);
      setOpiniaoPublico(resp.percentagens);
      setMostrarModalPublico(true);
    } catch (err) {
      toast.error(mensagemDeErroApi(err, tr("JogoCuriosidades.naoFoiPossivelConsultar")));
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
      setSugestaoMercado(null);
      setTempoRestante(TEMPO_POR_PERGUNTA);
      return;
    }
    void carregarPergunta(patamar, true);
  };

  const reiniciarJogo = () => {
    setAjudaCincoUsada(false);
    setAjudaTrocarUsada(false);
    setAjudaPublicoUsada(false);
    setJogoTerminado(false);
    setRecompensaEnviada(false);
    setPartidaComPerguntasOffline(false);
    setRecompensaLocal(null);
    setOfertaVidaExtra(null);
    setSequenciaAcertos(0);
    setRecompensaSequencia(null);
    if (usaServidor) iniciarPartidaNoServidor();
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
      tr("JogoCuriosidades.completeiOJogoInclusivamente");
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: tr("JogoCuriosidades.inclusivamente"), text: texto, url });
      } catch {
        // utilizador cancelou a partilha -- não é um erro a reportar.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${texto} ${url}`);
      toast.success(tr("JogoCuriosidades.linkCopiadoPartilheCom"));
    } catch {
      toast.error(tr("JogoCuriosidades.naoFoiPossivelCopiar"));
    }
  };

  const textoDaOpcao = (opcao: RespostaOpcaoJogo): string => {
    if (!pergunta) return "";
    return { A: pergunta.opcao_a, B: pergunta.opcao_b, C: pergunta.opcao_c, D: pergunta.opcao_d }[opcao];
  };


  return {
    profile,
    aCarregarPergunta,
    aValidar,
    ajudaCincoUsada,
    ajudaPublicoUsada,
    ajudaTrocarUsada,
    aoRecusarVidaExtra,
    aoUsarVidaExtra,
    carregarPergunta,
    detalheErroPergunta,
    emModoOffline,
    erroPerguntaServidor,
    jogoTerminado,
    modoRecompensa,
    mostrarMercado,
    mostrarModalErrado,
    mostrarModalPublico,
    mostrarSplash,
    ofertaVidaExtra,
    opcaoSelecionada,
    opcoesEliminadas,
    opiniaoPublico,
    partidaComPerguntasOffline,
    partilhar,
    patamar,
    pergunta,
    recompensaLocal,
    recompensaSequencia,
    reiniciarJogo,
    resultado,
    sairParaMenu,
    selecionarOpcao,
    sequenciaAcertos,
    setMostrarMercado,
    setMostrarModalPublico,
    setMostrarSplash,
    setRecompensaSequencia,
    setSugestaoMercado,
    sugestaoMercado,
    tempoRestante,
    textoDaOpcao,
    trocarPergunta,
    usaServidor,
    usar5050,
    usarOpiniaoPublico,
  };
}
