import { Lock, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface LockedVideoOverlayProps {
  title: string;
  onUnlock?: () => void;
}

const LockedVideoOverlay = ({ title, onUnlock }: LockedVideoOverlayProps) => {
  const navigate = useNavigate();
  const handleClick = () => {
    if (onUnlock) onUnlock();
    navigate("/registo-premium");
  };

  return (
    <div
      className="relative aspect-video rounded-t-xl overflow-hidden bg-gradient-to-br from-navy via-navy to-teal/60 flex flex-col items-center justify-center text-primary-foreground p-6 text-center"
      aria-label={`${title}: conteúdo bloqueado`}
    >
      <div className="absolute inset-0 opacity-20 pointer-events-none [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:16px_16px]" />
      <div className="relative w-14 h-14 rounded-full bg-primary-foreground/15 backdrop-blur flex items-center justify-center mb-3 border border-primary-foreground/25">
        <Lock className="w-6 h-6" />
      </div>
      <p className="relative text-sm font-medium uppercase tracking-widest text-primary-foreground/75 mb-1">
        Conteúdo Premium
      </p>
      <p className="relative text-base font-semibold mb-4 max-w-xs">
        Faça upgrade para desbloquear este vídeo.
      </p>
      <Button
        size="sm"
        onClick={handleClick}
        className="relative bg-primary-foreground text-navy hover:bg-primary-foreground/90"
      >
        <Sparkles className="w-4 h-4" />
        Desbloquear
      </Button>
    </div>
  );
};

export default LockedVideoOverlay;
