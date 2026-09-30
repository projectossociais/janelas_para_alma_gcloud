import type { ReactNode } from "react";
import { NavegacaoApp, type DestinoApp } from "../navegacao/NavegacaoApp";
import { Contentor, SaltarConteudo } from "./Contentor";
import { ProvedorMovimento } from "../ProvedorMovimento";

/**
 * Arquétipo App (docs/LAYOUTS.md §2.4): voltar todos os dias e saber logo o
 * que fazer. Cabeçalho compacto com a saudação pelo nome e as acções da conta;
 * navegação em separadores (telemóvel) ou barra lateral (computador); sem
 * rodapé. O conteúdo reserva espaço para a barra de baixo nunca tapar nada.
 */
export interface LayoutAppProps {
  destinos: DestinoApp[];
  rotuloNavegacao: string;
  simbolo: ReactNode;
  saudacao: ReactNode;
  subtitulo?: ReactNode;
  /** Notificações, avatar e menu da conta. */
  conta: ReactNode;
  textoSaltar: string;
  children: ReactNode;
}

export const LayoutApp = ({
  destinos,
  rotuloNavegacao,
  simbolo,
  saudacao,
  subtitulo,
  conta,
  textoSaltar,
  children,
}: LayoutAppProps) => (
  <ProvedorMovimento>
    <div className="flex min-h-screen bg-fundo text-corpo text-tinta">
      <SaltarConteudo rotulo={textoSaltar} />
      <NavegacaoApp destinos={destinos} rotulo={rotuloNavegacao} topo={simbolo} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header>
          <Contentor largura="largo" className="flex items-start justify-between gap-4 pb-2 pt-6 lg:pt-10">
            <div>
              <h1 className="text-titulo-m text-tinta">{saudacao}</h1>
              {subtitulo && <p className="mt-1 text-corpo text-tinta-suave">{subtitulo}</p>}
            </div>
            <div className="flex items-center gap-2">{conta}</div>
          </Contentor>
        </header>
        <main id="conteudo" tabIndex={-1} className="flex-1 outline-none">
          <Contentor largura="largo" className="pb-28 pt-6 lg:pb-12">
            {children}
          </Contentor>
        </main>
      </div>
    </div>
  </ProvedorMovimento>
);
