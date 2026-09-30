import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { localizar } from "@/i18n/rotas";
import { useDentroDoSiteNovo } from "@/components/site/contextoSiteNovo";

interface BackButtonProps {
  fallbackPath?: string;
  label?: string;
  className?: string;
}

const BackButton = ({ fallbackPath = "/", label, className = "" }: BackButtonProps) => {
  const { t } = useTranslation();
  const texto = label ?? t("BackButton.voltar");
  const navigate = useNavigate();
  // O espaço de cima compensava o cabeçalho fixo antigo; o novo não se sobrepõe.
  const topo = useDentroDoSiteNovo() ? "pt-6" : "pt-20 md:pt-24";

  const handleClick = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(localizar(fallbackPath));
    }
  };

  return (
    <div className={`container ${topo} ${className}`}>
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
