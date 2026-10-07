import type { HTMLAttributes, ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, type LucideIcon } from "lucide-react";
import { cva } from "class-variance-authority";
import { cn } from "../cn";

/**
 * Mensagem em destaque: informação, sucesso, aviso ou erro. Sempre com ícone e
 * texto, nunca só a cor (docs/MARCA.md §3; a paleta junta azul, turquesa e
 * verde, que pessoas daltónicas confundem).
 *
 * `anunciar`: para uma mensagem que **aparece** em resposta a uma acção (ex.:
 * "Guardado", "Não foi possível enviar"). Os leitores de ecrã anunciam-na:
 * educadamente (`status`) ou, num erro, de imediato (`alert`). Um aviso que já
 * está na página quando ela abre não se anuncia: seria interromper a leitura.
 */
type Variante = "info" | "sucesso" | "aviso" | "erro";

const estiloAviso = cva("flex gap-3 rounded-cartao p-4 text-corpo text-tinta", {
  variants: {
    variante: {
      info: "bg-accao-suave",
      sucesso: "bg-sucesso-suave",
      aviso: "bg-aviso-suave",
      erro: "bg-erro-suave",
    },
  },
});

const ICONE: Record<Variante, { Icone: LucideIcon; cor: string }> = {
  info: { Icone: Info, cor: "text-accao" },
  sucesso: { Icone: CheckCircle2, cor: "text-sucesso" },
  aviso: { Icone: AlertTriangle, cor: "text-aviso" },
  erro: { Icone: AlertCircle, cor: "text-erro" },
};

export interface AvisoProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  variante?: Variante;
  titulo?: ReactNode;
  /** Uma acção relacionada (ex.: "Tentar de novo"), por baixo do texto. */
  accao?: ReactNode;
  anunciar?: boolean;
}

export const Aviso = ({ variante = "info", titulo, accao, anunciar = false, className, children, ...props }: AvisoProps) => {
  const { Icone, cor } = ICONE[variante];
  const papel = anunciar ? (variante === "erro" ? "alert" : "status") : undefined;
  return (
    <div role={papel} className={cn(estiloAviso({ variante }), className)} {...props}>
      <Icone className={cn("mt-0.5 size-5 shrink-0", cor)} aria-hidden />
      <div className="min-w-0 flex-1">
        {titulo && <p className="font-medium">{titulo}</p>}
        {children && <div className={cn(titulo && "mt-1", "text-tinta-suave")}>{children}</div>}
        {accao && <div className="mt-3">{accao}</div>}
      </div>
    </div>
  );
};
