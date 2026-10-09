import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from "react";
import { AlertCircle, ChevronDown } from "lucide-react";
import { cn } from "../cn";

/**
 * Escolha numa lista longa (ex.: as 21 províncias), com o seletor nativo do
 * telemóvel: roda do iOS e lista do Android, que são o que as pessoas já
 * sabem usar. Para poucas opções que pedem explicação, é o `GrupoEscolha`.
 *
 * Mesmo rótulo por cima, ajuda e erro do `Campo` (docs/PESQUISA_UX.md §3);
 * texto a 17 px para o iPhone não ampliar a página. A primeira linha é o
 * `marcador` ("Escolha…"), que não se pode escolher de volta.
 */
export interface SeleccaoProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  rotulo: ReactNode;
  ajuda?: ReactNode;
  erro?: ReactNode;
  marcador: string;
  opcoes: readonly { valor: string; rotulo: string }[];
  /** O rótulo fica só para leitores de ecrã (ex.: numa tabela, onde o cabeçalho da coluna já o diz). */
  rotuloOculto?: boolean;
  /** `compacto`: 32 px de altura, para a Consola (linhas de tabela). */
  tamanho?: "normal" | "compacto";
}

export const Seleccao = forwardRef<HTMLSelectElement, SeleccaoProps>(
  ({ rotulo, ajuda, erro, marcador, opcoes, rotuloOculto = false, tamanho = "normal", id, className, ...props }, ref) => {
    const idGerado = useId();
    const idCampo = id ?? idGerado;
    const idAjuda = ajuda ? `${idCampo}-ajuda` : undefined;
    const idErro = erro ? `${idCampo}-erro` : undefined;
    const descritoPor = [idAjuda, idErro].filter(Boolean).join(" ") || undefined;

    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <label htmlFor={idCampo} className={rotuloOculto ? "sr-only" : "text-corpo font-medium text-tinta"}>
          {rotulo}
        </label>
        {ajuda && (
          <p id={idAjuda} className="text-legenda text-tinta-suave">
            {ajuda}
          </p>
        )}
        {erro && (
          <p id={idErro} className="flex items-start gap-1.5 text-legenda font-medium text-erro">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{erro}</span>
          </p>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={idCampo}
            aria-invalid={erro ? true : undefined}
            aria-describedby={descritoPor}
            {...props}
            className={cn(
              "w-full appearance-none rounded-controlo border border-linha-forte bg-superficie py-0 text-tinta",
              tamanho === "compacto" ? "min-h-alvo-consola pl-3 pr-9 text-legenda" : "min-h-12 pl-4 pr-11 text-corpo",
              "transition-colors duration-feedback ease-padrao",
              "focus-visible:border-accao focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco",
              "disabled:cursor-not-allowed disabled:bg-superficie-alt disabled:opacity-70",
              // O marcador não é uma resposta: fica com a cor de apoio até haver escolha.
              props.value === "" && "text-tinta-suave",
              erro && "border-erro shadow-contorno-erro",
            )}
          >
            <option value="" disabled>
              {marcador}
            </option>
            {opcoes.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
          <ChevronDown
            className={cn(
              "pointer-events-none absolute top-1/2 -translate-y-1/2 text-tinta-suave",
              tamanho === "compacto" ? "right-2.5 size-4" : "right-4 size-5",
            )}
            aria-hidden
          />
        </div>
      </div>
    );
  },
);
Seleccao.displayName = "Seleccao";
