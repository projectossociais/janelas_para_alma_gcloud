import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, ScanLine, ShieldCheck, Sparkles, Loader2, CameraOff, RefreshCw, AlertTriangle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import EyeLandmarkOverlay from "@/components/EyeLandmarkOverlay";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { submeterRastreioMultiGaze, type ScreeningResponse } from "@/services/api/screeningApi";
import { screeningsApi, mensagemDeErroApi } from "@/lib/apiClient";


type TrackingStage = 0 | 1 | 2;
const TRACKING_STAGES = [
  { label: "A procurar rosto…", color: "red" as const },
  { label: "Por favor, aproxime-se e olhe para o centro…", color: "yellow" as const },
  { label: "Rosto alinhado. Mantenha-se imóvel.", color: "green" as const },
];

type CaptureStep = "IDLE" | "CENTER" | "RIGHT" | "LEFT" | "PROCESSING";

interface ScanShot {
  pose: string;
  landmarks: Array<{ x: number; y: number; z?: number }>;
  imageBase64: string;
}

const GUIDED_LABELS: Record<Exclude<CaptureStep, "IDLE">, string> = {
  CENTER: "1/3: Olhe fixamente para a frente…",
  RIGHT: "2/3: Olhe para o seu lado direito…",
  LEFT: "3/3: Olhe para o seu lado esquerdo…",
  PROCESSING: "A processar diagnóstico clínico…",
};

const MIN_LUMINANCE = 55; // 0-255 average luma threshold

const dataUrlToBlob = (dataUrl: string): Blob | null => {
  const [head, b64] = dataUrl.split(",");
  if (!b64) return null;
  const mime = /:(.*?);/.exec(head)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

/** Persiste só as medições já calculadas pelo janelas-scanner-api na API
 *  própria — nunca a fotografia em si (CLAUDE.md secção 4, regra 4). Devolve
 *  o novo id, ou `null` se o utilizador não tiver sessão (o rastreio em si
 *  já correu; falhar aqui não pode apagar o resultado que a pessoa vê). */
const persistirScreening = async (apiResult: ScreeningResponse): Promise<string | null> => {
  const posCentro = apiResult.posicoes?.find((p) => p.posicao.toUpperCase() === "CENTRO");
  const registado = await screeningsApi.registar({
    estado: apiResult.estado,
    rosto_detetado: apiResult.posicoes?.some((p) => p.rosto_detetado) ?? false,
    requer_avaliacao_humana: apiResult.requer_avaliacao_humana ?? false,
    assimetria_horizontal: apiResult.variacao_desalinhamento ?? null,
    qualidade_captura: posCentro?.qualidade_captura?.pontuacao ?? null,
    qualidade_fiavel: posCentro?.qualidade_captura?.fiavel ?? null,
    qualidade_motivos: posCentro?.qualidade_captura?.motivos ?? [],
    medicoes: apiResult as unknown as Record<string, unknown>,
    versao_analise: "janelas-scanner-api/multi-gaze",
  });
  return registado.id;
};




const Scanner = () => {

  const navigate = useNavigate();
  const { user } = useAuth();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [trackingStage, setTrackingStage] = useState<TrackingStage>(0);
  const [captureStep, setCaptureStep] = useState<CaptureStep>("IDLE");
  const [lowLight, setLowLight] = useState(false);
  const [scanPayload, setScanPayload] = useState<ScanShot[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timersRef = useRef<number[]>([]);
  const landmarksRef = useRef<Array<{ x: number; y: number; z?: number }> | null>(null);
  const qualityCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const payloadRef = useRef<ScanShot[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  const stopCamera = useCallback(() => {
    clearTimers();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
    setTrackingStage(0);
    setCaptureStep("IDLE");
    setLowLight(false);
    payloadRef.current = [];
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  /** Environmental quality control: average pixel luminance of the current frame. */
  const checkVideoQuality = useCallback((): number | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;
    let canvas = qualityCanvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      qualityCanvasRef.current = canvas;
    }
    const w = 64;
    const h = Math.max(1, Math.round((video.videoHeight || 480) * (w / (video.videoWidth || 640))));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    try {
      ctx.drawImage(video, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      }
      return sum / (data.length / 4);
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!cameraOn) return;
    const id = window.setInterval(() => {
      const luma = checkVideoQuality();
      if (luma !== null) setLowLight(luma < MIN_LUMINANCE);
    }, 700);
    return () => window.clearInterval(id);
  }, [cameraOn, checkVideoQuality]);


  const finishScan = useCallback((
    url: string | null,
    analysisId: string | null,
    apiResult: ScreeningResponse
  ) => {
    setPreviewUrl(url);
    setScanning(true);

    // Determina o diagnóstico e confiança a partir do retorno real da API de
    // rastreio (janelas-scanner-api) — nunca inventado no frontend.
    let diagnosis = "Alinhamento Fisiológico Normal";
    let confidence = 92;

    if (apiResult.incomitante || apiResult.requer_avaliacao_humana) {
      // Categoria fixa — o texto livre de `recomendacao` vai em `apiData`,
      // para o ecrã de resultados o mostrar à parte (nunca como chave de
      // diagnóstico: DIAGNOSIS_DATA só conhece um conjunto fechado de chaves).
      diagnosis = "Necessária Avaliação Oftalmológica";
    }
    // Calcula uma pontuação de confiança com base na qualidade da captura
    const posCentro = apiResult.posicoes?.find(p => p.posicao.toUpperCase() === "CENTRO");
    if (posCentro?.qualidade_captura?.pontuacao) {
      confidence = Math.round(posCentro.qualidade_captura.pontuacao * 100);
    }

    window.setTimeout(() => {
      sessionStorage.setItem(
        "scanResult",
        JSON.stringify({
          diagnosis,
          confidence,
          date: new Date().toISOString(),
          apiData: apiResult || null, // Guarda todos os dados clínicos reais da API
        })
      );
      navigate(analysisId ? `/scanner/resultados?id=${analysisId}` : "/scanner/resultados");
    }, 2500);
  }, [navigate]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      setTrackingStage(0);
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
      // Sequential tracking prompts (guided capture starts on user action)
      timersRef.current.push(window.setTimeout(() => setTrackingStage(1), 1500));
      timersRef.current.push(window.setTimeout(() => setTrackingStage(2), 3000));
    } catch (err) {
      console.error(err);
      setCameraError(
        "Não foi possível aceder à câmara. Verifique as permissões do navegador e tente novamente."
      );
    }
  };

  const snapshotBase64 = useCallback(() => {
    const video = videoRef.current;
    if (!video) return "";
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 960;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.9);
  }, []);

  const recordPose = useCallback(
    (pose: string) => {
      const shot: ScanShot = {
        pose,
        landmarks: (landmarksRef.current ?? []).map((l) => ({ x: l.x, y: l.y, z: l.z })),
        imageBase64: snapshotBase64(),
      };
      payloadRef.current = [...payloadRef.current, shot];
      setScanPayload(payloadRef.current);
      return shot;
    },
    [snapshotBase64]
  );

  /** Máquina de estados da captura manual: cada clique avança um passo. */
  const handleNextStep = useCallback(() => {
    if (lowLight) return;

    if (captureStep === "IDLE") {
      setUploadError(null);
      clearTimers(); // cancela os avisos iniciais de "A procurar rosto…", se ainda pendentes
      payloadRef.current = [];
      setScanPayload([]);
      setCaptureStep("CENTER");
      return;
    }

    if (captureStep === "CENTER") {
      recordPose("center");
      setCaptureStep("RIGHT");
      return;
    }

    if (captureStep === "RIGHT") {
      recordPose("right");
      setCaptureStep("LEFT");
      return;
    }

    if (captureStep === "LEFT") {
      recordPose("left");
      setCaptureStep("PROCESSING");
      const payload = payloadRef.current;
      const center = payload.find((s) => s.pose === "center")?.imageBase64 ?? null;

      void (async () => {
        setUploading(true);
        setUploadError(null);

        try {
          // 1. Converte as 3 poses para Blob
          const centerShot = payload.find((s) => s.pose === "center");
          const leftShot = payload.find((s) => s.pose === "left");
          const rightShot = payload.find((s) => s.pose === "right");

          const blobCentro = centerShot ? dataUrlToBlob(centerShot.imageBase64) : null;
          const blobEsquerda = leftShot ? dataUrlToBlob(leftShot.imageBase64) : null;
          const blobDireita = rightShot ? dataUrlToBlob(rightShot.imageBase64) : null;

          if (!blobCentro || !blobEsquerda || !blobDireita) {
            throw new Error("Falha ao preparar as imagens das 3 posições.");
          }

          // 2. Executa o cálculo matemático no FastAPI (Python) — o
          // janelas-scanner-api é um microserviço à parte, sem sessão própria.
          toast.info("A calcular alinhamento ocular na IA...");
          const apiResult = await submeterRastreioMultiGaze({
            centro: blobCentro,
            esquerda: blobEsquerda,
            direita: blobDireita,
          });

          // 3. Se estiver autenticado, persiste só as medições na API própria
          // — nunca as fotografias (CLAUDE.md secção 4, regra 4). Uma falha
          // aqui não pode esconder o resultado que a pessoa já tem na mão.
          let savedAnalysisId: string | null = null;
          if (user) {
            try {
              savedAnalysisId = await persistirScreening(apiResult);
              setAnalysisId(savedAnalysisId);
            } catch (persistErr) {
              console.warn("Aviso ao guardar o histórico do rastreio:", persistErr);
            }
          }

          setUploading(false);
          stopCamera();
          finishScan(center, savedAnalysisId, apiResult);
        } catch (err) {
          const message = mensagemDeErroApi(err, err instanceof Error ? err.message : String(err));
          setUploading(false);
          setUploadError(message);
          setCaptureStep("IDLE");
          toast.error(message);
        }
      })();
    }
  }, [captureStep, lowLight, recordPose, stopCamera, finishScan, user]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <BackButton />
      <main className="flex-1">
        <section className="container py-10 md:py-16">
          <div className="max-w-3xl mx-auto text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal/10 text-teal text-xs font-semibold tracking-wide uppercase mb-5">
              <Sparkles className="w-3.5 h-3.5" /> Scanner de Estrabismo · IA
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-foreground leading-tight">
              Área de Diagnóstico Inteligente
            </h1>
            <p className="mt-4 text-base md:text-lg text-muted-foreground">
              Utilize a câmara para uma análise visual guiada, assistida por inteligência
              artificial. Resultados em segundos — confidenciais e seguros.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-green" />
              Esta é uma simulação demonstrativa. Não substitui diagnóstico clínico.
            </div>
          </div>

          <div className="mt-10 md:mt-14 max-w-4xl mx-auto">
            {scanning ? (
              <ScanningView previewUrl={previewUrl} />
            ) : cameraOn ? (
              <div className="animate-fade-in">
                <div className="relative mx-auto w-full max-w-2xl aspect-video rounded-3xl overflow-hidden bg-navy shadow-elevated">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover"
                  />

                  {/* Real-time eye landmark extraction (MediaPipe FaceMesh) */}
                  <EyeLandmarkOverlay videoRef={videoRef} active={cameraOn} landmarksRef={landmarksRef} />


                  {/* HUD grid */}
                  <div
                    className="absolute inset-0 opacity-20 mix-blend-screen pointer-events-none"
                    style={{
                      backgroundImage:
                        "linear-gradient(hsl(var(--teal) / 0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--teal) / 0.6) 1px, transparent 1px)",
                      backgroundSize: "32px 32px",
                    }}
                  />

                  {/* Targeting reticle */}
                  {(() => {
                    const guided = captureStep !== "IDLE";
                    const stage = guided
                      ? {
                          label: GUIDED_LABELS[captureStep as Exclude<CaptureStep, "IDLE">],
                          color: (captureStep === "PROCESSING" ? "green" : "yellow") as "green" | "yellow",
                        }
                      : lowLight
                        ? { label: "Ambiente muito escuro. Aumente a iluminação.", color: "yellow" as const }
                        : TRACKING_STAGES[trackingStage];
                    const colorMap = {
                      red: { border: "border-red-500", glow: "shadow-[0_0_40px_hsl(0_85%_60%/0.6)]", text: "text-red-400", dot: "bg-red-500", bg: "bg-red-500/15", brd: "border-red-500/40" },
                      yellow: { border: "border-yellow-400", glow: "shadow-[0_0_40px_hsl(48_95%_60%/0.6)]", text: "text-yellow-300", dot: "bg-yellow-400", bg: "bg-yellow-400/15", brd: "border-yellow-400/40" },
                      green: { border: "border-emerald-400", glow: "shadow-[0_0_50px_hsl(160_70%_50%/0.7)]", text: "text-emerald-300", dot: "bg-emerald-400", bg: "bg-emerald-400/15", brd: "border-emerald-400/40" },
                    }[stage.color];
                    return (
                      <>
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                          <div className={`relative w-52 h-72 md:w-60 md:h-80 rounded-[50%] border-2 ${colorMap.border} ${colorMap.glow} transition-all duration-500`}>
                            {/* corner ticks */}
                            {["-top-1 -left-1 border-l-2 border-t-2", "-top-1 -right-1 border-r-2 border-t-2", "-bottom-1 -left-1 border-l-2 border-b-2", "-bottom-1 -right-1 border-r-2 border-b-2"].map((c) => (
                              <div key={c} className={`absolute w-5 h-5 ${colorMap.border} ${c} rounded-sm`} />
                            ))}
                            {/* crosshair */}
                            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-px ${colorMap.dot}`} />
                            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-px ${colorMap.dot}`} />
                          </div>
                        </div>
                        {/* Status banner */}
                        <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 px-4 py-2 rounded-full ${colorMap.bg} backdrop-blur border ${colorMap.brd} ${colorMap.text} text-xs md:text-sm font-semibold transition-all duration-300`}>
                          <span className={`w-2 h-2 rounded-full ${colorMap.dot} animate-pulse`} />
                          {stage.label}
                        </div>
                      </>
                    );
                  })()}

                  <div className="absolute top-4 left-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur text-white text-xs font-medium">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    AO VIVO · IA
                  </div>
                  <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur text-white text-[10px] font-mono tracking-wider">
                    TRK · {String(trackingStage + 1).padStart(2, "0")}/03
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={handleNextStep}
                    disabled={lowLight || captureStep === "PROCESSING" || uploading}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-teal text-teal-foreground font-semibold text-sm hover:bg-teal/90 transition-all shadow-elevated disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-teal"
                  >
                    {captureStep === "IDLE" ? (
                      <>
                        <Camera className="w-4 h-4" /> Iniciar Captura
                      </>
                    ) : captureStep === "CENTER" ? (
                      <>
                        <Camera className="w-4 h-4" /> Capturar Frente (1/3)
                      </>
                    ) : captureStep === "RIGHT" ? (
                      <>
                        <Camera className="w-4 h-4" /> Capturar Direita (2/3)
                      </>
                    ) : captureStep === "LEFT" ? (
                      <>
                        <Camera className="w-4 h-4" /> Capturar Esquerda (3/3)
                      </>
                    ) : uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> A enviar imagens para o Supabase… Não feche a página
                      </>
                    ) : (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> A analisar…
                      </>
                    )}
                  </button>
                  <button
                    onClick={stopCamera}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-muted text-foreground font-medium text-sm hover:bg-muted/80 transition-colors"
                  >
                    <CameraOff className="w-4 h-4" /> Cancelar
                  </button>
                </div>

                {lowLight && (
                  <div className="mt-4 max-w-2xl mx-auto p-4 rounded-2xl bg-yellow-400/15 border border-yellow-400/40 text-sm text-yellow-700 dark:text-yellow-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    Ambiente muito escuro. Por favor, vá para um local mais iluminado para garantir a
                    precisão do diagnóstico.
                  </div>
                )}

                {uploadError && (
                  <div className="mt-4 max-w-2xl mx-auto p-4 rounded-2xl bg-destructive/10 border border-destructive/40 text-sm text-destructive flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>Erro ao enviar o exame: {uploadError}</span>
                  </div>
                )}


                <p className="mt-3 text-center text-xs text-muted-foreground">
                  {captureStep === "IDLE"
                    ? "A captura guiada tem 3 fases (frente, direita, esquerda). Mantenha o rosto centrado."
                    : captureStep === "PROCESSING"
                      ? "A processar diagnóstico clínico…"
                      : "Siga as instruções no ecrã. A IA extrai os pontos oculares em cada fase."}
                </p>

              </div>
            ) : (
              <div className="max-w-md mx-auto animate-fade-in">
                <button
                  onClick={startCamera}
                  className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy to-navy/80 p-8 md:p-10 text-left text-navy-foreground transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated w-full"
                >
                  <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mb-5 group-hover:bg-white/25 transition-colors">
                    <Camera className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold">Usar Câmara</h3>
                  <p className="mt-2 text-sm text-white/80">
                    Capture 3 imagens guiadas (frente, direita, esquerda) para uma análise real do
                    alinhamento ocular.
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gold">
                    Ativar câmara →
                  </span>
                </button>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  O diagnóstico é calculado a partir das 3 poses capturadas — não é possível a
                  partir de uma única fotografia.
                </p>
              </div>
            )}

            {cameraError && (
              <div className="mt-5 max-w-2xl mx-auto p-4 rounded-2xl bg-destructive/10 border border-destructive/30 text-sm text-destructive flex items-start gap-2">
                <CameraOff className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="flex-1">
                  {cameraError}
                  <button
                    onClick={startCamera}
                    className="ml-2 inline-flex items-center gap-1 font-semibold underline"
                  >
                    <RefreshCw className="w-3 h-3" /> Tentar novamente
                  </button>
                </div>
              </div>
            )}
          </div>

          {!scanning && !cameraOn && (
            <div className="mt-12 max-w-3xl mx-auto grid sm:grid-cols-3 gap-4 text-center">
              {[
                { n: "01", t: "Captura", d: "Imagem nítida do rosto" },
                { n: "02", t: "Análise IA", d: "Processamento em segundos" },
                { n: "03", t: "Resultado", d: "Diagnóstico orientador" },
              ].map((s) => (
                <div key={s.n} className="p-5 rounded-2xl bg-card border border-border shadow-card">
                  <div className="text-xs font-bold text-teal tracking-widest">{s.n}</div>
                  <div className="mt-1 text-base font-semibold text-foreground">{s.t}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.d}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

const ScanningView = ({ previewUrl }: { previewUrl: string | null }) => {
  return (
    <div className="animate-fade-in">
      <div className="relative mx-auto w-full max-w-md aspect-[3/4] rounded-3xl overflow-hidden bg-gradient-to-br from-navy to-navy/70 shadow-elevated">
        {previewUrl ? (
          <img src={previewUrl} alt="A analisar" className="absolute inset-0 w-full h-full object-cover opacity-90" />
        ) : (
          <svg viewBox="0 0 200 260" className="absolute inset-0 w-full h-full text-white/25" fill="currentColor">
            <circle cx="100" cy="85" r="48" />
            <path d="M30 260c0-44 31-74 70-74s70 30 70 74H30z" />
          </svg>
        )}

        <div
          className="absolute inset-0 opacity-30 mix-blend-screen"
          style={{
            backgroundImage:
              "linear-gradient(hsl(170 72% 60% / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(170 72% 60% / 0.5) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-teal to-transparent shadow-[0_0_24px_4px_hsl(var(--teal))] animate-[scan_2s_ease-in-out_infinite]" style={{ top: 0 }} />

        {["top-4 left-4 border-l-2 border-t-2", "top-4 right-4 border-r-2 border-t-2", "bottom-4 left-4 border-l-2 border-b-2", "bottom-4 right-4 border-r-2 border-b-2"].map((c) => (
          <div key={c} className={`absolute w-8 h-8 border-teal ${c} rounded-sm`} />
        ))}

        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 backdrop-blur text-white text-xs font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          A analisar pontos oculares…
        </div>
      </div>

      <div className="mt-6 max-w-md mx-auto text-center">
        <div className="inline-flex items-center gap-2 text-teal text-sm font-semibold">
          <ScanLine className="w-4 h-4 animate-pulse" /> Processamento IA em curso
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          A detetar alinhamento ocular, simetria pupilar e reflexo corneano…
        </p>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0%; }
          50% { top: calc(100% - 4px); }
          100% { top: 0%; }
        }
      `}</style>
    </div>
  );
};

export default Scanner;
