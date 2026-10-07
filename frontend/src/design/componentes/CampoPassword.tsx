import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "../cn";
import { Campo, type CampoProps } from "./Campo";

/**
 * Password com "Mostrar/Esconder" dentro do campo (docs/PESQUISA_UX.md §3):
 * a pessoa confirma o que escreveu sem ter de a escrever duas vezes, e colar
 * e os gestores de passwords funcionam (`autoComplete`; WCAG 3.3.8).
 *
 * O botão diz o que faz, em texto (traduzido por quem usa), e marca
 * `aria-pressed` quando a password está visível.
 */
export interface CampoPasswordProps extends Omit<CampoProps, "type" | "sufixo"> {
  textos: { mostrar: string; esconder: string };
  /** "current-password" ao entrar, "new-password" ao criar. */
  autoComplete: "current-password" | "new-password";
}

export const CampoPassword = forwardRef<HTMLInputElement, CampoPasswordProps>(({ textos, ...props }, ref) => {
  const [visivel, setVisivel] = useState(false);
  return (
    <Campo
      ref={ref}
      type={visivel ? "text" : "password"}
      spellCheck={false}
      autoCapitalize="none"
      {...props}
      sufixo={
        <button
          type="button"
          aria-pressed={visivel}
          aria-controls={props.id}
          onClick={() => setVisivel((v) => !v)}
          className={cn(
            "inline-flex min-h-10 items-center gap-1.5 rounded-controlo px-3 text-legenda font-medium text-accao",
            "hover:bg-accao-suave focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-foco",
          )}
        >
          {visivel ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          {visivel ? textos.esconder : textos.mostrar}
        </button>
      }
    />
  );
});
CampoPassword.displayName = "CampoPassword";
