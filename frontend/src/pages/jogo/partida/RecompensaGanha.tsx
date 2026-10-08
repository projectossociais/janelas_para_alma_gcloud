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
      <div className="rounded-controlo bg-superficie-alt p-4 text-legenda text-tinta-suave">
        {modo === "convidado" ? (
          <>
            {t("JogoCuriosidades.semPremioConvidado")}{" "}
            <Link to={localizar("/auth")} className="font-medium text-accao underline underline-offset-2">
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
    <div className="space-y-2 rounded-controlo bg-superficie-alt p-4 text-center">
      <p className="text-legenda text-tinta-suave">{t("JogoCuriosidades.premioGanho")}</p>
      <div className="flex items-center justify-center gap-6">
        <span className="inline-flex items-center gap-1.5 text-corpo-g font-medium text-tinta">
          <Coins className="size-5 text-aviso" role="img" aria-label={t("JogoCuriosidades.moedas")} />+{recompensa.moedas}
        </span>
        <span className="inline-flex items-center gap-1.5 text-corpo-g font-medium text-tinta">
          <Gem className="size-5 text-accao" role="img" aria-label={t("JogoCuriosidades.diamantes")} />+{recompensa.diamantes}
        </span>
      </div>
      {comPerguntasOffline && (
        <p className="text-legenda text-tinta-suave">{t("JogoCuriosidades.respostasOfflineNaoContam")}</p>
      )}
    </div>
  );
};
