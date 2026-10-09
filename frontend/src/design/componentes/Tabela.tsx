import type { HTMLAttributes, ReactNode, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "../cn";

/**
 * Tabela da Consola: HTML semântico (`<table>`, `<th scope>`, `<caption>`) com
 * o estilo do sistema -- linhas finas, cabeçalho discreto, números alinhados.
 * Quando não cabe (telemóvel), faz scroll só ela, nunca a página; a região que
 * faz scroll tem nome e recebe foco, para quem usa teclado a poder percorrer.
 */
export const Tabela = ({
  legenda,
  legendaVisivel = false,
  className,
  children,
  ...props
}: TableHTMLAttributes<HTMLTableElement> & {
  /** O que a tabela mostra (ex.: "Utilizadores"). Dá nome à tabela e à zona de scroll. */
  legenda: string;
  legendaVisivel?: boolean;
  children: ReactNode;
}) => (
  // A região com scroll precisa de ser focável para quem não usa rato (axe: scrollable-region-focusable).
  <div role="region" aria-label={legenda} tabIndex={0} className="overflow-x-auto rounded-cartao border border-linha bg-superficie focus-visible:outline focus-visible:outline-2 focus-visible:outline-foco">
    <table className={cn("w-full border-collapse text-left text-corpo", className)} {...props}>
      <caption className={legendaVisivel ? "px-4 pt-3 text-left text-legenda text-tinta-suave" : "sr-only"}>{legenda}</caption>
      {children}
    </table>
  </div>
);

export const TabelaCabecalho = ({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn("border-b border-linha bg-superficie-alt", className)} {...props} />
);

export const TabelaCorpo = ({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn("divide-y divide-linha", className)} {...props} />
);

export const TabelaLinha = ({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn("align-top", className)} {...props} />
);

export const TabelaTitulo = ({
  className,
  numerico = false,
  scope = "col",
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { numerico?: boolean }) => (
  <th
    scope={scope}
    className={cn(
      "whitespace-nowrap px-4 py-2.5 text-legenda font-medium text-tinta-suave",
      numerico && "text-right",
      className,
    )}
    {...props}
  />
);

export const TabelaCelula = ({
  className,
  numerico = false,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { numerico?: boolean }) => (
  <td className={cn("px-4 py-3 text-tinta", numerico && "text-right tabular-nums", className)} {...props} />
);

/** Etiqueta de estado numa linha (pendente, aprovado...): texto sempre, cor só a reforçar. */
export const Estado = ({
  tom = "neutro",
  children,
}: {
  tom?: "neutro" | "aviso" | "sucesso" | "erro" | "info";
  children: ReactNode;
}) => (
  <span
    className={cn(
      "inline-flex items-center whitespace-nowrap rounded-pilula px-2.5 py-0.5 text-legenda font-medium",
      tom === "neutro" && "bg-superficie-alt text-tinta-suave",
      tom === "aviso" && "bg-aviso-suave text-aviso",
      tom === "sucesso" && "bg-sucesso-suave text-sucesso",
      tom === "erro" && "bg-erro-suave text-erro",
      tom === "info" && "bg-accao-suave text-accao",
    )}
  >
    {children}
  </span>
);
