import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PATAMARES, formatarKz } from "../jogoConfig";

interface EscadaPatamaresProps {
  patamarAtual: number;
  className?: string;
}

export const EscadaPatamares = ({ patamarAtual, className }: EscadaPatamaresProps) => (
  <div className={cn("rounded-2xl bg-card border border-border/60 shadow-card p-3", className)}>
    <ul className="flex flex-col-reverse gap-1">
      {PATAMARES.map(({ numero, valorKz }) => {
        const ativo = numero === patamarAtual;
        const superado = numero < patamarAtual;
        return (
          <li
            key={numero}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
              ativo && "bg-teal/10 border border-teal text-foreground font-bold",
              superado && "text-muted-foreground",
              !ativo && !superado && "text-muted-foreground/70"
            )}
          >
            {superado && <Check className="w-3.5 h-3.5 text-green shrink-0" />}
            <span className={cn(ativo && "text-gold font-bold", superado && "text-foreground/70")}>
              {formatarKz(valorKz)}
            </span>
          </li>
        );
      })}
    </ul>
  </div>
);
