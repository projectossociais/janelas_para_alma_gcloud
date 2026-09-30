import type { ReactNode } from "react";
import { cn } from "../cn";
import { Ligacao } from "../Ligacao";

/**
 * Navegação da App (docs/ESTRUTURA_SITE.md §3; docs/LAYOUTS.md §2.4): **uma só
 * navegação** que muda de forma com o ecrã (nunca duas cópias escondidas por
 * CSS: seriam dois marcos iguais e ligações duplicadas).
 * - Telemóvel: barra de separadores em baixo, sempre visível, ícone **e** nome
 *   (a navegação escondida reduz a quase metade quem a encontra, NN/g).
 * - Computador: barra lateral estreita, com o símbolo no topo.
 * O destino actual marca-se com `aria-current` e com mais do que a cor (fundo
 * atrás do ícone e peso da letra).
 */
export interface DestinoApp {
  rotulo: string;
  href: string;
  icone: ReactNode;
  activo?: boolean;
}

export const NavegacaoApp = ({
  destinos,
  rotulo,
  topo,
}: {
  destinos: DestinoApp[];
  /** Nome acessível da navegação (ex.: "Navegação da app"). */
  rotulo: string;
  /** O que fica no topo da barra lateral, só no computador (normalmente o símbolo). */
  topo?: ReactNode;
}) => (
  <nav
    aria-label={rotulo}
    className={cn(
      // Telemóvel: barra fixa em baixo
      "fixed inset-x-0 bottom-0 z-30 border-t border-linha bg-superficie/95 pb-seguro-inferior pt-1 backdrop-blur",
      // Computador: barra lateral
      "lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-24 lg:shrink-0 lg:flex-col lg:items-center lg:gap-6",
      "lg:border-r lg:border-t-0 lg:py-6 lg:backdrop-blur-none",
    )}
  >
    {topo && <div className="hidden w-10 lg:block">{topo}</div>}
    <ul className="mx-auto flex max-w-xl lg:mx-0 lg:w-full lg:max-w-none lg:flex-col lg:gap-1 lg:px-2">
      {destinos.map((d) => (
        <li key={d.href} className="flex-1 lg:flex-none">
          <Ligacao
            href={d.href}
            aria-current={d.activo ? "page" : undefined}
            className={cn(
              "group flex min-h-14 flex-col items-center justify-center gap-1 rounded-controlo text-legenda text-tinta-suave lg:min-h-16",
              "transition-colors duration-feedback hover:text-tinta",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco",
              "aria-[current=page]:font-medium aria-[current=page]:text-accao",
            )}
          >
            <span
              aria-hidden
              className="flex h-8 w-14 items-center justify-center rounded-pilula transition-colors duration-feedback group-aria-[current=page]:bg-accao-suave [&_svg]:size-5"
            >
              {d.icone}
            </span>
            {d.rotulo}
          </Ligacao>
        </li>
      ))}
    </ul>
  </nav>
);
