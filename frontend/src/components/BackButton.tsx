import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface BackButtonProps {
  fallbackPath?: string;
  label?: string;
  className?: string;
}

const BackButton = ({ fallbackPath = "/", label, className = "" }: BackButtonProps) => {
  const { t } = useTranslation();
  const texto = label ?? t("BackButton.voltar");
  const navigate = useNavigate();

  const handleClick = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(fallbackPath);
    }
  };

  return (
    <div className={`container pt-20 md:pt-24 ${className}`}>
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors group"
        aria-label={texto}
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        <span>{texto}</span>
      </button>
    </div>
  );
};

export default BackButton;
