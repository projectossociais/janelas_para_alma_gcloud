import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { LayoutApp } from "./LayoutApp";
import { LayoutEntrada } from "./LayoutEntrada";
import { LayoutSite } from "./LayoutSite";
import { LayoutTarefa } from "./LayoutTarefa";
import type { CabecalhoSiteProps } from "../navegacao/CabecalhoSite";
import type { RodapeProps } from "../navegacao/Rodape";

const cabecalho: CabecalhoSiteProps = {
  logotipo: <span />,
  inicio: { href: "/", rotulo: "Início" },
  destinos: [],
  accao: { rotulo: "Fazer o rastreio", href: "/scanner" },
  entrada: <span />,
  textos: { navegacao: "Principal", menu: "Menu", fechar: "Fechar" },
};
const rodape: RodapeProps = {
  ajuda: { titulo: "Ajuda", contactos: [] },
  colunas: [],
  logotipo: <span />,
  local: "Luanda",
  avisoClinico: "Triagem",
  legais: [],
  direitos: "©",
  rotuloNavegacao: "Rodapé",
};

/**
 * Bug real (2026-09-30): o rastreio novo ficou em branco a partir do passo 2.
 * Os `m.div` só animam dentro de `LazyMotion`, que só estava na montra; na app
 * a troca de passo ficava parada em `opacity: 0`. Cada arquétipo de página
 * traz agora o `ProvedorMovimento`.
 *
 * Como se prova: o provedor é `strict`, por isso um `motion.div` completo lá
 * dentro rebenta. Rebentar aqui é a prova de que o provedor está presente.
 */
const dentroDe = (layout: (filho: ReactNode) => ReactNode) => () =>
  render(<MemoryRouter>{layout(<motion.div />)}</MemoryRouter>);

describe("os arquétipos de página trazem o provedor de movimento", () => {
  const casos: [string, (filho: ReactNode) => ReactNode][] = [
    ["LayoutSite", (f) => <LayoutSite cabecalho={cabecalho} rodape={rodape} textoSaltar="Saltar">{f}</LayoutSite>],
    ["LayoutEntrada", (f) => <LayoutEntrada textoSaltar="Saltar" frase="Frase" factos={[]} logotipo={<span />} inicio={{ rotulo: "Início", href: "/" }} voltar={{ rotulo: "Voltar", href: "/" }}>{f}</LayoutEntrada>],
    ["LayoutTarefa", (f) => <LayoutTarefa tema="claro" textoSaltar="Saltar" passo={{ actual: 1, total: 2, rotulo: "Passo 1 de 2" }} sair={{ rotulo: "Sair", aoSair: () => {} }}>{f}</LayoutTarefa>],
    ["LayoutApp", (f) => <LayoutApp destinos={[]} rotuloNavegacao="App" simbolo={<span />} saudacao="Olá" conta={<span />} textoSaltar="Saltar">{f}</LayoutApp>],
  ];

  it.each(casos)("%s", (_, layout) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(dentroDe(layout)).toThrow(/LazyMotion|strict|motion/i);
  });
});
