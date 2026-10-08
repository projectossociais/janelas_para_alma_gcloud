import { Link } from "react-router-dom";
import { Coins, Gem, Loader2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCarteiraJogo } from "@/contexts/CarteiraJogoContext";
import { localizar } from "@/i18n/rotas";
import { cn } from "@/design/cn";

const formatarSaldo = (valor: number) => valor.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/**
 * Barra de saldos do jogo -- Moedas e Diamantes em separado, cada um
 * clicável e com o seu "+": as moedas levam à Loja de Moedas, os diamantes à
 * Loja de Diamantes. (Até 2026-09-24 as moedas só explicavam que se ganham
 * a jogar -- agora também se compram.)
 */
const CarteiraJogo = ({ className }: { className?: string }) => {
  const { t } = useTranslation();
  const { perfil, aCarregar } = useCarteiraJogo();
  const moedas = perfil?.moedas ?? 0;
  const diamantes = perfil?.diamantes ?? 0;

  const pilula =
    "inline-flex min-h-alvo-app items-center gap-2 rounded-pilula border border-linha bg-superficie py-1 pl-1.5 pr-2 text-corpo font-medium tabular-nums text-tinta transition-colors duration-feedback hover:border-accao focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco";

  return (
    <div className={cn("flex items-center gap-2 sm:gap-3", className)}>
      <Link
        to={localizar("/jogo-curiosidades/loja-moedas")}
        className={pilula}
        aria-label={t("CarteiraJogo.moedasSaldo", { valor: moedas })}
      >
        <span aria-hidden className="flex size-8 items-center justify-center rounded-pilula bg-aviso-suave text-aviso">
          <Coins className="size-4" />
        </span>
        {aCarregar ? <Loader2 className="size-4 animate-spin" aria-hidden /> : formatarSaldo(moedas)}
        <span aria-hidden className="flex size-5 items-center justify-center rounded-pilula bg-accao text-sobre-accao">
          <Plus className="size-3.5" />
        </span>
      </Link>

      <Link
        to={localizar("/jogo-curiosidades/loja")}
        className={pilula}
        aria-label={t("CarteiraJogo.diamantesSaldo", { valor: diamantes })}
      >
        <span aria-hidden className="flex size-8 items-center justify-center rounded-pilula bg-accao-suave text-accao">
          <Gem className="size-4" />
        </span>
        {aCarregar ? <Loader2 className="size-4 animate-spin" aria-hidden /> : formatarSaldo(diamantes)}
        <span aria-hidden className="flex size-5 items-center justify-center rounded-pilula bg-accao text-sobre-accao">
          <Plus className="size-3.5" />
        </span>
      </Link>
    </div>
  );
};

export default CarteiraJogo;
