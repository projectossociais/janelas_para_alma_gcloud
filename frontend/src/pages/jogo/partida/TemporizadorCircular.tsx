import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface TemporizadorCircularProps {
  tempoRestante: number;
  tempoTotal: number;
}

const TAMANHO_TEMPORIZADOR = 76;
const ESPESSURA_TEMPORIZADOR = 6;
const RAIO_TEMPORIZADOR = (TAMANHO_TEMPORIZADOR - ESPESSURA_TEMPORIZADOR) / 2;
const CIRCUNFERENCIA_TEMPORIZADOR = 2 * Math.PI * RAIO_TEMPORIZADOR;

export const TemporizadorCircular = ({ tempoRestante, tempoTotal }: TemporizadorCircularProps) => {
  const { t } = useTranslation();
  const fracao = Math.max(0, Math.min(1, tempoRestante / tempoTotal));
  const offset = CIRCUNFERENCIA_TEMPORIZADOR * (1 - fracao);
  const urgente = tempoRestante <= 10;

  return (
    <div
      className="relative shrink-0"
      style={{ width: TAMANHO_TEMPORIZADOR, height: TAMANHO_TEMPORIZADOR }}
      role="timer"
      aria-label={t("JogoCuriosidades.segundosRestantes", { tempoRestante })}
    >
      <svg width={TAMANHO_TEMPORIZADOR} height={TAMANHO_TEMPORIZADOR} className="-rotate-90">
        <circle
          cx={TAMANHO_TEMPORIZADOR / 2}
          cy={TAMANHO_TEMPORIZADOR / 2}
          r={RAIO_TEMPORIZADOR}
          strokeWidth={ESPESSURA_TEMPORIZADOR}
          className="fill-none stroke-muted"
        />
        <circle
          cx={TAMANHO_TEMPORIZADOR / 2}
          cy={TAMANHO_TEMPORIZADOR / 2}
          r={RAIO_TEMPORIZADOR}
          strokeWidth={ESPESSURA_TEMPORIZADOR}
          strokeDasharray={CIRCUNFERENCIA_TEMPORIZADOR}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(
            "fill-none transition-[stroke-dashoffset] duration-1000 ease-linear",
            urgente ? "stroke-destructive" : "stroke-teal"
          )}
        />
      </svg>
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center text-base font-bold",
          urgente ? "text-destructive" : "text-foreground"
        )}
      >
        {tempoRestante}
      </div>
    </div>
  );
};
