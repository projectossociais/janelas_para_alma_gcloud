import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../cn";

/**
 * Cartão: agrupa conteúdo relacionado numa superfície.
 *
 * Cartão clicável (`interactivo`): **só o título é uma ligação** (`CartaoLigacao`),
 * mas a área clicável estica-se ao cartão inteiro. O leitor de ecrã ouve um nome
 * curto ("Treino de Anéis"), não o cartão todo lido como uma ligação, e o resto
 * do texto continua selecionável. O foco do teclado desenha-se no cartão.
 */
export interface CartaoProps extends HTMLAttributes<HTMLDivElement> {
  interactivo?: boolean;
  asChild?: boolean;
}

export const Cartao = forwardRef<HTMLDivElement, CartaoProps>(
  ({ interactivo = false, asChild = false, className, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";
    return (
      <Comp
        ref={ref}
        className={cn(
          "relative rounded-cartao border border-linha bg-superficie p-6 shadow-nivel-1",
          interactivo &&
            [
              "transition-colors duration-feedback ease-padrao hover:border-accao",
              "has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2",
              "has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-foco",
            ].join(" "),
          className,
        )}
        {...props}
      />
    );
  },
);
Cartao.displayName = "Cartao";

export const CartaoTitulo = ({
  como: Titulo = "h3",
  className,
  lang,
  children,
}: {
  como?: "h2" | "h3" | "h4";
  className?: string;
  /** Idioma do título, quando não é o da página (ex.: conteúdo só em português no site inglês). */
  lang?: string;
  children: ReactNode;
}) => (
  <Titulo lang={lang} className={cn("text-titulo-p text-tinta", className)}>
    {children}
  </Titulo>
);

export const CartaoTexto = ({ className, children }: { className?: string; children: ReactNode }) => (
  <p className={cn("mt-2 text-corpo text-tinta-suave", className)}>{children}</p>
);

/**
 * A ligação do cartão interactivo. Dentro de `CartaoTitulo`. Aceita `asChild`
 * para usar o `Link` do router: `<CartaoLigacao asChild><Link to="/x">…</Link></CartaoLigacao>`.
 */
export const CartaoLigacao = ({
  asChild = false,
  className,
  ...props
}: HTMLAttributes<HTMLAnchorElement> & { href?: string; asChild?: boolean }) => {
  const Comp = asChild ? Slot : "a";
  return (
    <Comp
      className={cn(
        "text-tinta outline-none after:absolute after:inset-0 after:rounded-cartao after:content-['']",
        className,
      )}
      {...props}
    />
  );
};
