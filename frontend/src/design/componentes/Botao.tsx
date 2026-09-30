import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../cn";
import { Indicador } from "./Indicador";

/**
 * Botão do sistema de design (docs/SISTEMA_DESIGN.md §4).
 *
 * - Alvo mínimo de 44 px (`m`) ou 56 px (`g`, acções principais no telemóvel).
 * - Foco do teclado sempre visível, no anel de foco (contraste ≥ 3:1).
 * - `aCarregar`: o texto fica transparente (continua a ser lido por leitores de
 *   ecrã) e o indicador aparece por cima; a largura não muda, a página não salta.
 * - `asChild`: o mesmo aspecto numa ligação (`<Botao asChild><Link/></Botao>`).
 * - Pressão: afunda 1 px, sem animação JavaScript.
 */
const estiloBotao = cva(
  [
    "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap",
    "rounded-controlo font-medium",
    "transition-colors duration-feedback ease-padrao",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco",
    "active:translate-y-px",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0",
    "[&_svg]:size-5 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variante: {
        primario: "bg-accao text-sobre-accao hover:bg-accao-forte",
        secundario: "border-2 border-accao bg-superficie text-accao hover:bg-accao-suave",
        fantasma: "text-accao hover:bg-accao-suave",
        perigo: "bg-erro text-sobre-erro hover:bg-erro/90",
      },
      tamanho: {
        m: "min-h-alvo-app px-5 text-corpo",
        g: "min-h-14 px-7 text-corpo-g",
      },
      larguraTotal: { true: "w-full" },
    },
    defaultVariants: { variante: "primario", tamanho: "m" },
  },
);

export interface BotaoProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof estiloBotao> {
  /** Aplica o aspecto ao filho único (ex.: uma ligação), em vez de um `<button>`. */
  asChild?: boolean;
  /** Mostra o indicador e bloqueia novos cliques até a acção terminar. */
  aCarregar?: boolean;
}

export const Botao = forwardRef<HTMLButtonElement, BotaoProps>(
  (
    { className, variante, tamanho, larguraTotal, asChild = false, aCarregar = false, disabled, children, type, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(
          estiloBotao({ variante, tamanho, larguraTotal }),
          // Uma acção em curso não é uma acção indisponível: mantém a cor.
          aCarregar && "cursor-wait disabled:cursor-wait disabled:opacity-100",
          className,
        )}
        // Um <button> dentro de um formulário é "submit" por omissão: explícito evita envios por engano.
        type={asChild ? undefined : (type ?? "button")}
        disabled={asChild ? undefined : disabled || aCarregar}
        aria-disabled={asChild && (disabled || aCarregar) ? true : undefined}
        aria-busy={aCarregar || undefined}
        {...props}
      >
        {aCarregar && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Indicador />
          </span>
        )}
        {/* Slottable: com asChild, o conteúdo do filho fica aqui dentro. */}
        <Slottable>
          {aCarregar && !asChild ? <span className="inline-flex items-center gap-2 opacity-0">{children}</span> : children}
        </Slottable>
      </Comp>
    );
  },
);
Botao.displayName = "Botao";
