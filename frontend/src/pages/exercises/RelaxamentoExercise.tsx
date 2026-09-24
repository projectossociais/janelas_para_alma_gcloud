import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
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

const EXERCICIO_ID = "relax";

const DURACOES_PREDEFINIDAS = [
  { label: "30s", segundos: 30 },
  { get label() {
    return i18n.t("RelaxamentoExercise.n1Min");
  }, segundos: 60 },
  { get label() {
    return i18n.t("RelaxamentoExercise.n15Min");
  }, segundos: 90 },
  { get label() {
    return i18n.t("RelaxamentoExercise.n2Min");
  }, segundos: 120 },
  { get label() {
    return i18n.t("RelaxamentoExercise.n3Min");
  }, segundos: 180 },
];
const DURACAO_CUSTOM_MIN_SEGUNDOS = 10;
const DURACAO_CUSTOM_MAX_SEGUNDOS = 900;

// Ciclo de respiração guiada 4-7-8 (Inspire 4s / Sustenha 7s / Expire 8s),
// uma técnica clássica de relaxamento. Roda continuamente enquanto a
// sessão decorre -- ver o requestAnimationFrame em "animar".
const FASES_RESPIRACAO = [
  { get nome() {
    return i18n.t("RelaxamentoExercise.inspire");
  } },
  { get nome() {
    return i18n.t("RelaxamentoExercise.sustenha");
  } },
  { get nome() {
    return i18n.t("RelaxamentoExercise.expire");
  } },
] as const;
const DURACOES_FASE_MS = [4000, 7000, 8000] as const;
const CICLO_RESPIRACAO_MS = DURACOES_FASE_MS.reduce((soma, ms) => soma + ms, 0);

const ORBE_ESCALA_MIN = 1;
const ORBE_ESCALA_MAX = 1.55;

/** Suavização smoothstep -- a orbe acelera e desacelera em vez de crescer
 * a ritmo constante, mais próximo de uma respiração real. */
const suavizar = (p: number) => p * p * (3 - 2 * p);

interface FaseRespiracaoAtual {
  nome: string;
  escala: number;
}

const calcularFaseRespiracao = (elapsedMs: number): FaseRespiracaoAtual => {
  const t = elapsedMs % CICLO_RESPIRACAO_MS;
  let acumulado = 0;
  for (let i = 0; i < FASES_RESPIRACAO.length; i++) {
    const duracaoFase = DURACOES_FASE_MS[i];
    if (t < acumulado + duracaoFase) {
      const progresso = suavizar((t - acumulado) / duracaoFase);
      const escala =
        i === 0
          ? ORBE_ESCALA_MIN + (ORBE_ESCALA_MAX - ORBE_ESCALA_MIN) * progresso // Inspire: cresce
          : i === 1
            ? ORBE_ESCALA_MAX // Sustenha: mantém
            : ORBE_ESCALA_MAX - (ORBE_ESCALA_MAX - ORBE_ESCALA_MIN) * progresso; // Expire: encolhe
      return { nome: FASES_RESPIRACAO[i].nome, escala };
    }
    acumulado += duracaoFase;
  }
  return { nome: FASES_RESPIRACAO[0].nome, escala: ORBE_ESCALA_MIN };
};

interface RelaxamentoGameProps {
  duracaoSegundos: number;
  onEscolherDuracao: (segundos: number) => void;
}

/**
 * O exercício em si. Isolado do wrapper para poder devolver cedo (sem
 * chamar useEyeTracking, e portanto sem pedir a câmara) quando o conteúdo
 * está bloqueado -- mesmo critério já usado pelo BaseExercise para a sua
 * própria pré-visualização da câmara.
 */
const RelaxamentoGame = ({ duracaoSegundos, onEscolherDuracao }: RelaxamentoGameProps) => {
  const { locked } = useExerciseSession();
  if (locked) return <div className="h-[420px]" />;
  return (
    <RelaxamentoGameAtivo
      duracaoSegundos={duracaoSegundos}
      onEscolherDuracao={onEscolherDuracao}
    />
  );
};

const RelaxamentoGameAtivo = ({ duracaoSegundos, onEscolherDuracao }: RelaxamentoGameProps) => {
  const { t } = useTranslation();
  const { isRunning, remainingSeconds } = useExerciseSession();
  // Uso passivo: só isTracking interessa aqui (detectar Palming), nunca se
  // desenha o gaze nem se pede calibração -- este exercício não tem alvo
  // nenhum para apontar.
  const { videoRef, isTracking, error } = useEyeTracking();
  const { profile } = useProfile();
  const { openFeedback } = useFeedback();

  const [faseAtual, setFaseAtual] = useState<FaseRespiracaoAtual>({
    nome: FASES_RESPIRACAO[0].nome,
    escala: ORBE_ESCALA_MIN,
  });
  const [personalizarAberto, setPersonalizarAberto] = useState(false);
  const [duracaoCustomInput, setDuracaoCustomInput] = useState(String(duracaoSegundos));

  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const finalizadoRef = useRef(false);

  // Roda o ciclo de respiração continuamente enquanto a sessão decorre --
  // independente de os olhos estarem a ser detectados. A respiração não
  // pára só porque o utilizador fechou/cobriu os olhos (Palming); é
  // precisamente aí que mais interessa continuar a respirar fundo.
  useEffect(() => {
    if (!isRunning) {
      startTimeRef.current = 0;
      return;
    }

    const animar = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsedMs = timestamp - startTimeRef.current;
      setFaseAtual(calcularFaseRespiracao(elapsedMs));
      rafRef.current = requestAnimationFrame(animar);
    };
    rafRef.current = requestAnimationFrame(animar);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isRunning]);

  // Fim da sessão: regista apenas a duração no Supabase -- sem pontuação,
  // este exercício não compete, é só para relaxar -- e abre o feedback
  // final. Guardado por finalizadoRef para correr uma única vez,
  // exactamente quando o cronómetro chega a 0.
  useEffect(() => {
    if (remainingSeconds !== 0 || finalizadoRef.current) return;
    finalizadoRef.current = true;

    const registarSessao = async () => {
      if (!profile?.id) return; // sem sessão de utilizador -- nada a registar
      try {
        await sessoesExercicioApi.registar({
          exercicio_id: EXERCICIO_ID,
          duracao_segundos: duracaoSegundos,
        });
      } catch (err) {
        // Falha de rede/autenticação não pode bloquear o ecrã de feedback
        // final -- o utilizador já terminou o exercício e quer ver o resultado.
        console.error("Falha ao registar sessão de exercício:", err);
      }
    };

    void registarSessao();
    openFeedback({
      context: "exercicio-relaxamento",
      question: t("RelaxamentoExercise.comoAvaliaOExercicio"),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds]);

  const aindaNaoIniciou = remainingSeconds === duracaoSegundos;
  const mostrarSeletorDuracao = !isRunning && aindaNaoIniciou;
  // Modo Palming: só entra em "modo noturno" se a câmara estiver
  // efectivamente a funcionar e simplesmente não detectar olhos (o
  // utilizador cobriu-os ou fechou-os) -- uma falha genuína da câmara
  // (`error`) não deve ser confundida com Palming.
  const modoPalming = isRunning && !isTracking && !error;

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
      <div
        className="relative flex h-[420px] flex-col items-center justify-center gap-6 overflow-hidden rounded-xl border border-border transition-colors duration-700"
        style={{
          backgroundColor: modoPalming ? "hsl(222 47% 6%)" : "hsl(var(--muted) / 0.3)",
        }}
      >
        {/* Vídeo oculto -- só serve para o FaceMesh ler os frames; nunca é
            mostrado nem se desenha qualquer cursor a partir dele aqui. */}
        <video ref={videoRef} autoPlay playsInline muted className="sr-only" />

        {isRunning && (
          <>
            {/* Área da orbe: tamanho fixo, em fluxo normal (flex), para o
                texto por baixo se posicionar sozinho via gap -- o halo e o
                núcleo é que ficam absolutamente centrados dentro dela. */}
            <div className="relative" style={{ width: 220, height: 220 }}>
              {/* Halo de glow por trás da orbe -- muito blur, decorativo. */}
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
                style={{
                  width: 220,
                  height: 220,
                  transform: `translate(-50%, -50%) scale(${faseAtual.escala})`,
                  background: "radial-gradient(circle, hsl(var(--teal) / 0.55) 0%, transparent 70%)",
                  filter: "blur(30px)",
                  opacity: modoPalming ? 0.25 : 0.9,
                  transition: "opacity 700ms ease",
                }}
              />
              {/* Núcleo da orbe -- gradiente suave teal/navy. Só `opacity`
                  tem transição CSS (para o modo Palming); a `transform`
                  (escala) é 100% controlada pelo requestAnimationFrame
                  acima, para nunca "lutar" com CSS. */}
              <div
                className="absolute left-1/2 top-1/2 rounded-full"
                style={{
                  width: 140,
                  height: 140,
                  transform: `translate(-50%, -50%) scale(${faseAtual.escala})`,
                  background: "radial-gradient(circle at 35% 30%, hsl(var(--teal)) 0%, hsl(var(--navy)) 80%)",
                  filter: "blur(3px)",
                  boxShadow: "0 0 40px 8px hsl(var(--teal) / 0.35)",
                  opacity: modoPalming ? 0.5 : 1,
                  transition: "opacity 700ms ease",
                }}
              />
            </div>

            <p
              className="relative z-10 text-center text-lg font-semibold transition-colors duration-700"
              style={{ color: modoPalming ? "hsl(var(--teal-foreground))" : "hsl(var(--foreground))" }}
            >
              {modoPalming ? t("RelaxamentoExercise.olhosCobertosRelaxeE") : faseAtual.nome}
            </p>
          </>
        )}

        {!isRunning && (
          <div className="flex flex-col items-center gap-4 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {remainingSeconds === 0
                ? t("RelaxamentoExercise.sessaoConcluida")
                : aindaNaoIniciou
                  ? t("RelaxamentoExercise.escolhaADuracaoE")
                  : t("RelaxamentoExercise.emPausaPrimaIniciar")}
            </p>

            {mostrarSeletorDuracao && (
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("RelaxamentoExercise.duracaoDaSessao")}
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
                    {t("RelaxamentoExercise.personalizar")}
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
                      aria-label={t("RelaxamentoExercise.duracaoPersonalizadaEmSegundos")}
                    />
                    <span className="text-xs text-muted-foreground">{t("RelaxamentoExercise.segundos")}</span>
                    <Button type="button" size="sm" onClick={aplicarDuracaoCustom}>
                      {t("RelaxamentoExercise.aplicar")}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-muted-foreground">
        <p>
          {t("RelaxamentoExercise.sincronizeARespiracaoCom")}
        </p>
        {error && <p className="mt-1 text-destructive"><Trans i18nKey="RelaxamentoExercise.aRespiracaoGuiadaFunciona" values={{ error }} /></p>}
      </div>
    </div>
  );
};

const RelaxamentoExercise = () => {
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
            {t("RelaxamentoExercise.voltarAoMenu")}
          </Button>

          <BaseExercise
            title={t("RelaxamentoExercise.relaxamentoERespiracao")}
            description={t("RelaxamentoExercise.sincronizeARespiracaoCom2")}
            exercicioId={EXERCICIO_ID}
            grupo="trial"
            durationSeconds={duracaoSegundos}
          >
            <RelaxamentoGame
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

export default RelaxamentoExercise;
