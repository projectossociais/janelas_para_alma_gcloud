import type { ReactNode } from "react";
import { CabecalhoSite, type CabecalhoSiteProps } from "../navegacao/CabecalhoSite";
import { Rodape, type RodapeProps } from "../navegacao/Rodape";
import { BarraInferior } from "./BarraInferior";
import { SaltarConteudo } from "./Contentor";
import { ProvedorMovimento } from "../ProvedorMovimento";

/**
 * Arquétipo Site (docs/LAYOUTS.md §2.1): ler e decidir. Cabeçalho completo,
 * conteúdo editorial, rodapé completo e, no telemóvel, a barra da acção
 * principal quando a página pede (`barraMovel`).
 */
export interface LayoutSiteProps {
  cabecalho: CabecalhoSiteProps;
  rodape: RodapeProps;
  textoSaltar: string;
  /** Conteúdo da barra fixa do telemóvel (normalmente a acção principal). */
  barraMovel?: ReactNode;
  /** Mostrar a barra (ex.: só depois de a abertura sair do ecrã). */
  barraVisivel?: boolean;
  children: ReactNode;
}

export const LayoutSite = ({ cabecalho, rodape, textoSaltar, barraMovel, barraVisivel = true, children }: LayoutSiteProps) => (
  <ProvedorMovimento>
    <div className="flex min-h-screen flex-col bg-fundo text-corpo text-tinta">
      <SaltarConteudo rotulo={textoSaltar} />
      <CabecalhoSite {...cabecalho} />
      {/* tabIndex -1: o "Saltar para o conteúdo" põe mesmo o foco aqui. */}
      <main id="conteudo" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <div className={barraMovel ? "pb-24 lg:pb-0" : undefined}>
        <Rodape {...rodape} />
      </div>
      {barraMovel && <BarraInferior visivel={barraVisivel}>{barraMovel}</BarraInferior>}
    </div>
  </ProvedorMovimento>
);
