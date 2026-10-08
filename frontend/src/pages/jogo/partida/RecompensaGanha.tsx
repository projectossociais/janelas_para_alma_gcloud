import { Link } from "react-router-dom";
import { Coins, Gem } from "lucide-react";
import { useTranslation } from "react-i18next";
import { localizar } from "@/i18n/rotas";
import type { RecompensaLocal } from "./usePartidaJogo";

interface RecompensaGanhaProps {
  recompensa: RecompensaLocal | null;
  // "servidor": prémio pago pela API. "convidado"/"treino": reserva local,
  // sem prémio nenhum -- só se explica porquê.
  modo: "servidor" | "convidado" | "treino";
  comPerguntasOffline?: boolean;
}

export const RecompensaGanha = ({ recompensa, modo, comPerguntasOffline = false }: RecompensaGanhaProps) => {
  const { t } = useTranslation();
  if (modo !== "servidor") {
    return (
      <div className="rounded-xl bg-muted/60 border border-border/50 p-4 text-sm text-muted-foreground">
        {modo === "convidado" ? (
          <>
            {t("JogoCuriosidades.semPremioConvidado")}{" "}
            <Link to={localizar("/auth")} className="font-semibold text-teal hover:underline">
              {t("JogoCuriosidades.entrarParaGanhar")}
            </Link>
          </>
        ) : (
          t("JogoCuriosidades.modoTreinoIngles")
        )}
      </div>
    );
  }
  if (!recompensa) return null;
  return (
    <div className="rounded-xl bg-muted/60 border border-border/50 p-4 space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("JogoCuriosidades.premioGanho")}</p>
      <div className="flex items-center justify-center gap-6">
        <span className="inline-flex items-center gap-1.5 font-bold text-gold">
          <Coins className="w-4 h-4" />+{recompensa.moedas}
        </span>
        <span className="inline-flex items-center gap-1.5 font-bold text-teal">
          <Gem className="w-4 h-4" />+{recompensa.diamantes}
        </span>
      </div>
      {comPerguntasOffline && (
        <p className="text-xs text-muted-foreground text-center">{t("JogoCuriosidades.respostasOfflineNaoContam")}</p>
      )}
    </div>
  );
};
