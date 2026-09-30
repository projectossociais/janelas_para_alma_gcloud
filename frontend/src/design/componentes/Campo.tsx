import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "../cn";

/**
 * Campo de texto (docs/PESQUISA_UX.md §3, Formulários; padrão GOV.UK):
 *
 * - rótulo **sempre por cima** (nunca o placeholder como rótulo: desaparece ao
 *   escrever);
 * - ajuda entre o rótulo e o campo, e erro logo por cima do campo, com ícone e
 *   texto (nunca só a cor), ambos ligados por `aria-describedby`;
 * - texto a 17 px: acima dos 16 px que fazem o iPhone ampliar a página;
 * - o erro marca o contorno com uma sombra, sem engrossar a borda: nada salta.
 *
 * Para o teclado certo no telemóvel, passar `type`/`inputMode`/`autoComplete`
 * (ex.: telefone: `type="tel" inputMode="numeric" autoComplete="tel-national"`).
 */
export interface CampoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "children"> {
  rotulo: ReactNode;
  ajuda?: ReactNode;
  erro?: ReactNode;
}

export const Campo = forwardRef<HTMLInputElement, CampoProps>(
  ({ rotulo, ajuda, erro, id, className, disabled, ...props }, ref) => {
    const idGerado = useId();
    const idCampo = id ?? idGerado;
    const idAjuda = ajuda ? `${idCampo}-ajuda` : undefined;
    const idErro = erro ? `${idCampo}-erro` : undefined;
    const descritoPor = [idAjuda, idErro, props["aria-describedby"]].filter(Boolean).join(" ") || undefined;

    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <label htmlFor={idCampo} className="text-corpo font-medium text-tinta">
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
        <input
          ref={ref}
          id={idCampo}
          disabled={disabled}
          aria-invalid={erro ? true : undefined}
          {...props}
          aria-describedby={descritoPor}
          className={cn(
            "min-h-12 w-full rounded-controlo border border-linha-forte bg-superficie px-4 text-corpo text-tinta",
            "placeholder:text-tinta-suave",
            "transition-colors duration-feedback ease-padrao",
            "focus-visible:border-accao focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco",
            "disabled:cursor-not-allowed disabled:bg-superficie-alt disabled:opacity-70",
            erro && "border-erro shadow-contorno-erro",
          )}
        />
      </div>
    );
  },
);
Campo.displayName = "Campo";
