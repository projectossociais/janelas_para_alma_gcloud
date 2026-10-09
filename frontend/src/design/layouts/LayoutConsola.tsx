import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "../cn";
import { Ligacao } from "../Ligacao";
import { SaltarConteudo } from "./Contentor";
import { estiloDestino } from "./estiloConsola";

/**
 * Arquétipo Consola (docs/LAYOUTS.md §2.5): portal da clínica e painel admin.
 * Trabalhar -- listas, filtros, estados de relance; zero decoração.
 *
 * - **Uma só navegação**, que muda de forma com o ecrã: barra lateral fixa no
 *   computador; no telemóvel, um botão "Menu" na barra de cima abre-a por
 *   baixo (nunca duas cópias escondidas por CSS).
 * - O conteúdo usa a largura toda (tabelas). O `<h1>` é o título de cada
 *   página (`CabecalhoConsola`), nunca o nome do painel repetido em todas.
 */
export interface DestinoConsola {
  rotulo: string;
  href: string;
  icone: ReactNode;
  activo?: boolean;
}

export interface GrupoConsola {
  /** Título do grupo (ex.: "Pedidos"); sem título, a lista aparece sozinha. */
  rotulo?: string;
  destinos: DestinoConsola[];
}

export interface LayoutConsolaProps {
  /** Nome do painel (ex.: "Administração"), no topo da navegação. Não é o `<h1>`. */
  nome: string;
  simbolo: ReactNode;
  grupos: GrupoConsola[];
  /** No fim da navegação: voltar ao site, terminar sessão. */
  rodapeNavegacao?: ReactNode;
  rotuloNavegacao: string;
  textoSaltar: string;
  textosMenu: { abrir: string; fechar: string };
  children: ReactNode;
}

export const LayoutConsola = ({
  nome,
  simbolo,
  grupos,
  rodapeNavegacao,
  rotuloNavegacao,
  textoSaltar,
  textosMenu,
  children,
}: LayoutConsolaProps) => {
  const [aberto, setAberto] = useState(false);
  const idNavegacao = "navegacao-consola";

  return (
    <div className="min-h-screen bg-fundo text-corpo text-tinta lg:flex">
      <SaltarConteudo rotulo={textoSaltar} />

      {/* Telemóvel: barra de cima com o nome e o botão do menu. */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-linha bg-superficie px-4 py-2 lg:hidden">
        <span className="w-8 shrink-0">{simbolo}</span>
        <span className="flex-1 truncate text-corpo font-medium">{nome}</span>
        <button
          type="button"
          aria-expanded={aberto}
          aria-controls={idNavegacao}
          onClick={() => setAberto((a) => !a)}
          className={cn(estiloDestino, "text-tinta")}
        >
          {aberto ? <X aria-hidden /> : <Menu aria-hidden />}
          {aberto ? textosMenu.fechar : textosMenu.abrir}
        </button>
      </div>

      <nav
        id={idNavegacao}
        aria-label={rotuloNavegacao}
        // Escolher um destino fecha o menu no telemóvel.
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setAberto(false);
        }}
        className={cn(
          "border-b border-linha bg-superficie px-3 py-4",
          aberto ? "block" : "hidden",
          "lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r",
        )}
      >
        <div className="hidden items-center gap-3 px-3 pb-6 lg:flex">
          <span className="w-8 shrink-0">{simbolo}</span>
          <span className="text-corpo font-medium">{nome}</span>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto">
          {grupos.map((grupo, i) => (
            <div key={grupo.rotulo ?? i}>
              {grupo.rotulo && <p className="px-3 pb-1 text-legenda font-medium text-tinta-suave">{grupo.rotulo}</p>}
              <ul className="space-y-0.5">
                {grupo.destinos.map((d) => (
                  <li key={d.href}>
                    <Ligacao href={d.href} aria-current={d.activo ? "page" : undefined} className={estiloDestino}>
                      <span aria-hidden>{d.icone}</span>
                      {d.rotulo}
                    </Ligacao>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {rodapeNavegacao && <div className="mt-6 space-y-0.5 border-t border-linha pt-4">{rodapeNavegacao}</div>}
      </nav>

      <main id="conteudo" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
};

/** Topo de cada página da Consola: o `<h1>`, uma linha de contexto e as acções da página. */
export const CabecalhoConsola = ({
  titulo,
  descricao,
  accoes,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  accoes?: ReactNode;
}) => (
  <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div className="min-w-0">
      <h1 className="text-titulo-m text-tinta">{titulo}</h1>
      {descricao && <p className="mt-1 text-corpo text-tinta-suave">{descricao}</p>}
    </div>
    {accoes && <div className="flex flex-wrap items-center gap-2">{accoes}</div>}
  </header>
);
