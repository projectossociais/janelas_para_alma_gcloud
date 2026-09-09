import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BackButtonProps {
  to?: string;
  label?: string;
  className?: string;
}

const BackButton = ({ to, label = "Voltar", className = "" }: BackButtonProps) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (to) {
      navigate(to);
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/produto");
    }
  };

  return (
    <div className={`container pt-20 md:pt-24 ${className}`}>
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors group"
        aria-label={label}
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        <span>{label}</span>
      </button>
    </div>
  );
};

export default BackButton;
