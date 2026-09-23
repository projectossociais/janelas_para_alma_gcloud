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
import { Trans, useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { localizar } from "@/i18n/rotas";

const EXERCICIO_ID = "convergence";

// Mesmo hit-box e mecânica de combos do Acompanhamento em Oito -- ver
// TrackingExercise.tsx para a justificação de cada valor.
const TOLERANCIA_PX = 45;
const INTERVALO_PONTUACAO_MS = 200;
const COOLDOWN_HIT_MS = 1000;
const COMBO_TIMEOUT_MS = 2500;
const COMBO_PONTOS_BASE = 5;
const COMBO_PONTOS_MAX = 80;
// Duração do texto flutuante de feedback -- deve combinar com a animação
// "float-up-fade" definida em tailwind.config.ts.
const FEEDBACK_FLUTUANTE_DURACAO_MS = 1100;

// Pulsação do alvo: simula a aproximação/afastamento de um objecto ao nariz
// (o exercício clássico de convergência). Só o RAIO oscila -- a posição do
// alvo nunca se move do centro, porque o que se está a treinar é manter o
// olhar fixo apesar do tamanho aparente do alvo mudar.
const RAIO_MIN_PX = 24;
const RAIO_MAX_PX = 68;
const DURACAO_PULSO_MS = 2600; // duração de uma pulsação completa, à velocidade "Normal"
// Ângulo contínuo (nunca reiniciado por módulo), mesma lição aprendida no
// oito: sin()/cos() já são periódicos, um wrap manual é que introduz saltos.
const VELOCIDADE_ANGULAR_PULSO_BASE = (Math.PI * 2) / (DURACAO_PULSO_MS / 1000);

const raioNoPulso = (angulo: number) => {
  const raioMedio = (RAIO_MIN_PX + RAIO_MAX_PX) / 2;
  const amplitude = (RAIO_MAX_PX - RAIO_MIN_PX) / 2;
  return raioMedio + Math.sin(angulo) * amplitude;
};

const DURACOES_PREDEFINIDAS = [
  { label: "30s", segundos: 30 },
  { get label() {
    return i18n.t("ConvergenciaExercise.n1Min");
  }, segundos: 60 },
  { get label() {
    return i18n.t("ConvergenciaExercise.n15Min");
  }, segundos: 90 },
  { get label() {
    return i18n.t("ConvergenciaExercise.n2Min");
  }, segundos: 120 },
  { get label() {
    return i18n.t("ConvergenciaExercise.n3Min");
  }, segundos: 180 },
];
const DURACAO_CUSTOM_MIN_SEGUNDOS = 10;
const DURACAO_CUSTOM_MAX_SEGUNDOS = 900;

const VELOCIDADES = [
  { get label() {
    return i18n.t("ConvergenciaExercise.lento");
  }, multiplicador: 0.6 },
  { get label() {
    return i18n.t("ConvergenciaExercise.normal");
  }, multiplicador: 1 },
  { get label() {
    return i18n.t("ConvergenciaExercise.rapido");
  }, multiplicador: 1.6 },
];

// Gamificação: bandas de 50 pontos por nível (Nível 1: 0-49, Nível 2:
// 50-99, ...), até um patamar especial "Nível Mestre" a partir dos 1000.
// Mesma lógica de TrackingExercise.tsx, copiada para manter os dois
// exercícios consistentes.
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
      nome: i18n.t("ConvergenciaExercise.nivelMestre"),
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
    nome: i18n.t("ConvergenciaExercise.nivel", { numeroNivel }),
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

interface ConvergenciaGameProps {
  duracaoSegundos: number;
  onEscolherDuracao: (segundos: number) => void;
}

/**
 * O jogo em si. Isolado do wrapper para poder devolver cedo (sem chamar
 * useEyeTracking, e portanto sem pedir a câmara) quando o conteúdo está
 * bloqueado -- mesmo critério já usado pelo BaseExercise para a sua própria
 * pré-visualização da câmara.
 */
const ConvergenciaGame = ({ duracaoSegundos, onEscolherDuracao }: ConvergenciaGameProps) => {
  const { locked } = useExerciseSession();
  if (locked) return <div className="h-[350px]" />;
  return (
    <ConvergenciaGameAtivo
      duracaoSegundos={duracaoSegundos}
      onEscolherDuracao={onEscolherDuracao}
    />
  );
};

const ConvergenciaGameAtivo = ({
  duracaoSegundos,
  onEscolherDuracao,
}: ConvergenciaGameProps) => {
  const { t } = useTranslation();
  const { isRunning, score, remainingSeconds, addScore } = useExerciseSession();
  const { videoRef, gaze, isTracking, isCalibrating, calibrate, error } = useEyeTracking();
  const { profile } = useProfile();
  const { openFeedback } = useFeedback();

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [raioAtual, setRaioAtual] = useState(RAIO_MIN_PX);
  const [precisaoAoVivo, setPrecisaoAoVivo] = useState<number | null>(null);
  const [feedbacksFlutuantes, setFeedbacksFlutuantes] = useState<FeedbackFlutuante[]>([]);
  const [personalizarAberto, setPersonalizarAberto] = useState(false);
  const [duracaoCustomInput, setDuracaoCustomInput] = useState(String(duracaoSegundos));
  const [velocidadeIdx, setVelocidadeIdx] = useState(1); // "Normal" por omissão
  const velocidade = VELOCIDADES[velocidadeIdx].multiplicador;

  const gazeRef = useRef(gaze);
  const isTrackingRef = useRef(isTracking);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const hitTicksRef = useRef(0);
  const totalTicksRef = useRef(0);
  const finalizadoRef = useRef(false);

  // Estado do combo -- ver TrackingExercise.tsx para a mecânica completa de
  // cooldown/quebra de combo. `lastHitTimeRef` começa em 0 de propósito,
  // para que o primeiro Hit da sessão nunca seja bloqueado por nenhuma das
  // duas janelas de tempo.
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

  // Pulsa o alvo (aproxima/afasta) e, no mesmo frame, verifica o
  // cruzamento discreto do olhar com o centro (Hits + combo).
  useEffect(() => {
    if (!isRunning || containerSize.width === 0) {
      startTimeRef.current = 0;
      return;
    }

    const alvoX = containerSize.width / 2;
    const alvoY = containerSize.height / 2;

    const registarHit = (agora: number) => {
      // A janela de combo fechou sem um novo Hit -- falhou o cruzamento
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
          ? t("ConvergenciaExercise.comboX", { pontosGanhos, current: comboAtualRef.current })
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
      const angulo = elapsedSeconds * VELOCIDADE_ANGULAR_PULSO_BASE * velocidade;
      setRaioAtual(raioNoPulso(angulo));

      // Cruzamento válido: olhar dentro do hit-box do centro E fora do
      // cooldown desde o último Hit -- evita o efeito metralhadora de
      // tremores do olho, sem exigir sair e voltar a entrar.
      const cursorX = gazeRef.current.x * containerSize.width;
      const cursorY = gazeRef.current.y * containerSize.height;
      const distancia = Math.hypot(cursorX - alvoX, cursorY - alvoY);
      const agora = Date.now();

      if (
        isTrackingRef.current &&
        distancia <= TOLERANCIA_PX &&
        agora - lastHitTimeRef.current > COOLDOWN_HIT_MS
      ) {
        registarHit(agora);
      }

      rafRef.current = requestAnimationFrame(animar);
    };
    rafRef.current = requestAnimationFrame(animar);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isRunning, containerSize.width, containerSize.height, velocidade, addScore, t]);

  // Métrica de precisão a um ritmo fixo (tempo com o olhar no centro /
  // tempo total activo) -- independente da pontuação por Hits discretos
  // acima: esta é uma média contínua, não um evento único por cruzamento.
  useEffect(() => {
    if (!isRunning) return;

    const alvoX = containerSize.width / 2;
    const alvoY = containerSize.height / 2;

    const intervalId = window.setInterval(() => {
      totalTicksRef.current += 1;

      const cursorX = gazeRef.current.x * containerSize.width;
      const cursorY = gazeRef.current.y * containerSize.height;
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
      context: "exercicio-convergencia",
      question: t("ConvergenciaExercise.comoAvaliaOExercicio"),
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
                <Trans i18nKey="ConvergenciaExercise.pts" values={{ pontosNoNivel: nivelInfo.pontosNoNivel, pontosParaSubir: nivelInfo.pontosParaSubir }} />
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
            {/* Alvo pulsante (aproxima/afasta), sempre no centro */}
            <div
              className="absolute top-1/2 left-1/2 rounded-full bg-navy shadow-elevated"
              style={{
                width: raioAtual * 2,
                height: raioAtual * 2,
                transform: "translate(-50%, -50%)",
              }}
            />
            {/* Mira do olhar. Sem classes de transição de propósito -- a
                posição já vem suavizada pela EMA em useEyeTracking. */}
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
            {t("ConvergenciaExercise.rostoNaoDetectado")}
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
                ? t("ConvergenciaExercise.sessaoConcluida")
                : aindaNaoIniciou
                  ? t("ConvergenciaExercise.escolhaADuracaoCalibre")
                  : t("ConvergenciaExercise.emPausaPrimaIniciar")}
            </p>

            {mostrarSeletorDuracao && (
              <div className="flex flex-wrap items-start justify-center gap-6">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("ConvergenciaExercise.duracaoDaSessao")}
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
                      {t("ConvergenciaExercise.personalizar")}
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
                        aria-label={t("ConvergenciaExercise.duracaoPersonalizadaEmSegundos")}
                      />
                      <span className="text-xs text-muted-foreground">{t("ConvergenciaExercise.segundos")}</span>
                      <Button type="button" size="sm" onClick={aplicarDuracaoCustom}>
                        {t("ConvergenciaExercise.aplicar")}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("ConvergenciaExercise.velocidadeDaPulsacao")}
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
                  {isCalibrating ? t("ConvergenciaExercise.aCalibrar") : t("ConvergenciaExercise.calibrarOlhar")}
                </Button>
              )
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>{t("ConvergenciaExercise.mantenhaOOlharFixo")}</p>
        {precisaoAoVivo !== null && (
          <span className="font-semibold text-foreground">
            <Trans i18nKey="ConvergenciaExercise.precisao" values={{ valor: precisaoAoVivo.toFixed(0) }} />
          </span>
        )}
      </div>
    </div>
  );
};

const ConvergenciaExercise = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [duracaoSegundos, setDuracaoSegundos] = useState(DURACOES_PREDEFINIDAS[1].segundos);

  const handleVoltar = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(localizar("/exercicios"));
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-16">
        <div className="container max-w-4xl mx-auto">
          <Button variant="ghost" className="mb-6" onClick={handleVoltar}>
            <ArrowLeft className="w-4 h-4" />
            {t("ConvergenciaExercise.voltarAoMenu")}
          </Button>

          <BaseExercise
            title={t("ConvergenciaExercise.treinoDeConvergencia")}
            description={t("ConvergenciaExercise.mantenhaOOlharFixo2")}
            exercicioId={EXERCICIO_ID}
            grupo="trial"
            durationSeconds={duracaoSegundos}
          >
            <ConvergenciaGame
              duracaoSegundos={duracaoSegundos}
              onEscolherDuracao={setDuracaoSegundos}
            />
          </BaseExercise>
        </div>
      </main>
      <Footer />
      <FeedbackWidget />
    </div>
  );
};

export default ConvergenciaExercise;
