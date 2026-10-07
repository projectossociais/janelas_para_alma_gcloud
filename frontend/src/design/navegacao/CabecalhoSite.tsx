import type { ReactNode } from "react";
import * as Nav from "@radix-ui/react-navigation-menu";
import { ChevronDown } from "lucide-react";
import { cn } from "../cn";
import { Ligacao } from "../Ligacao";
import { Botao } from "../componentes/Botao";
import { Contentor } from "../layouts/Contentor";
import { useRolou } from "../useRolou";
import { MenuMovel } from "./MenuMovel";
import type { Destino } from "./tipos";

/**
 * Cabeçalho do arquétipo Site (docs/ESTRUTURA_SITE.md §3; docs/LAYOUTS.md §2.1).
 *
 * Computador: logótipo · 5 destinos (os que têm filhos abrem um painel com uma
 * linha a explicar cada destino, com clique e teclado) · idioma · "Entrar" · o
 * único botão cheio, a acção principal.
 * Telemóvel: logótipo · "Entrar" (sempre visível, nunca escondido no menu) ·
 * "Menu" com a palavra, que abre o menu em ecrã inteiro.
 * Ao descer, compacta-se (não se esconde: "Entrar" e a acção ficam à mão).
 */
export interface CabecalhoSiteProps {
  logotipo: ReactNode;
  inicio: { href: string; rotulo: string };
  destinos: Destino[];
  accao: { rotulo: string; href: string };
  /** "Entrar", ou o avatar com o menu da conta quando há sessão. */
  entrada: ReactNode;
  idioma?: ReactNode;
  textos: { navegacao: string; menu: string; fechar: string };
}

const estiloDestino = cn(
  "relative inline-flex min-h-alvo-app items-center gap-1 rounded-controlo px-3 text-corpo font-medium",
  "text-tinta-suave transition-colors duration-feedback hover:text-tinta",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco",
  // Página actual: mais do que a cor (peso e um traço por baixo).
  "aria-[current=page]:text-tinta data-[activo=true]:text-tinta",
  "after:absolute after:inset-x-3 after:bottom-1.5 after:h-0.5 after:rounded-pilula after:bg-accao after:opacity-0",
  "aria-[current=page]:after:opacity-100 data-[activo=true]:after:opacity-100",
);

export const CabecalhoSite = ({ logotipo, inicio, destinos, accao, entrada, idioma, textos }: CabecalhoSiteProps) => {
  const rolou = useRolou();
  return (
    <header
      data-rolou={rolou}
      className={cn(
        "sticky top-0 z-40 border-b bg-superficie/95 backdrop-blur transition-[padding,border-color,box-shadow] duration-transicao ease-padrao",
        rolou ? "border-linha py-2 shadow-nivel-1" : "border-transparent py-4",
      )}
    >
      <Contentor className="flex items-center gap-6">
        <Ligacao
          href={inicio.href}
          aria-label={inicio.rotulo}
          className="shrink-0 rounded-controlo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foco"
        >
          <span className="block h-9 lg:h-10 [&>img]:h-full [&>img]:w-auto">{logotipo}</span>
        </Ligacao>

        <Nav.Root aria-label={textos.navegacao} className="relative hidden lg:block">
          <Nav.List className="flex items-center gap-1">
            {destinos.map((d) =>
              d.filhos?.length ? (
                <Nav.Item key={d.href} className="relative">
                  <Nav.Trigger data-activo={d.activo} className={cn(estiloDestino, "group")}>
                    {d.rotulo}
                    <ChevronDown
                      aria-hidden
                      className="size-4 transition-transform duration-transicao group-data-[state=open]:rotate-180 motion-reduce:transition-none"
                    />
                  </Nav.Trigger>
                  <Nav.Content
                    className={cn(
                      "absolute left-0 top-full mt-2 w-96 rounded-cartao border border-linha bg-superficie-elevada p-2 shadow-nivel-2",
                      "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1",
                      "motion-reduce:animate-none",
                    )}
                  >
                    <ul className="grid gap-1">
                      {d.filhos.map((f) => (
                        <li key={f.href}>
                          <Nav.Link asChild active={f.activo}>
                            <Ligacao
                              href={f.href}
                              aria-current={f.activo ? "page" : undefined}
                              className={cn(
                                "block rounded-controlo p-3 transition-colors duration-feedback hover:bg-superficie-alt",
                                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-foco",
                                "aria-[current=page]:bg-accao-suave",
                              )}
                            >
                              <span className="block text-corpo font-medium text-tinta">{f.rotulo}</span>
                              {f.descricao && (
                                <span className="mt-0.5 block text-legenda text-tinta-suave">{f.descricao}</span>
                              )}
                            </Ligacao>
                          </Nav.Link>
                        </li>
                      ))}
                    </ul>
                  </Nav.Content>
                </Nav.Item>
              ) : (
                <Nav.Item key={d.href}>
                  <Nav.Link asChild active={d.activo}>
                    <Ligacao href={d.href} aria-current={d.activo ? "page" : undefined} className={estiloDestino}>
                      {d.rotulo}
                    </Ligacao>
                  </Nav.Link>
                </Nav.Item>
              ),
            )}
          </Nav.List>
        </Nav.Root>

        <div className="ml-auto flex items-center gap-2">
          {idioma && <div className="hidden lg:block">{idioma}</div>}
          {entrada}
          <Botao asChild className="hidden lg:inline-flex">
            <Ligacao href={accao.href}>{accao.rotulo}</Ligacao>
          </Botao>
          <MenuMovel
            destinos={destinos}
            accao={accao}
            idioma={idioma}
            logotipo={logotipo}
            textos={textos}
            className="lg:hidden"
          />
        </div>
      </Contentor>
    </header>
  );
};
