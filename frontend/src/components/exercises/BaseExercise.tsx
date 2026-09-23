import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/contexts/ProfileContext";
import { Clock, Lock, LogOut, Pause, Play, Sparkles, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { localizar } from "@/i18n/rotas";

const DURACAO_PADRAO_SEGUNDOS = 5 * 60; // 5 minutos

const formatarTempo = (totalSegundos: number): string => {
  const minutos = Math.floor(totalSegundos / 60)
    .toString()
    .padStart(2, "0");
  const segundos = (totalSegundos % 60).toString().padStart(2, "0");
  return `${minutos}:${segundos}`;
};

interface ExerciseSessionContextValue {
  /** Pontuação acumulada nesta sessão. */
  score: number;
  /** O jogo (children) chama isto para somar pontos. */
  addScore: (pontos: number) => void;
  /** Repõe a pontuação a zero (ex.: ao reiniciar o jogo). */
  resetScore: () => void;
  /** True enquanto o cronómetro está a contar (não pausado, não bloqueado). */
  isRunning: boolean;
  /** Segundos restantes até ao fim da sessão. */
  remainingSeconds: number;
  /** True se o conteúdo está atrás do paywall -- o jogo pode usar isto para
   * pausar a sua própria lógica interna também. */
  locked: boolean;
}

const ExerciseSessionContext = createContext<ExerciseSessionContextValue | undefined>(
  undefined,
);

/** Hook para o jogo (children) reportar pontuação e ler o estado da sessão. */
export const useExerciseSession = (): ExerciseSessionContextValue => {
  const ctx = useContext(ExerciseSessionContext);
  if (!ctx) {
    throw new Error("useExerciseSession deve ser usado dentro de <BaseExercise>.");
  }
  return ctx;
};

interface BaseExerciseProps {
  title: string;
  description: string;
  /** Se true, exige `profile.premium_ativo` (ou papel `admin`). */
  isPremium?: boolean;
  /** Duração da sessão, em segundos. Por omissão, 5 minutos. */
  durationSeconds?: number;
  /** O jogo em si. */
  children: ReactNode;
}

/**
 * Casca genérica para os exercícios visuais: cabeçalho com título/saída,
 * barra de sessão (tempo restante, pontuação, iniciar/pausar), bloqueio de
 * conteúdo premium, e um canto com a pré-visualização da câmara.
 *
 * O jogo passado em `children` não precisa de gerir o seu próprio
 * cronómetro/pontuação -- pode consumir `useExerciseSession()` para somar
 * pontos e saber se a sessão está a decorrer.
 */
const BaseExercise = ({
  title,
  description,
  isPremium = false,
  durationSeconds = DURACAO_PADRAO_SEGUNDOS,
  children,
}: BaseExerciseProps) => {
  const { t } = useTranslation();
  const { profile } = useProfile();

  const locked = isPremium && !(profile && (profile.premium_ativo || profile.papel === "admin"));

  const [isRunning, setIsRunning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(durationSeconds);
  const [score, setScore] = useState(0);

  const addScore = (pontos: number) => setScore((prev) => prev + pontos);
  const resetScore = () => setScore(0);

  // `durationSeconds` só é lido no useState acima na primeira renderização.
  // Se o exercício oferecer um seletor de duração antes de o utilizador
  // premir "Iniciar" (ex.: TrackingExercise), este efeito mantém o
  // cronómetro sincronizado com a escolha -- mas só até à sessão arrancar
  // pela primeira vez, para nunca alterar o tempo restante de uma sessão
  // já em curso ou pausada a meio.
  const jaIniciouRef = useRef(false);
  useEffect(() => {
    if (isRunning) jaIniciouRef.current = true;
  }, [isRunning]);
  useEffect(() => {
    if (!jaIniciouRef.current) setRemainingSeconds(durationSeconds);
  }, [durationSeconds]);

  // Cronómetro. Não depende de `remainingSeconds` no array de deps -- usa a
  // forma funcional do setState -- para não recriar o interval a cada
  // segundo, e limpa sempre o interval na pausa/desmontagem.
  useEffect(() => {
    if (!isRunning || locked) return;

    const intervalId = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isRunning, locked]);

  const toggleRunning = () => {
    if (locked || remainingSeconds === 0) return;
    setIsRunning((prev) => !prev);
  };

  // --- Câmara ---------------------------------------------------------
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [erroWebcam, setErroWebcam] = useState<string | null>(null);

  useEffect(() => {
    if (locked) return; // não pede a câmara a quem ainda não tem acesso

    let cancelado = false;

    const iniciarWebcam = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErroWebcam(t("BaseExercise.camaraNaoSuportadaNeste"));
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelado) {
          // O componente desmontou (ou ficou bloqueado) enquanto o pedido de
          // permissão estava pendente -- fecha o stream imediatamente para
          // não deixar a luz da câmara acesa sem necessidade.
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        if (!cancelado) setErroWebcam(t("BaseExercise.naoFoiPossivelAceder"));
      }
    };

    iniciarWebcam();

    return () => {
      cancelado = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [locked, t]);

  const sessionValue: ExerciseSessionContextValue = {
    score,
    addScore,
    resetScore,
    isRunning,
    remainingSeconds,
    locked,
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
      {/* 1. Cabeçalho */}
      <div className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-foreground">{title}</h2>
          <p className="truncate text-sm text-muted-foreground">{description}</p>
        </div>
        <Button variant="ghost" size="sm" asChild className="shrink-0 gap-2">
          <Link to={localizar("/exercicios")} aria-label={t("BaseExercise.sairDoExercicio")}>
            <LogOut className="h-4 w-4" />
            {t("BaseExercise.sair")}
          </Link>
        </Button>
      </div>

      {/* 2. Barra de sessão: tempo, pontuação, iniciar/pausar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/30 px-5 py-3">
        <div className="flex items-center gap-4">
          <div
            className="flex items-center gap-1.5 text-sm font-semibold text-foreground"
            aria-label={t("BaseExercise.tempoRestante", { valor: formatarTempo(remainingSeconds) })}
          >
            <Clock className="h-4 w-4 text-teal" />
            <span className="tabular-nums">{formatarTempo(remainingSeconds)}</span>
          </div>
          <div
            className="flex items-center gap-1.5 text-sm font-semibold text-foreground"
            aria-label={t("BaseExercise.pontuacaoActual", { score })}
          >
            <Trophy className="h-4 w-4 text-gold" />
            <span className="tabular-nums">{score}</span>
          </div>
        </div>
        <Button
          size="sm"
          onClick={toggleRunning}
          disabled={locked || remainingSeconds === 0}
          className="gap-2 bg-teal text-teal-foreground hover:bg-teal/90"
        >
          {isRunning ? (
            <>
              <Pause className="h-4 w-4" />
              {t("BaseExercise.pausar")}
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              {t("BaseExercise.iniciar")}
            </>
          )}
        </Button>
      </div>

      {/* 3. Conteúdo (jogo + câmara), com 4. o bloqueio premium por cima */}
      <div className="relative">
        <div className={locked ? "pointer-events-none select-none blur-sm" : undefined}>
          <ExerciseSessionContext.Provider value={sessionValue}>
            {children}
          </ExerciseSessionContext.Provider>

          {/* Canto com a pré-visualização da câmara */}
          <div
            className="pointer-events-none absolute bottom-3 right-3 h-28 w-28 overflow-hidden rounded-xl border-2 border-background bg-navy shadow-elevated sm:h-36 sm:w-36"
            aria-label={t("BaseExercise.preVisualizacaoDaCamara")}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            {erroWebcam && (
              <div className="absolute inset-0 flex items-center justify-center bg-navy/90 p-2 text-center text-[10px] text-primary-foreground">
                {erroWebcam}
              </div>
            )}
          </div>
        </div>

        {locked && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/40 p-6 backdrop-blur-sm">
            <div className="max-w-sm rounded-2xl border border-border/60 bg-card p-6 text-center shadow-elevated">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal to-navy shadow-elevated">
                <Lock className="h-7 w-7 text-primary-foreground" />
              </div>
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-teal">
                {t("BaseExercise.conteudoPremium")}
              </p>
              <h3 className="mb-2 text-lg font-bold text-foreground">
                {t("BaseExercise.facaUpgradeParaDesbloquear")}
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                {t("BaseExercise.esteExercicioEstaDisponivel")}
              </p>
              <Button
                asChild
                className="w-full gap-2 bg-gradient-to-r from-teal to-navy text-primary-foreground hover:opacity-90"
              >
                <Link to={localizar("/registo-premium")}>
                  <Sparkles className="h-4 w-4" />
                  {t("BaseExercise.desbloquearAcessoPremium")}
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BaseExercise;
