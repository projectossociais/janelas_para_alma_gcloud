import { useId, type ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "../cn";

/**
 * Uma linha que a pessoa confirma (preparação do rastreio, consentimento,
 * listas de verificação). A linha inteira é o alvo de toque (≥ 56 px); por
 * baixo está uma caixa de selecção nativa, que já tem teclado (Espaço) e
 * leitor de ecrã resolvidos. O estado marcado vê-se pelo visto, não só pela cor.
 */
export interface OpcaoConfirmarProps {
  rotulo: ReactNode;
  descricao?: ReactNode;
  /** Ícone decorativo à esquerda. */
  icone?: ReactNode;
  marcada: boolean;
  aoMudar: (marcada: boolean) => void;
  className?: string;
}

export const OpcaoConfirmar = ({ rotulo, descricao, icone, marcada, aoMudar, className }: OpcaoConfirmarProps) => {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        "group relative flex min-h-14 cursor-pointer items-center gap-4 rounded-controlo border border-linha-forte bg-superficie p-4",
        "transition-colors duration-feedback ease-padrao hover:border-accao",
        "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-foco",
        marcada && "border-accao bg-accao-suave",
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={marcada}
        onChange={(e) => aoMudar(e.target.checked)}
        className="peer sr-only"
        aria-describedby={descricao ? `${id}-descricao` : undefined}
      />
      {icone && (
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-pilula bg-superficie-alt text-accao [&_svg]:size-5"
        >
          {icone}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-corpo text-tinta">{rotulo}</span>
        {descricao && (
          <span id={`${id}-descricao`} className="mt-0.5 block text-legenda text-tinta-suave">
            {descricao}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-pequeno border-2 border-accao text-sobre-accao",
          "transition-colors duration-feedback",
          marcada && "bg-accao",
        )}
      >
        {marcada && <Check className="size-4" strokeWidth={3} />}
      </span>
    </label>
  );
};
