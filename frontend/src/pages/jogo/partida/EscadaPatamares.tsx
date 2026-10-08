import { Check } from "lucide-react";
import { cn } from "@/design/cn";
import { PATAMARES, formatarKz } from "../jogoConfig";

interface EscadaPatamaresProps {
  patamarAtual: number;
  className?: string;
}

/** Os 15 prémios, do mais alto ao mais baixo; só os valores, nunca o número do patamar. */
export const EscadaPatamares = ({ patamarAtual, className }: EscadaPatamaresProps) => (
  <ol className={cn("flex flex-col-reverse gap-1", className)}>
    {PATAMARES.map(({ numero, valorKz }) => {
      const ativo = numero === patamarAtual;
      const superado = numero < patamarAtual;
      return (
        <li
          key={numero}
          aria-current={ativo ? "step" : undefined}
          className={cn(
            "flex items-center justify-center gap-2 rounded-controlo px-3 py-1.5 text-legenda tabular-nums",
            ativo && "border-2 border-accao bg-accao-suave font-medium text-tinta",
            superado && "text-tinta",
            !ativo && !superado && "text-tinta-suave",
          )}
        >
          {superado && <Check className="size-4 shrink-0 text-sucesso" aria-hidden />}
          {formatarKz(valorKz)}
        </li>
      );
    })}
  </ol>
);
