import { Link } from "react-router-dom";
import { Coins, Gem, Loader2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCarteiraJogo } from "@/contexts/CarteiraJogoContext";
import { useProfile } from "@/contexts/ProfileContext";
import { localizar } from "@/i18n/rotas";
import { cn } from "@/lib/utils";

const formatarSaldo = (valor: number) => valor.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/**
 * Barra de saldos do jogo -- Moedas e Diamantes em separado, cada um
 * clicável: os diamantes levam à Loja; as moedas abrem uma explicação de
 * como se ganham (ganham-se a jogar, não se compram).
 */
const CarteiraJogo = ({ className }: { className?: string }) => {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const { perfil, aCarregar } = useCarteiraJogo();
  const moedas = perfil?.moedas ?? 0;
  const diamantes = perfil?.diamantes ?? 0;

  const pilula =
    "inline-flex items-center gap-2 rounded-full bg-card border border-border/60 shadow-card pl-2 pr-3 py-1.5 font-bold transition-colors hover:border-teal/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal";

  return (
    <div className={cn("flex items-center gap-2 sm:gap-3", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(pilula, "text-gold")}
            aria-label={t("CarteiraJogo.moedasSaldo", { valor: moedas })}
          >
            <span className="w-7 h-7 rounded-full bg-gold/15 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </span>
            {aCarregar ? <Loader2 className="w-4 h-4 animate-spin" /> : formatarSaldo(moedas)}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 text-sm space-y-1">
          <p className="font-bold text-foreground">{t("CarteiraJogo.moedas")}</p>
          <p className="text-muted-foreground">{t("CarteiraJogo.comoGanharMoedas")}</p>
          {!profile && (
            <Link to={localizar("/auth")} className="text-teal hover:underline">
              {t("CarteiraJogo.inicieSessaoParaGuardar")}
            </Link>
          )}
        </PopoverContent>
      </Popover>

      <Link
        to={localizar("/jogo-curiosidades/loja")}
        className={cn(pilula, "text-teal")}
        aria-label={t("CarteiraJogo.diamantesSaldo", { valor: diamantes })}
      >
        <span className="w-7 h-7 rounded-full bg-teal/15 flex items-center justify-center">
          <Gem className="w-4 h-4" />
        </span>
        {aCarregar ? <Loader2 className="w-4 h-4 animate-spin" /> : formatarSaldo(diamantes)}
        <span className="w-5 h-5 rounded-full bg-teal text-teal-foreground flex items-center justify-center">
          <Plus className="w-3.5 h-3.5" />
        </span>
      </Link>
    </div>
  );
};

export default CarteiraJogo;
