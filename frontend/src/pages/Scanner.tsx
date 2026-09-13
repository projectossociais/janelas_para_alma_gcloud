import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Camera, ScanLine, ShieldCheck, Sparkles, Loader2, CameraOff, RefreshCw, AlertTriangle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import EyeLandmarkOverlay from "@/components/EyeLandmarkOverlay";
import { useAuth } from "@/contexts/AuthContext";
import { screeningsApi, mensagemDeErroApi, type PoseLandmarksInput } from "@/lib/apiClient";
import { toast } from "sonner";


type TrackingStage = 0 | 1 | 2;
const TRACKING_STAGES = [
  { label: "A procurar rosto…", color: "red" as const },
  { label: "Por favor, aproxime-se e olhe para o centro…", color: "yellow" as const },
  { label: "Rosto alinhado. Mantenha-se imóvel.", color: "green" as const },
];

type CaptureStep = "IDLE" | "CENTER" | "RIGHT" | "LEFT" | "PROCESSING";

type Pose = "center" | "right" | "left";

interface ScanShot {
  pose: Pose;
  landmarks: Array<{ x: number; y: number; z?: number }>;
  imageBase64: string;
}

const GUIDED_LABELS: Record<Exclude<CaptureStep, "IDLE">, string> = {
  CENTER: "1/3: Olhe fixamente para a frente…",
  RIGHT: "2/3: Olhe para o seu lado direito…",
  LEFT: "3/3: Olhe para o seu lado esquerdo…",
  PROCESSING: "A preparar o resumo da sessão…",
};

/** Resultado honesto de uma sessão: nenhum campo aqui é um diagnóstico nem uma
 * métrica de confiança calculada — apenas o que foi de facto capturado. Ver
 * CLAUDE.md secção 11 (W-04): "nenhum ecrã apresenta um resultado clínico que
 * não tenha sido calculado a partir de medições reais". */
interface ScanResult {
  capturedAt: string;
  method: "camera" | "upload";
  posesCapturadas: string[];
  analysisId: string | null;
}

const MIN_LUMINANCE = 55; // 0-255 average luma threshold

/** Envia só coordenadas (landmarks) à API — nunca a imagem em si (CLAUDE.md
 * secção 4b). A API calcula o sinal geométrico experimental e devolve o
 * `id` do registo (ver `docs/SCANNER-METODO.md`, W-13/W-15). */
const submitScreening = async (
  shots: ScanShot[],
  ambienteEscuroEmAlgumMomento: boolean
): Promise<string> => {
  const poses: PoseLandmarksInput[] = shots.map((shot) => ({
    pose: shot.pose,
    landmarks: shot.landmarks,
  }));
  const resultado = await screeningsApi.criar({
    poses,
    ambiente_escuro_em_algum_momento: ambienteEscuroEmAlgumMomento,
  });
  return resultado.id;
};




/** Route guard: no scanner UI, camera or capture state exists before a session is confirmed. */
const Scanner = () => {
  const navigate = useNavigate();
  const { isLoggedIn, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      navigate("/auth?next=/scanner", { replace: true });
    }
  }, [loading, isLoggedIn, navigate]);

  if (loading || !isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <div className="flex-1 flex items-center justify-center gap-3 text-foreground/70">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">A verificar a sua sessão…</span>
        </div>
        <Footer />
      </div>
    );
  }

  return <ScannerContent />;
};

const ScannerContent = () => {

  const navigate = useNavigate();
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timersRef = useRef<number[]>([]);
  const landmarksRef = useRef<Array<{ x: number; y: number; z?: number }> | null>(null);
  const qualityCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const payloadRef = useRef<ScanShot[]>([]);
  const escureceuDuranteCapturaRef = useRef(false);

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

  // Sinal de qualidade honesto reportado à API (ver `screening_service.py`):
  // regista se o ambiente ficou escuro em qualquer momento da captura
  // guiada, não só no instante do envio.
  useEffect(() => {
    if (captureStep !== "IDLE" && lowLight) {
      escureceuDuranteCapturaRef.current = true;
    }
  }, [captureStep, lowLight]);


  const finishScan = useCallback(
    (url: string | null, options: { method: ScanResult["method"]; poses: string[]; analysisId?: string | null }) => {
      setPreviewUrl(url);
      setScanning(true);
      const { method, poses, analysisId = null } = options;
      window.setTimeout(() => {
        const result: ScanResult = {
          capturedAt: new Date().toISOString(),
          method,
          posesCapturadas: poses,
          analysisId,
        };
        sessionStorage.setItem("scanResult", JSON.stringify(result));
        navigate(analysisId ? `/scanner/resultados?id=${analysisId}` : "/scanner/resultados");
      }, 3000);
    },
    [navigate]
  );

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    finishScan(URL.createObjectURL(file), { method: "upload", poses: [] });
  };


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
    (pose: Pose) => {
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

  const startGuidedCapture = useCallback(() => {
    if (captureStep !== "IDLE" || lowLight) return;
    setUploadError(null);
    clearTimers();

    payloadRef.current = [];
    setScanPayload([]);
    escureceuDuranteCapturaRef.current = false;
    setCaptureStep("CENTER");

    timersRef.current.push(
      window.setTimeout(() => {
        recordPose("center");
        setCaptureStep("RIGHT");
      }, 4000)
    );
    timersRef.current.push(
      window.setTimeout(() => {
        recordPose("right");
        setCaptureStep("LEFT");
      }, 8000)
    );
    timersRef.current.push(
      window.setTimeout(() => {
        void (async () => {
          recordPose("left");
          setCaptureStep("PROCESSING");
          setUploading(true);
          setUploadError(null);
          const payload = payloadRef.current;
          const center = payload.find((s) => s.pose === "center")?.imageBase64 ?? null;
          try {
            const analysisId = await submitScreening(payload, escureceuDuranteCapturaRef.current);
            setAnalysisId(analysisId);
            setUploading(false);
            toast.success("Sessão de rastreio registada.");
            stopCamera();
            finishScan(center, {
              method: "camera",
              poses: payload.map((s) => s.pose),
              analysisId,
            });
          } catch (err) {
            const message = mensagemDeErroApi(err, "Não foi possível registar a sessão. Tente novamente.");
            setUploading(false);
            setUploadError(message);
            setCaptureStep("IDLE");
            toast.error(message);
            if ((err as { status?: number } | null)?.status === 401) {
              // Mantém scanPayload/payloadRef intactos -- nada do que foi
              // capturado se perde só porque a sessão expirou a meio.
              window.setTimeout(() => navigate("/auth?next=/scanner"), 1200);
            }
          }

        })();
      }, 12000)
    );
  }, [captureStep, lowLight, recordPose, stopCamera, finishScan, navigate]);



  const takePhoto = () => startGuidedCapture();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <BackButton to="/produto" />
      <main className="flex-1">
        <section className="container py-10 md:py-16">
          <div className="max-w-3xl mx-auto text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal/10 text-teal text-xs font-semibold tracking-wide uppercase mb-5">
              <Sparkles className="w-3.5 h-3.5" /> Rastreio de Sinais Visuais · IA
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-foreground leading-tight">
              Área de Rastreio Visual
            </h1>
            <p className="mt-4 text-base md:text-lg text-muted-foreground">
              Carregue uma fotografia ou utilize a câmara para registar sinais visuais oculares.
              Este rastreio não calcula um diagnóstico — ajuda a decidir se vale a pena procurar
              avaliação clínica.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-green" />
              Sinais observados — sujeitos a confirmação clínica. Não é um diagnóstico.
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
                    onClick={takePhoto}
                    disabled={lowLight || captureStep !== "IDLE"}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-teal text-teal-foreground font-semibold text-sm hover:bg-teal/90 transition-all shadow-elevated disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-teal"
                  >
                    {captureStep === "IDLE" ? (
                      <>
                        <Camera className="w-4 h-4" /> Capturar agora
                      </>
                    ) : uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> A registar a sessão… Não feche a página
                      </>
                    ) : (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> A preparar resumo…
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
                    qualidade dos sinais captados.
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
                      ? "A preparar o resumo da sessão…"
                      : "Siga as instruções no ecrã. A IA extrai os pontos oculares em cada fase."}
                </p>

              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-5 animate-fade-in">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative overflow-hidden rounded-3xl border-2 border-dashed border-border bg-card p-8 md:p-10 text-left transition-all duration-300 hover:border-teal hover:-translate-y-1 hover:shadow-elevated"
                >
                  <div className="w-14 h-14 rounded-2xl bg-teal/10 text-teal flex items-center justify-center mb-5 group-hover:bg-teal group-hover:text-teal-foreground transition-colors">
                    <Upload className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Carregar Fotografia</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Selecione uma imagem nítida do rosto, com olhar dirigido à câmara e boa iluminação.
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-teal">
                    Escolher ficheiro →
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFile}
                  />
                </button>

                <button
                  onClick={startCamera}
                  className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy to-navy/80 p-8 md:p-10 text-left text-navy-foreground transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated"
                >
                  <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mb-5 group-hover:bg-white/25 transition-colors">
                    <Camera className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold">Usar Câmara</h3>
                  <p className="mt-2 text-sm text-white/80">
                    Capture uma imagem em tempo real diretamente pela câmara do seu dispositivo.
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gold">
                    Ativar câmara →
                  </span>
                </button>
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
                { n: "02", t: "Extração de Pontos", d: "Rastreio ocular em tempo real" },
                { n: "03", t: "Resumo", d: "Sinais observados, a confirmar com um profissional" },
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
          A organizar os dados capturados…
        </div>
      </div>

      <div className="mt-6 max-w-md mx-auto text-center">
        <div className="inline-flex items-center gap-2 text-teal text-sm font-semibold">
          <ScanLine className="w-4 h-4 animate-pulse" /> A preparar o resumo da sessão
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Nenhum diagnóstico é calculado aqui — os sinais registados ficam disponíveis para
          partilhar com um profissional de saúde.
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
