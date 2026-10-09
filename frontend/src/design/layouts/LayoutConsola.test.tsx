import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CabecalhoConsola, LayoutConsola } from "./LayoutConsola";
import { Estado, Tabela, TabelaCabecalho, TabelaCelula, TabelaCorpo, TabelaLinha, TabelaTitulo } from "../componentes/Tabela";
import { violacoesAcessibilidade } from "../testes/acessibilidade";

const Exemplo = () => (
  <LayoutConsola
    nome="Administração"
    simbolo={<span>JPA</span>}
    rotuloNavegacao="Navegação do painel"
    textoSaltar="Saltar para o conteúdo"
    textosMenu={{ abrir: "Menu", fechar: "Fechar" }}
    grupos={[
      { destinos: [{ rotulo: "Visão geral", href: "/admin", icone: <span />, activo: true }] },
      { rotulo: "Pessoas", destinos: [{ rotulo: "Utilizadores", href: "/admin/utilizadores", icone: <span /> }] },
    ]}
    rodapeNavegacao={<a href="/dashboard">Voltar ao site</a>}
  >
    <CabecalhoConsola titulo="Utilizadores" descricao="Contas registadas." accoes={<button type="button">Exportar</button>} />
    <Tabela legenda="Utilizadores">
      <TabelaCabecalho>
        <TabelaLinha>
          <TabelaTitulo>Nome</TabelaTitulo>
          <TabelaTitulo numerico>Sessões</TabelaTitulo>
          <TabelaTitulo>Estado</TabelaTitulo>
        </TabelaLinha>
      </TabelaCabecalho>
      <TabelaCorpo>
        <TabelaLinha>
          <TabelaCelula>Ana</TabelaCelula>
          <TabelaCelula numerico>12</TabelaCelula>
          <TabelaCelula>
            <Estado tom="sucesso">Activa</Estado>
          </TabelaCelula>
        </TabelaLinha>
      </TabelaCorpo>
    </Tabela>
  </LayoutConsola>
);

describe("LayoutConsola", () => {
  it("uma só navegação, com o destino actual marcado", () => {
    render(<Exemplo />);
    const nav = screen.getByRole("navigation", { name: "Navegação do painel" });
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    expect(within(nav).getByRole("link", { name: "Visão geral" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Utilizadores" })).not.toHaveAttribute("aria-current");
    expect(within(nav).getByText("Pessoas")).toBeInTheDocument();
  });

  it("o h1 é o título da página, não o nome do painel", () => {
    render(<Exemplo />);
    const titulos = screen.getAllByRole("heading", { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toHaveTextContent("Utilizadores");
  });

  it("no telemóvel, o botão Menu abre e fecha a navegação e diz se está aberta", async () => {
    render(<Exemplo />);
    const botao = screen.getByRole("button", { name: "Menu" });
    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(botao).toHaveAttribute("aria-controls", "navegacao-consola");
    await userEvent.click(botao);
    expect(screen.getByRole("button", { name: "Fechar" })).toHaveAttribute("aria-expanded", "true");
  });

  it("escolher um destino fecha o menu do telemóvel", async () => {
    render(<Exemplo />);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    const nav = screen.getByRole("navigation");
    nav.querySelector("a")?.addEventListener("click", (e) => e.preventDefault());
    await userEvent.click(within(nav).getByRole("link", { name: "Visão geral" }));
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("'Saltar para o conteúdo' é o primeiro elemento focável e leva ao main", async () => {
    render(<Exemplo />);
    await userEvent.tab();
    const saltar = screen.getByRole("link", { name: "Saltar para o conteúdo" });
    expect(saltar).toHaveFocus();
    expect(saltar).toHaveAttribute("href", "#conteudo");
    expect(screen.getByRole("main")).toHaveAttribute("id", "conteudo");
  });

  it("a tabela tem nome, cabeçalhos de coluna e uma zona de scroll focável", () => {
    render(<Exemplo />);
    const tabela = screen.getByRole("table", { name: "Utilizadores" });
    expect(within(tabela).getAllByRole("columnheader")).toHaveLength(3);
    expect(screen.getByRole("region", { name: "Utilizadores" })).toHaveAttribute("tabindex", "0");
  });

  it("sem violações de acessibilidade", async () => {
    const { container } = render(<Exemplo />);
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
