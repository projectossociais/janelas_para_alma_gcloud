import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize2, RotateCcw } from "lucide-react";

interface Props {
  src: string;
  poster?: string;
  title: string;
}

const formatTime = (t: number) => {
  if (!isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

const CustomVideoPlayer = ({ src, poster, title }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrent(v.currentTime);
    const onMeta = () => setDuration(v.duration || 0);
    const onEnd = () => setPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("ended", onEnd);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("ended", onEnd);
    };
  }, []);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Number(e.target.value);
    setCurrent(v.currentTime);
  };

  const restart = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play();
    setPlaying(true);
  };

  const fullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.requestFullscreen) v.requestFullscreen();
  };

  const progress = duration ? (current / duration) * 100 : 0;

  return (
    <div className="relative group bg-navy overflow-hidden rounded-t-xl aspect-video">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        muted={muted}
        preload="metadata"
        aria-label={title}
        className="w-full h-full object-cover"
        onClick={toggle}
      />

      {/* Center play overlay when paused */}
      {!playing && (
        <button
          type="button"
          onClick={toggle}
          aria-label="Reproduzir vídeo"
          className="absolute inset-0 flex items-center justify-center bg-navy/40 hover:bg-navy/50 transition-colors"
        >
          <span className="w-16 h-16 rounded-full bg-teal text-teal-foreground flex items-center justify-center shadow-elevated group-hover:scale-105 transition-transform">
            <Play className="w-7 h-7 ml-1" fill="currentColor" />
          </span>
        </button>
      )}

      {/* Controls */}
      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-navy/95 via-navy/70 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2 text-primary-foreground">
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Pausar" : "Reproduzir"}
            className="p-1.5 rounded-md hover:bg-primary-foreground/15 transition-colors"
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={restart}
            aria-label="Recomeçar"
            className="p-1.5 rounded-md hover:bg-primary-foreground/15 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-mono tabular-nums w-10 text-center">
            {formatTime(current)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={current}
            onChange={seek}
            aria-label="Progresso"
            className="flex-1 h-1.5 accent-teal cursor-pointer"
            style={{
              background: `linear-gradient(to right, hsl(var(--teal)) ${progress}%, hsl(var(--primary-foreground) / 0.25) ${progress}%)`,
              borderRadius: 999,
              appearance: "none",
            }}
          />
          <span className="text-[11px] font-mono tabular-nums w-10 text-center">
            {formatTime(duration)}
          </span>
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Activar som" : "Silenciar"}
            className="p-1.5 rounded-md hover:bg-primary-foreground/15 transition-colors"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={fullscreen}
            aria-label="Ecrã inteiro"
            className="p-1.5 rounded-md hover:bg-primary-foreground/15 transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomVideoPlayer;
