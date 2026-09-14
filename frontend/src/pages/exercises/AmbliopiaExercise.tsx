import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Award, Crosshair, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import BaseExercise, { useExerciseSession } from "@/components/exercises/BaseExercise";
import { useEyeTracking } from "@/hooks/useEyeTracking";
import { useFeedback } from "@/contexts/FeedbackContext";
import { useProfile } from "@/contexts/ProfileContext";
import { sessoesExercicioApi } from "@/lib/apiClient";
import FeedbackWidget from "@/components/FeedbackWidget";

const EXERCICIO_ID = "ambliopia";

// Mesma mecânica-base do Foco Dinâmico (CerebroExercise.tsx): grelha 4x4,
// um alvo activo de cada vez, hit-box tolerante para rastreio ocular por
// webcam. Ver esse ficheiro para as notas completas sobre a matemática da
// grelha e o cooldown de combo -- aqui documentam-se só as diferenças.
const TOLERANCIA_PX = 85;
const INTERVALO_PONTUACAO_MS = 200;
const COOLDOWN_HIT_MS = 1000;
const COMBO_TIMEOUT_MS = 2500;
const COMBO_PONTOS_BASE = 5;
const COMBO_PONTOS_MAX = 80;
const FEEDBACK_FLUTUANTE_DURACAO_MS = 1100;

const GRID_COLS = 4;
const GRID_ROWS = 4;
const GRID_SIZE = GRID_COLS * GRID_ROWS;
const CELULA_DIAMETRO_PX = 56;
const ROTACAO_ALVO_MS_BASE = COMBO_TIMEOUT_MS;
const PULSO_DURACAO_MS = 700;
const VELOCIDADE_ANGULAR_PULSO = (Math.PI * 2) / (PULSO_DURACAO_MS / 1000);
const GRID_MAX_WIDTH_PX = 448; // == Tailwind max-w-md

const posicaoDaCelula = (idx: number, largura: number, altura: number) => {
  const col = idx % GRID_COLS;
  const row = Math.floor(idx / GRID_COLS);
  const larguraGrelha = Math.min(largura, GRID_MAX_WIDTH_PX);
  const offsetX = (largura - larguraGrelha) / 2;
  const paddingX = larguraGrelha * 0.14;
  const paddingY = altura * 0.14;
  const colGap = GRID_COLS > 1 ? (larguraGrelha - paddingX * 2) / (GRID_COLS - 1) : 0;
  const rowGap = GRID_ROWS > 1 ? (altura - paddingY * 2) / (GRID_ROWS - 1) : 0;
  return {
    x: offsetX + paddingX + col * colGap,
    y: paddingY + row * rowGap,
  };
};

const escolherNovoIndice = (actual: number) => {
  if (GRID_SIZE <= 1) return 0;
  let novo = actual;
  while (novo === actual) {
    novo = Math.floor(Math.random() * GRID_SIZE);
  }
  return novo;
};

/** Escolhe `quantidade` índices distintos, nenhum igual a `evitar`. */
const escolherDistratores = (evitar: number, quantidade: number): number[] => {
  const disponiveis = Array.from({ length: GRID_SIZE }, (_, i) => i).filter((i) => i !== evitar);
  for (let i = disponiveis.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [disponiveis[i], disponiveis[j]] = [disponiveis[j], disponiveis[i]];
  }
  return disponiveis.slice(0, Math.min(quantidade, disponiveis.length));
};

const DURACOES_PREDEFINIDAS = [
  { label: "30s", segundos: 30 },
  { label: "1 min", segundos: 60 },
  { label: "1.5 min", segundos: 90 },
  { label: "2 min", segundos: 120 },
  { label: "3 min", segundos: 180 },
];
const DURACAO_CUSTOM_MIN_SEGUNDOS = 10;
const DURACAO_CUSTOM_MAX_SEGUNDOS = 900;

const VELOCIDADES = [
  { label: "Lento", multiplicador: 0.6 },
  { label: "Normal", multiplicador: 1 },
  { label: "Rápido", multiplicador: 1.6 },
];

/**
 * Níveis de dificuldade: cada um combina dois eixos clínicos --
 * "visual crowding" (quantos distractores partilham o estilo do alvo,
 * criando aglomeração/ruído à sua volta) e contraste (quão parecida a cor
 * do alvo/distractores-quase-alvo fica da cor de fundo neutra). Mais difícil
 * = mais distractores + cores mais parecidas, forçando o olho fraco a
 * discriminar o alvo real em vez de o reconhecer só pela cor.
 */
interface NivelDificuldade {
  label: string;
  numDistratoresAtivos: number;
  /** 0 = alto contraste (fácil) .. 1 = baixo contraste (difícil). */
  contraste: number;
}
const NIVEIS_DIFICULDADE: NivelDificuldade[] = [
  { label: "Fácil", numDistratoresAtivos: 4, contraste: 0.15 },
  { label: "Médio", numDistratoresAtivos: 8, contraste: 0.5 },
  { label: "Difícil", numDistratoresAtivos: 12, contraste: 0.85 },
];

/** Cor do alvo (e dos distractores-quase-alvo) segundo o nível de contraste:
 * interpola entre o teal vívido da marca (fácil de distinguir do fundo) e um
 * azul-acinzentado muito próximo do tom neutro dos distractores simples
 * (difícil de distinguir). `jitter` (-1..1) afasta ligeiramente cada
 * distractor-quase-alvo do tom exacto do alvo, sem nunca o tornar mais fácil
 * de identificar do que o próprio alvo real.
 */
const corPorContraste = (contraste: number, jitter = 0): string => {
  const c = Math.min(1, Math.max(0, contraste));
  const matiz = 173 - 37 * c; // 173 (teal) -> 136 (azul-acinzentado)
  const saturacao = 70 - 55 * c; // 70% -> 15%
  const luminosidade = 40 + 20 * c + jitter * 4; // 40% -> 60%, +/- ruído por célula
  return `hsl(${matiz.toFixed(0)} ${saturacao.toFixed(0)}% ${luminosidade.toFixed(0)}%)`;
};

const PONTOS_POR_NIVEL = 50;
const PONTOS_NIVEL_MESTRE = 1000;

interface NivelInfo {
  nivel: number;
  nome: string;
  ehMestre: boolean;
  pontosNoNivel: number;
  pontosParaSubir: number;
  progresso: number;
}

const calcularNivel = (score: number): NivelInfo => {
  if (score >= PONTOS_NIVEL_MESTRE) {
    return {
      nivel: Infinity,
      nome: "Nível Mestre",
      ehMestre: true,
      pontosNoNivel: 0,
      pontosParaSubir: 0,
      progresso: 1,
    };
  }
  const numeroNivel = Math.floor(score / PONTOS_POR_NIVEL) + 1;
  const pontosNoNivel = score - (numeroNivel - 1) * PONTOS_POR_NIVEL;
  return {
    nivel: numeroNivel,
    nome: `Nível ${numeroNivel}`,
    ehMestre: false,
    pontosNoNivel,
    pontosParaSubir: PONTOS_POR_NIVEL,
    progresso: pontosNoNivel / PONTOS_POR_NIVEL,
  };
};

interface FeedbackFlutuante {
  id: number;
  texto: string;
  x: number;
  y: number;
}

interface AmbliopiaGameProps {
  duracaoSegundos: number;
  onEscolherDuracao: (segundos: number) => void;
}

const AmbliopiaGame = ({ duracaoSegundos, onEscolherDuracao }: AmbliopiaGameProps) => {
  const { locked } = useExerciseSession();
  if (locked) return <div className="h-[350px]" />;
  return (
    <AmbliopiaGameAtivo duracaoSegundos={duracaoSegundos} onEscolherDuracao={onEscolherDuracao} />
  );
};

const AmbliopiaGameAtivo = ({ duracaoSegundos, onEscolherDuracao }: AmbliopiaGameProps) => {
  const { isRunning, score, remainingSeconds, addScore } = useExerciseSession();
  const { videoRef, gaze, isTracking, isCalibrating, calibrate, error } = useEyeTracking();
  const { profile } = useProfile();
  const { openFeedback } = useFeedback();

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [activeIdx, setActiveIdx] = useState(0);
  const [distratoresAtivos, setDistratoresAtivos] = useState<number[]>([]);
  const [pulso, setPulso] = useState(0);
  const [precisaoAoVivo, setPrecisaoAoVivo] = useState<number | null>(null);
  const [feedbacksFlutuantes, setFeedbacksFlutuantes] = useState<FeedbackFlutuante[]>([]);
  const [personalizarAberto, setPersonalizarAberto] = useState(false);
  const [duracaoCustomInput, setDuracaoCustomInput] = useState(String(duracaoSegundos));
  const [velocidadeIdx, setVelocidadeIdx] = useState(1); // "Normal" por omissão
  const [dificuldadeIdx, setDificuldadeIdx] = useState(0); // "Fácil" por omissão
  const [instrucaoConfirmada, setInstrucaoConfirmada] = useState(false);
  const velocidade = VELOCIDADES[velocidadeIdx].multiplicador;
  const dificuldade = NIVEIS_DIFICULDADE[dificuldadeIdx];

  const activeIdxRef = useRef(0);
  const dificuldadeRef = useRef(dificuldade);
  const gazeRef = useRef(gaze);
  const isTrackingRef = useRef(isTracking);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const ultimoTimestampRef = useRef(0);
  const rotacaoAcumuladaRef = useRef(0);
  const hitTicksRef = useRef(0);
  const totalTicksRef = useRef(0);
  const finalizadoRef = useRef(false);

  // Métricas específicas deste exercício (gravadas em `detalhes` no fim):
  // tempo de reação por Hit e contagem de acertos/falhas discretos -- falha
  // = o alvo rodou por ter expirado sem ser encontrado a tempo.
  const tempoAtivacaoAlvoRef = useRef(0);
  const temposReacaoMsRef = useRef<number[]>([]);
  const acertosRef = useRef(0);
  const errosRef = useRef(0);

  const comboAtualRef = useRef(0);
  const lastHitTimeRef = useRef(0);
  const proximoFeedbackIdRef = useRef(0);

  const nivelInfo = calcularNivel(score);

  useEffect(() => {
    gazeRef.current = gaze;
  }, [gaze]);

  useEffect(() => {
    isTrackingRef.current = isTracking;
  }, [isTracking]);

  useEffect(() => {
    dificuldadeRef.current = dificuldade;
  }, [dificuldade]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isRunning || containerSize.width === 0) {
      startTimeRef.current = 0;
      ultimoTimestampRef.current = 0;
      rotacaoAcumuladaRef.current = 0;
      return;
    }

    const registarHit = (alvoX: number, alvoY: number, agora: number) => {
      const tempoDesdeUltimoHit = agora - lastHitTimeRef.current;
      if (tempoDesdeUltimoHit > COMBO_TIMEOUT_MS) {
        comboAtualRef.current = 0;
      }

      const pontosGanhos = Math.min(
        COMBO_PONTOS_MAX,
        COMBO_PONTOS_BASE * 2 ** comboAtualRef.current,
      );
      addScore(pontosGanhos);
      lastHitTimeRef.current = agora;
      comboAtualRef.current += 1;

      acertosRef.current += 1;
      if (tempoAtivacaoAlvoRef.current > 0) {
        temposReacaoMsRef.current.push(agora - tempoAtivacaoAlvoRef.current);
      }

      const texto =
        pontosGanhos > COMBO_PONTOS_BASE
          ? `+${pontosGanhos} Combo x${comboAtualRef.current}!`
          : `+${pontosGanhos}`;
      const id = proximoFeedbackIdRef.current++;
      setFeedbacksFlutuantes((prev) => [...prev, { id, texto, x: alvoX, y: alvoY }]);
      setTimeout(() => {
        setFeedbacksFlutuantes((prev) => prev.filter((f) => f.id !== id));
      }, FEEDBACK_FLUTUANTE_DURACAO_MS);
    };

    const rodarAlvo = (foiEncontrado: boolean, agora: number) => {
      if (!foiEncontrado && tempoAtivacaoAlvoRef.current > 0) {
        errosRef.current += 1;
      }
      rotacaoAcumuladaRef.current = 0;
      const novoIdx = escolherNovoIndice(activeIdxRef.current);
      activeIdxRef.current = novoIdx;
      setActiveIdx(novoIdx);
      setDistratoresAtivos(escolherDistratores(novoIdx, dificuldadeRef.current.numDistratoresAtivos));
      tempoAtivacaoAlvoRef.current = agora;
    };

    const animar = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      if (!ultimoTimestampRef.current) ultimoTimestampRef.current = timestamp;
      const deltaMs = timestamp - ultimoTimestampRef.current;
      ultimoTimestampRef.current = timestamp;
      const elapsedSeconds = (timestamp - startTimeRef.current) / 1000;

      const anguloPulso = elapsedSeconds * VELOCIDADE_ANGULAR_PULSO;
      setPulso(0.5 + 0.5 * Math.sin(anguloPulso));

      rotacaoAcumuladaRef.current += deltaMs;
      const intervaloRotacao = ROTACAO_ALVO_MS_BASE / velocidade;
      if (rotacaoAcumuladaRef.current >= intervaloRotacao) {
        rodarAlvo(false, Date.now());
      }

      const pos = posicaoDaCelula(activeIdxRef.current, containerSize.width, containerSize.height);
      const cursorX = gazeRef.current.x * containerSize.width;
      const cursorY = gazeRef.current.y * containerSize.height;
      const distancia = Math.hypot(cursorX - pos.x, cursorY - pos.y);
      const agora = Date.now();

      if (
        isTrackingRef.current &&
        distancia <= TOLERANCIA_PX &&
        agora - lastHitTimeRef.current > COOLDOWN_HIT_MS
      ) {
        registarHit(pos.x, pos.y, agora);
        rodarAlvo(true, agora);
      }

      rafRef.current = requestAnimationFrame(animar);
    };
    rafRef.current = requestAnimationFrame(animar);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isRunning, containerSize.width, containerSize.height, velocidade, addScore]);

  useEffect(() => {
    if (!isRunning) return;

    const intervalId = window.setInterval(() => {
      totalTicksRef.current += 1;

      const pos = posicaoDaCelula(activeIdxRef.current, containerSize.width, containerSize.height);
      const cursorX = gazeRef.current.x * containerSize.width;
      const cursorY = gazeRef.current.y * containerSize.height;
      const distancia = Math.hypot(cursorX - pos.x, cursorY - pos.y);

      if (isTrackingRef.current && distancia <= TOLERANCIA_PX) {
        hitTicksRef.current += 1;
      }
      setPrecisaoAoVivo((hitTicksRef.current / totalTicksRef.current) * 100);
    }, INTERVALO_PONTUACAO_MS);

    return () => window.clearInterval(intervalId);
  }, [isRunning, containerSize.width, containerSize.height]);

  useEffect(() => {
    if (remainingSeconds !== 0 || finalizadoRef.current) return;
    finalizadoRef.current = true;

    const duracaoAtivaSegundos = Math.max(
      1,
      Math.round((totalTicksRef.current * INTERVALO_PONTUACAO_MS) / 1000),
    );
    const precisaoPercentual =
      totalTicksRef.current > 0
        ? Number(((hitTicksRef.current / totalTicksRef.current) * 100).toFixed(2))
        : 0;

    const totalTentativas = acertosRef.current + errosRef.current;
    const taxaErro =
      totalTentativas > 0 ? Number(((errosRef.current / totalTentativas) * 100).toFixed(2)) : 0;
    const tempoReacaoMedioMs =
      temposReacaoMsRef.current.length > 0
        ? Math.round(
            temposReacaoMsRef.current.reduce((soma, t) => soma + t, 0) /
              temposReacaoMsRef.current.length,
          )
        : 0;

    const detalhes = {
      tempo_reacao_medio_ms: tempoReacaoMedioMs,
      taxa_erro: taxaErro,
      dificuldade: dificuldadeRef.current.label,
    };

    const registarSessao = async () => {
      if (!profile?.id) return;
      try {
        await sessoesExercicioApi.registar({
          exercicio_id: EXERCICIO_ID,
          pontuacao: score,
          precisao_percentual: precisaoPercentual,
          duracao_segundos: duracaoAtivaSegundos,
          detalhes,
        });
      } catch (err) {
        console.error("Falha ao registar sessão de exercício:", err);
      }
    };

    void registarSessao();
    openFeedback({
      context: "exercicio-ambliopia",
      question: "Como avalia o exercício Anti-Supressão / Ambliopia?",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds]);

  const aindaNaoIniciou = remainingSeconds === duracaoSegundos;
  const podeCalibrar = !isRunning && remainingSeconds > 0;
  const mostrarSeletorDuracao = !isRunning && aindaNaoIniciou && instrucaoConfirmada;
  const mostrarInstrucao = !isRunning && aindaNaoIniciou && !instrucaoConfirmada;

  const aplicarDuracaoCustom = () => {
    const valor = Number(duracaoCustomInput);
    if (!Number.isFinite(valor)) return;
    const segundos = Math.min(
      DURACAO_CUSTOM_MAX_SEGUNDOS,
      Math.max(DURACAO_CUSTOM_MIN_SEGUNDOS, Math.round(valor)),
    );
    setDuracaoCustomInput(String(segundos));
    onEscolherDuracao(segundos);
  };

  const escala = 1 + pulso * 0.3;
  const opacidade = 0.75 + pulso * 0.25;
  const brilhoRaioPx = 10 + pulso * 26;
  const brilhoAlfa = 0.35 + pulso * 0.45;
  const corAlvo = corPorContraste(dificuldade.contraste);

  return (
    <div className="p-5">
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-2.5">
        <Award className="h-5 w-5 shrink-0 text-teal" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">{nivelInfo.nome}</span>
            {!nivelInfo.ehMestre && (
              <span className="text-xs text-muted-foreground">
                {nivelInfo.pontosNoNivel}/{nivelInfo.pontosParaSubir} pts
              </span>
            )}
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal to-navy transition-[width] duration-300"
              style={{ width: `${Math.round(nivelInfo.progresso * 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative h-[350px] bg-muted/30 rounded-xl border border-border overflow-hidden select-none"
      >
        <video ref={videoRef} autoPlay playsInline muted className="sr-only" />

        {isRunning && containerSize.width > 0 && (
          <>
            {Array.from({ length: GRID_SIZE }).map((_, i) => {
              const pos = posicaoDaCelula(i, containerSize.width, containerSize.height);
              const ehActivo = i === activeIdx;
              const ehDistratorAtivo = !ehActivo && distratoresAtivos.includes(i);
              const jitter = ehDistratorAtivo ? (i % 5) / 5 - 0.5 : 0;
              return (
                <div
                  key={i}
                  className={`absolute rounded-full border-2 ${
                    ehActivo || ehDistratorAtivo ? "" : "border-border bg-muted/60"
                  }`}
                  style={{
                    width: CELULA_DIAMETRO_PX,
                    height: CELULA_DIAMETRO_PX,
                    left: pos.x,
                    top: pos.y,
                    transform:
                      ehActivo
                        ? `translate(-50%, -50%) scale(${escala})`
                        : "translate(-50%, -50%)",
                    opacity: ehActivo ? opacidade : 1,
                    borderColor: ehActivo || ehDistratorAtivo ? corPorContraste(dificuldade.contraste, jitter) : undefined,
                    backgroundColor: ehActivo || ehDistratorAtivo ? corPorContraste(dificuldade.contraste, jitter) : undefined,
                    boxShadow: ehActivo
                      ? `0 0 ${brilhoRaioPx}px ${corAlvo.replace("hsl", "hsla").replace(")", `, ${brilhoAlfa})`)}`
                      : undefined,
                  }}
                />
              );
            })}

            <div
              className="absolute top-0 left-0 h-9 w-9 rounded-full border-2 border-teal bg-teal/20 shadow-[0_0_16px_rgba(45,212,191,0.6)]"
              style={{
                transform: `translate(-50%, -50%) translate(${gaze.x * containerSize.width}px, ${gaze.y * containerSize.height}px)`,
                opacity: isTracking ? 0.9 : 0.25,
              }}
            />

            {feedbacksFlutuantes.map((f) => (
              <div
                key={f.id}
                className="pointer-events-none absolute animate-float-up-fade whitespace-nowrap text-base font-bold text-teal drop-shadow-sm"
                style={{ left: f.x, top: f.y }}
              >
                {f.texto}
              </div>
            ))}
          </>
        )}

        {!isTracking && isRunning && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm">
            <EyeOff className="h-3.5 w-3.5" />
            Rosto não detectado
          </div>
        )}

        {isRunning && error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 p-6 text-center text-sm text-muted-foreground">
            {error}
          </div>
        )}

        {mostrarInstrucao && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto p-6 text-center">
            <Eye className="h-10 w-10 text-teal" />
            <div className="max-w-sm space-y-2">
              <h3 className="text-base font-bold text-foreground">Antes de começar</h3>
              <p className="text-sm text-muted-foreground">
                Cubra o <strong className="text-foreground">olho mais forte</strong> com a mão ou um
                penso ocular. Este exercício só é eficaz se for o{" "}
                <strong className="text-foreground">olho mais fraco</strong> a procurar o alvo
                sozinho.
              </p>
            </div>
            <Button type="button" onClick={() => setInstrucaoConfirmada(true)}>
              Já cobri o olho mais forte, continuar
            </Button>
          </div>
        )}

        {!isRunning && !mostrarInstrucao && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {remainingSeconds === 0
                ? "Sessão concluída."
                : aindaNaoIniciou
                  ? "Escolha a duração e a dificuldade, calibre o olhar a olhar para o centro e prima Iniciar."
                  : "Em pausa. Prima Iniciar para continuar."}
            </p>

            {mostrarSeletorDuracao && (
              <div className="flex flex-wrap items-start justify-center gap-6">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Duração da sessão
                  </span>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {DURACOES_PREDEFINIDAS.map((d) => (
                      <Button
                        key={d.segundos}
                        type="button"
                        variant={duracaoSegundos === d.segundos ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          onEscolherDuracao(d.segundos);
                          setPersonalizarAberto(false);
                        }}
                      >
                        {d.label}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      variant={personalizarAberto ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setDuracaoCustomInput(String(duracaoSegundos));
                        setPersonalizarAberto((v) => !v);
                      }}
                    >
                      Personalizar
                    </Button>
                  </div>
                  {personalizarAberto && (
                    <div className="flex items-center justify-center gap-2">
                      <input
                        type="number"
                        min={DURACAO_CUSTOM_MIN_SEGUNDOS}
                        max={DURACAO_CUSTOM_MAX_SEGUNDOS}
                        step={5}
                        value={duracaoCustomInput}
                        onChange={(e) => setDuracaoCustomInput(e.target.value)}
                        onBlur={aplicarDuracaoCustom}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") aplicarDuracaoCustom();
                        }}
                        className="w-20 rounded-md border border-border bg-background px-2 py-1 text-center text-sm text-foreground"
                        aria-label="Duração personalizada, em segundos"
                      />
                      <span className="text-xs text-muted-foreground">segundos</span>
                      <Button type="button" size="sm" onClick={aplicarDuracaoCustom}>
                        Aplicar
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Dificuldade
                  </span>
                  <div className="flex items-center justify-center gap-2">
                    {NIVEIS_DIFICULDADE.map((d, i) => (
                      <Button
                        key={d.label}
                        type="button"
                        variant={dificuldadeIdx === i ? "default" : "outline"}
                        size="sm"
                        onClick={() => setDificuldadeIdx(i)}
                      >
                        {d.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Velocidade dos alvos
                  </span>
                  <div className="flex items-center justify-center gap-2">
                    {VELOCIDADES.map((v, i) => (
                      <Button
                        key={v.label}
                        type="button"
                        variant={velocidadeIdx === i ? "default" : "outline"}
                        size="sm"
                        onClick={() => setVelocidadeIdx(i)}
                      >
                        {v.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {error ? (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <EyeOff className="h-3.5 w-3.5" />
                {error}
              </p>
            ) : (
              podeCalibrar &&
              instrucaoConfirmada && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void calibrate()}
                  disabled={isCalibrating}
                >
                  <Crosshair className="h-4 w-4" />
                  {isCalibrating ? "A calibrar..." : "Calibrar Olhar"}
                </Button>
              )
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>Cubra o olho mais forte e mantenha o olhar sobre a forma que pulsa entre as restantes.</p>
        {precisaoAoVivo !== null && (
          <span className="font-semibold text-foreground">
            Precisão: {precisaoAoVivo.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
};

const AmbliopiaExercise = () => {
  const navigate = useNavigate();
  const [duracaoSegundos, setDuracaoSegundos] = useState(DURACOES_PREDEFINIDAS[1].segundos);

  const handleVoltar = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/exercicios");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-16">
        <div className="container max-w-4xl mx-auto">
          <Button variant="ghost" className="mb-6" onClick={handleVoltar}>
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Menu
          </Button>

          <BaseExercise
            title="Anti-Supressão / Ambliopia"
            description="Cubra o olho mais forte e encontre o alvo entre distractores cada vez mais parecidos."
            isPremium={true}
            durationSeconds={duracaoSegundos}
          >
            <AmbliopiaGame duracaoSegundos={duracaoSegundos} onEscolherDuracao={setDuracaoSegundos} />
          </BaseExercise>
        </div>
      </main>
      <Footer />
      <FeedbackWidget />
    </div>
  );
};

export default AmbliopiaExercise;
