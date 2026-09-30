import type { ReactNode } from "react";
import * as Radix from "@radix-ui/react-dialog";
import { ChevronRight, Menu, X } from "lucide-react";
import { cn } from "../cn";
import { Ligacao } from "../Ligacao";
import { Botao } from "../componentes/Botao";
import type { Destino } from "./tipos";

/**
 * Menu do telemóvel em ecrã inteiro (docs/ESTRUTURA_SITE.md §3).
 *
 * - O botão diz "Menu" por extenso: um ícone sozinho esconde a navegação e
 *   reduz a quase metade quem a encontra (NN/g, PESQUISA_UX §5).
 * - Destinos com filhos aparecem como grupos com título; alvos de 56 px.
 * - A acção principal fica em baixo, na zona do polegar.
 * - Fecha ao escolher um destino, com Esc ou com "Fechar"; o foco fica preso
 *   lá dentro e volta ao botão "Menu" (Radix Dialog).
 */
export interface MenuMovelProps {
  destinos: Destino[];
  accao: { rotulo: string; href: string };
  logotipo: ReactNode;
  idioma?: ReactNode;
  textos: { navegacao: string; menu: string; fechar: string };
  className?: string;
}

const estiloLinha = cn(
  "flex min-h-14 items-center justify-between gap-4 border-b border-linha text-corpo-g font-medium text-tinta",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco",
  "aria-[current=page]:text-accao",
);

const LinhaDestino = ({ rotulo, href, activo }: { rotulo: string; href: string; activo?: boolean }) => (
  <li>
    <Radix.Close asChild>
      <Ligacao href={href} aria-current={activo ? "page" : undefined} className={estiloLinha}>
        {rotulo}
        <ChevronRight aria-hidden className="size-5 text-tinta-suave" />
      </Ligacao>
    </Radix.Close>
  </li>
);

export const MenuMovel = ({ destinos, accao, logotipo, idioma, textos, className }: MenuMovelProps) => (
  <Radix.Root>
    <Radix.Trigger asChild>
      <Botao variante="fantasma" className={cn("gap-2 px-3", className)}>
        <Menu aria-hidden />
        {textos.menu}
      </Botao>
    </Radix.Trigger>
    <Radix.Portal>
      <Radix.Content
        aria-describedby={undefined}
        className={cn(
          "fixed inset-0 z-50 flex flex-col overflow-y-auto bg-superficie",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          "duration-transicao motion-reduce:animate-none",
        )}
      >
        <Radix.Title className="sr-only">{textos.menu}</Radix.Title>
        <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <span className="block h-9 [&>img]:h-full [&>img]:w-auto">{logotipo}</span>
          <Radix.Close asChild>
            <Botao variante="fantasma" className="gap-2 px-3">
              <X aria-hidden />
              {textos.fechar}
            </Botao>
          </Radix.Close>
        </div>

        <nav aria-label={textos.navegacao} className="flex-1 px-4 pb-8 sm:px-6">
          {destinos.map((d) =>
            d.filhos?.length ? (
              <section key={d.href} className="mt-8 first:mt-4">
                <h2 className="text-legenda font-medium uppercase tracking-wide text-tinta-suave">{d.rotulo}</h2>
                <ul className="mt-2">
                  {d.filhos.map((f) => (
                    <LinhaDestino key={f.href} rotulo={f.rotulo} href={f.href} activo={f.activo} />
                  ))}
                </ul>
              </section>
            ) : (
              <ul key={d.href} className="mt-4 first:mt-2">
                <LinhaDestino rotulo={d.rotulo} href={d.href} activo={d.activo} />
              </ul>
            ),
          )}
        </nav>

        <div className="sticky bottom-0 flex flex-col gap-3 border-t border-linha bg-superficie px-4 py-4 sm:px-6">
          <Radix.Close asChild>
            <Botao asChild tamanho="g" larguraTotal>
              <Ligacao href={accao.href}>{accao.rotulo}</Ligacao>
            </Botao>
          </Radix.Close>
          {idioma && <div className="flex justify-center">{idioma}</div>}
        </div>
      </Radix.Content>
    </Radix.Portal>
  </Radix.Root>
);
