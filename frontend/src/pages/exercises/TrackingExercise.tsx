import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Award, Crosshair, EyeOff } from "lucide-react";
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

const EXERCICIO_ID = "figure8";
// Estrita de propósito: as bolas têm de se tocar a sério. Um hit-box
// pequeno é o que torna o Hit discreto (ver COOLDOWN_HIT_MS) um evento
// exigente, não uma pontuação inflacionada por proximidade.
const TOLERANCIA_PX = 45;
const INTERVALO_PONTUACAO_MS = 200;

// Combos: cada Hit é um cruzamento válido, avaliado a cada frame dentro do
// requestAnimationFrame (ver "animar") contra duas janelas de tempo
// distintas, ambas medidas a partir do mesmo `lastHitTimeRef`:
//  - COOLDOWN_HIT_MS: tempo mínimo entre dois Hits, para o olhar ter de
//    ficar parado a sério dentro do alvo em vez de disparar em rajada só
//    por tremer lá dentro.
//  - COMBO_TIMEOUT_MS: se o Hit demorar mais do que isto a acontecer, a
//    bola já deu a volta sem o utilizador a apanhar -- falhou o
//    cruzamento consecutivo e o combo recomeça do zero.
// Pontuação: 1º cruzamento = 5 pts, 2º consecutivo = 10, 3º = 20, ...
// dobra a cada cruzamento, com um teto para a escala não disparar.
const COOLDOWN_HIT_MS = 1000;
const COMBO_TIMEOUT_MS = 2500;
const COMBO_PONTOS_BASE = 5;
const COMBO_PONTOS_MAX = 80;
// Duração do texto flutuante de feedback -- deve combinar com a animação
// "float-up-fade" definida em tailwind.config.ts.
const FEEDBACK_FLUTUANTE_DURACAO_MS = 1100;
const DURACAO_CICLO_MS = 4000; // duração de uma volta completa ao oito, à velocidade "Normal"
// Velocidade angular (rad/s) a que o alvo percorre o oito à velocidade
// "Normal" -- uma volta completa (2π) a cada DURACAO_CICLO_MS.
const VELOCIDADE_ANGULAR_BASE = (Math.PI * 2) / (DURACAO_CICLO_MS / 1000);

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

/** Posição no oito (curva de Lissajova/lemniscata a=1, b=2), como offset em
 * px do centro, a partir de um ângulo contínuo (nunca reiniciado por
 * módulo -- ver o comentário junto ao requestAnimationFrame que o produz).
 * `y = sin(angulo)*cos(angulo)*2` é a mesma curva que `sin(2*angulo)`, só
 * escrita a partir do mesmo ângulo usado em x, para garantir que os dois
 * eixos ficam sempre em fase um com o outro. */
const posicaoNoOito = (angulo: number, amplitudeX: number, amplitudeY: number) => ({
  x: Math.sin(angulo) * amplitudeX,
  y: Math.sin(angulo) * Math.cos(angulo) * 2 * amplitudeY,
});

// Gamificação: bandas de 50 pontos por nível (Nível 1: 0-49, Nível 2:
// 50-99, ...), até um patamar especial "Nível Mestre" a partir dos 1000.
const PONTOS_POR_NIVEL = 50;
const PONTOS_NIVEL_MESTRE = 1000;

interface NivelInfo {
  /** Ordinal comparável do nível (Infinity para o Nível Mestre) -- serve
   * para detectar transições de subida de nível sem comparar strings. */
  nivel: number;
  nome: string;
  ehMestre: boolean;
  /** Pontos já feitos dentro do nível actual (0 se for o Nível Mestre). */
  pontosNoNivel: number;
  /** Pontos necessários para completar o nível actual (0 se for o Nível Mestre). */
  pontosParaSubir: number;
  /** Fracção (0-1) do progresso dentro do nível actual. */
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

/** Texto flutuante de feedback ("+10", "+20 Combo x3!") mostrado junto ao
 * alvo no momento de um Hit, removido automaticamente após a animação. */
interface FeedbackFlutuante {
  id: number;
  texto: string;
  x: number;
  y: number;
}

interface TrackingGameProps {
  duracaoSegundos: number;
  onEscolherDuracao: (segundos: number) => void;
}

/**
 * O jogo em si. Isolado do wrapper para poder devolver cedo (sem chamar
 * useEyeTracking, e portanto sem pedir a câmara) quando o conteúdo está
 * bloqueado -- mesmo critério já usado pelo BaseExercise para a sua própria
 * pré-visualização da câmara.
 */
const TrackingGame = ({ duracaoSegundos, onEscolherDuracao }: TrackingGameProps) => {
  const { locked } = useExerciseSession();
  if (locked) return <div className="h-[350px]" />;
  return (
    <TrackingGameAtivo duracaoSegundos={duracaoSegundos} onEscolherDuracao={onEscolherDuracao} />
  );
};

const TrackingGameAtivo = ({ duracaoSegundos, onEscolherDuracao }: TrackingGameProps) => {
  const { isRunning, score, remainingSeconds, addScore } = useExerciseSession();
  const { videoRef, gaze, isTracking, isCalibrating, calibrate, error } = useEyeTracking();
  const { profile } = useProfile();
  const { openFeedback } = useFeedback();

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [targetPos, setTargetPos] = useState({ x: 0, y: 0 });
  const [precisaoAoVivo, setPrecisaoAoVivo] = useState<number | null>(null);
  const [feedbacksFlutuantes, setFeedbacksFlutuantes] = useState<FeedbackFlutuante[]>([]);
  const [personalizarAberto, setPersonalizarAberto] = useState(false);
  const [duracaoCustomInput, setDuracaoCustomInput] = useState(String(duracaoSegundos));
  const [velocidadeIdx, setVelocidadeIdx] = useState(1); // "Normal" por omissão
  const velocidade = VELOCIDADES[velocidadeIdx].multiplicador;

  const targetPosRef = useRef({ x: 0, y: 0 });
  const gazeRef = useRef(gaze);
  const isTrackingRef = useRef(isTracking);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const hitTicksRef = useRef(0);
  const totalTicksRef = useRef(0);
  const finalizadoRef = useRef(false);

  // Estado do combo. `lastHitTimeRef` serve as duas janelas de tempo (ver
  // COOLDOWN_HIT_MS/COMBO_TIMEOUT_MS acima); começa em 0 de propósito, para
  // que o primeiro Hit da sessão nunca seja bloqueado por nenhuma delas.
  const comboAtualRef = useRef(0);
  const lastHitTimeRef = useRef(0);
  const proximoFeedbackIdRef = useRef(0);

  // Nível: só a barra de progresso visual (abaixo) reflecte a subida --
  // sem toasts/popups a interromper o utilizador a meio do exercício.
  const nivelInfo = calcularNivel(score);

  useEffect(() => {
    gazeRef.current = gaze;
  }, [gaze]);

  useEffect(() => {
    isTrackingRef.current = isTracking;
  }, [isTracking]);

  // Mede o contentor para converter o olhar normalizado (0-1) em px.
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

  // Anima o alvo ao longo da curva em oito e, no mesmo frame, verifica o
  // cruzamento discreto do olhar com o alvo (Hits + combo).
  useEffect(() => {
    if (!isRunning || containerSize.width === 0) {
      startTimeRef.current = 0;
      return;
    }

    const amplitudeX = containerSize.width * 0.35;
    const amplitudeY = containerSize.height * 0.32;

    const registarHit = (alvoX: number, alvoY: number, agora: number) => {
      // A bola já deu a volta sem ser apanhada -- falhou o cruzamento
      // consecutivo, o combo recomeça do zero antes de pontuar este Hit.
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

    const animar = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsedSeconds = (timestamp - startTimeRef.current) / 1000;
      // Ângulo contínuo, NUNCA reiniciado por módulo -- Math.sin()/cos() já
      // são periódicos por si só. Um wrap manual (ex.: `elapsed %
      // duracao`) fazia o ângulo "saltar" de volta a 0 sempre que a
      // velocidade não era exactamente 1, criando um engasgo visível uma
      // vez por volta (o valor de sin() antes e depois do salto não batia
      // certo, exceto quando a velocidade era um múltiplo inteiro de 1).
      const angulo = elapsedSeconds * VELOCIDADE_ANGULAR_BASE * velocidade;
      const pos = posicaoNoOito(angulo, amplitudeX, amplitudeY);
      targetPosRef.current = pos;
      setTargetPos(pos);

      // Cruzamento válido: dentro do hit-box E fora do cooldown desde o
      // último Hit -- evita o efeito metralhadora de tremores do olho
      // dentro do alvo, sem exigir sair e voltar a entrar.
      const alvoX = containerSize.width / 2 + pos.x;
      const alvoY = containerSize.height / 2 + pos.y;
      const cursorX = gazeRef.current.x * containerSize.width;
      const cursorY = gazeRef.current.y * containerSize.height;
      const distancia = Math.hypot(cursorX - alvoX, cursorY - alvoY);
      const agora = Date.now();

      if (
        isTrackingRef.current &&
        distancia <= TOLERANCIA_PX &&
        agora - lastHitTimeRef.current > COOLDOWN_HIT_MS
      ) {
        registarHit(alvoX, alvoY, agora);
      }

      rafRef.current = requestAnimationFrame(animar);
    };
    rafRef.current = requestAnimationFrame(animar);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isRunning, containerSize.width, containerSize.height, velocidade, addScore]);

  // Métrica de precisão a um ritmo fixo (tempo em cima do alvo / tempo
  // total activo) -- independente da pontuação por Hits discretos acima:
  // esta é uma média contínua, não um evento único por cruzamento.
  useEffect(() => {
    if (!isRunning) return;

    const intervalId = window.setInterval(() => {
      totalTicksRef.current += 1;

      const cursorX = gazeRef.current.x * containerSize.width;
      const cursorY = gazeRef.current.y * containerSize.height;
      const alvoX = containerSize.width / 2 + targetPosRef.current.x;
      const alvoY = containerSize.height / 2 + targetPosRef.current.y;
      const distancia = Math.hypot(cursorX - alvoX, cursorY - alvoY);

      if (isTrackingRef.current && distancia <= TOLERANCIA_PX) {
        hitTicksRef.current += 1;
      }
      setPrecisaoAoVivo((hitTicksRef.current / totalTicksRef.current) * 100);
    }, INTERVALO_PONTUACAO_MS);

    return () => window.clearInterval(intervalId);
  }, [isRunning, containerSize.width, containerSize.height]);

  // Fim da sessão: regista a sessão no Supabase e abre o feedback final.
  // Guardado por finalizadoRef para correr uma única vez, exactamente quando
  // o cronómetro chega a 0 (nunca antes da sessão sequer ter começado).
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

    const registarSessao = async () => {
      if (!profile?.id) return; // sem sessão de utilizador -- nada a registar
      try {
        await sessoesExercicioApi.registar({
          exercicio_id: EXERCICIO_ID,
          pontuacao: score,
          precisao_percentual: precisaoPercentual,
          duracao_segundos: duracaoAtivaSegundos,
        });
      } catch (err) {
        // Falha de rede/autenticação não pode bloquear o ecrã de feedback
        // final -- o utilizador já terminou o exercício e quer ver o resultado.
        console.error("Falha ao registar sessão de exercício:", err);
      }
    };

    void registarSessao();
    openFeedback({
      context: "exercicio-tracking",
      question: "Como avalia o exercício de Acompanhamento em Oito?",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds]);

  const aindaNaoIniciou = remainingSeconds === duracaoSegundos;
  const podeCalibrar = !isRunning && remainingSeconds > 0;
  const mostrarSeletorDuracao = !isRunning && aindaNaoIniciou;

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
        {/* Vídeo oculto -- só serve para o FaceMesh ler os frames; a
            pré-visualização visível já é a do BaseExercise. */}
        <video ref={videoRef} autoPlay playsInline muted className="sr-only" />

        {isRunning && containerSize.width > 0 && (
          <>
            {/* Alvo (curva em oito) */}
            <div
              className="absolute top-1/2 left-1/2 h-7 w-7 rounded-full bg-navy shadow-elevated"
              style={{
                transform: `translate(-50%, -50%) translate(${targetPos.x}px, ${targetPos.y}px)`,
              }}
            />
            {/* Mira do olhar. Sem classes de transição de propósito -- a
                posição já vem suavizada pela EMA em useEyeTracking, e uma
                transição CSS por cima disso só acrescentava atraso extra
                e um efeito de "engasgo" quando a posição saltava. */}
            <div
              className="absolute top-0 left-0 h-9 w-9 rounded-full border-2 border-teal bg-teal/20 shadow-[0_0_16px_rgba(45,212,191,0.6)]"
              style={{
                transform: `translate(-50%, -50%) translate(${gaze.x * containerSize.width}px, ${gaze.y * containerSize.height}px)`,
                opacity: isTracking ? 0.9 : 0.25,
              }}
            />

            {/* Feedback flutuante de cada Hit ("+10", "+20 Combo x3!"). */}
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

        {!isRunning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {remainingSeconds === 0
                ? "Sessão concluída."
                : aindaNaoIniciou
                  ? "Escolha a duração, calibre o olhar a olhar para o centro e prima Iniciar."
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
                    Velocidade do alvo
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
              podeCalibrar && (
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
        <p>Siga o ponto com o olhar, sem mover a cabeça, ao longo da trajectória em forma de oito.</p>
        {precisaoAoVivo !== null && (
          <span className="font-semibold text-foreground">
            Precisão: {precisaoAoVivo.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
};

const TrackingExercise = () => {
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
            title="Acompanhamento em Oito"
            description="Siga o alvo com o olhar ao longo de uma trajectória em forma de oito."
            isPremium={false}
            durationSeconds={duracaoSegundos}
          >
            <TrackingGame duracaoSegundos={duracaoSegundos} onEscolherDuracao={setDuracaoSegundos} />
          </BaseExercise>
        </div>
      </main>
      <Footer />
      <FeedbackWidget />
    </div>
  );
};

export default TrackingExercise;
