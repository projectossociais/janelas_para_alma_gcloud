import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ptAO from "@/i18n/locales/pt-AO.json";
import { violacoesAcessibilidade } from "@/design/testes/acessibilidade";

let mockLogado = false;
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoggedIn: mockLogado }),
}));

const obterAtivo = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  bannerHomepageApi: { obterAtivo: (...a: unknown[]) => obterAtivo(...a) },
}));

import Inicio from "./Inicio";

const T = ptAO.Inicio;
const S = ptAO.SiteNovo;

const montar = () =>
  render(
    <MemoryRouter>
      <Inicio />
    </MemoryRouter>,
  );

describe("Inicio (página inicial do site novo)", () => {
  beforeEach(() => {
    mockLogado = false;
    obterAtivo.mockReset();
    obterAtivo.mockResolvedValue(null);
  });

  it("um só título principal, que diz o resultado para o pai", () => {
    montar();
    const titulos = screen.getAllByRole("heading", { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toHaveTextContent("Descubra em 2 minutos");
  });

  it("a acção principal leva ao rastreio", () => {
    montar();
    const main = screen.getByRole("main");
    expect(within(main).getByRole("link", { name: T.fazerRastreio })).toHaveAttribute("href", "/scanner");
  });

  it("sem sessão, o cabeçalho mostra 'Entrar' (para /login)", () => {
    montar();
    const cabecalho = screen.getByRole("banner");
    expect(within(cabecalho).getByRole("link", { name: S.entrar })).toHaveAttribute("href", "/login");
  });

  it("com sessão, mostra 'A minha área' (para o painel) em vez de 'Entrar'", () => {
    mockLogado = true;
    montar();
    const cabecalho = screen.getByRole("banner");
    expect(within(cabecalho).getByRole("link", { name: S.minhaArea })).toHaveAttribute("href", "/dashboard");
    expect(within(cabecalho).queryByRole("link", { name: S.entrar })).not.toBeInTheDocument();
  });

  it("o preço está dito às claras e a consulta abre a marcação", () => {
    montar();
    expect(screen.getByText(T.treinosPreco)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: T.consultaBotao })).toHaveAttribute("href", "/parceiros?agendar=optiotica");
  });

  it("o jogo Inclusivamente tem um ponto de entrada (a página antiga tinha; não pode desaparecer)", () => {
    montar();
    expect(screen.getByRole("link", { name: new RegExp(T.jogoBotao) })).toHaveAttribute("href", "/jogo-curiosidades");
  });

  it("mostra a campanha activa definida pelos admins", async () => {
    obterAtivo.mockResolvedValue({
      id: "1",
      titulo: "Campanha na Gamek",
      descricao: "Rastreios grátis no sábado.",
      link: "/kamba",
      imagem_url: "https://exemplo/campanha.jpg",
    });
    montar();
    expect(await screen.findByRole("heading", { name: "Campanha na Gamek" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: T.campanhaSaberMais })).toHaveAttribute("href", "/kamba");
  });

  it("se a API da campanha falhar, a página continua inteira e sem a secção", async () => {
    obterAtivo.mockRejectedValue(new Error("rede"));
    montar();
    await waitFor(() => expect(obterAtivo).toHaveBeenCalled());
    expect(screen.queryByRole("link", { name: T.campanhaSaberMais })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: T.perguntasTitulo })).toBeInTheDocument();
  });

  it("tem o salto para o conteúdo e o contacto humano no rodapé", () => {
    montar();
    expect(screen.getByRole("link", { name: S.saltar })).toHaveAttribute("href", "#conteudo");
    const rodape = screen.getByRole("contentinfo");
    expect(within(rodape).getByRole("link", { name: /926 969 819/ })).toHaveAttribute("href", "tel:+244926969819");
  });

  it("sem violações de acessibilidade", async () => {
    const { container } = montar();
    await waitFor(() => expect(obterAtivo).toHaveBeenCalled());
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
