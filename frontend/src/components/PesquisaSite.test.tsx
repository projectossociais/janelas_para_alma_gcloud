import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const listarPublicadas = vi.fn();
const listarClinicas = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  publicacoesApi: { listarPublicadas: () => listarPublicadas() },
  agendamentosApi: { listarClinicas: () => listarClinicas() },
}));

const useAuthMock = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => useAuthMock() }));

import PesquisaSite from "./PesquisaSite";
import { esquecerDadosDaPesquisa } from "@/lib/pesquisa/dadosDaApi";

const Onde = () => {
  const { pathname, hash } = useLocation();
  return <p data-testid="onde">{pathname + hash}</p>;
};

function renderPesquisa() {
  const onMudar = vi.fn();
  render(
    <MemoryRouter initialEntries={["/"]}>
      <PesquisaSite aberta onMudar={onMudar} />
      <Routes>
        <Route path="*" element={<Onde />} />
      </Routes>
    </MemoryRouter>,
  );
  return { onMudar, campo: screen.getByRole("combobox", { name: "Pesquisar" }) };
}

const opcoes = () => screen.getAllByRole("option");

describe("PesquisaSite", () => {
  beforeEach(() => {
    esquecerDadosDaPesquisa();
    useAuthMock.mockReturnValue({ isLoggedIn: false, user: null });
    listarPublicadas.mockReset().mockResolvedValue([
      {
        id: "p1",
        slug: "rastreio-no-cazenga",
        titulo: "Rastreio no Cazenga",
        resumo: "Um dia de rastreios numa escola.",
        corpo: "Falámos com as famílias.",
        local: null,
      },
    ]);
    listarClinicas.mockReset().mockResolvedValue([{ id: "c1", nome: "Clínica Girassol" }]);
  });

  it("antes de escrever mostra sugestões", async () => {
    renderPesquisa();
    expect(screen.getByText("Sugestões")).toBeInTheDocument();
    expect(opcoes().length).toBeGreaterThan(3);
    expect(screen.getByRole("option", { name: /Rastreio de Estrabismo/ })).toBeInTheDocument();
  });

  it("encontra uma página sem acentos e abre-a com Enter", async () => {
    const user = userEvent.setup();
    const { campo, onMudar } = renderPesquisa();

    await user.type(campo, "politica de privacidade");
    expect(opcoes()[0]).toHaveTextContent("Política de Privacidade");
    expect(opcoes()[0]).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Enter}");
    expect(screen.getByTestId("onde")).toHaveTextContent("/politica-de-privacidade");
    expect(onMudar).toHaveBeenCalledWith(false);
  });

  it("as setas escolhem outro resultado e o clique abre-o", async () => {
    const user = userEvent.setup();
    const { campo } = renderPesquisa();

    await user.type(campo, "doar");
    const antes = opcoes();
    expect(antes.length).toBeGreaterThan(1);
    await user.keyboard("{ArrowDown}");
    expect(opcoes()[1]).toHaveAttribute("aria-selected", "true");
    expect(opcoes()[0]).toHaveAttribute("aria-selected", "false");

    await user.click(screen.getByRole("option", { name: /Apoiar a Causa/ }));
    expect(screen.getByTestId("onde")).toHaveTextContent("/apoiar");
  });

  it("encontra publicações e clínicas vindas da API", async () => {
    const user = userEvent.setup();
    const { campo } = renderPesquisa();

    await user.type(campo, "cazenga");
    const publicacao = await screen.findByRole("option", { name: /Rastreio no Cazenga/ });
    expect(within(publicacao).getByText("Publicação")).toBeInTheDocument();

    await user.clear(campo);
    await user.type(campo, "girassol");
    await user.click(screen.getByRole("option", { name: /Clínica Girassol/ }));
    expect(screen.getByTestId("onde")).toHaveTextContent("/parceiros#parceiros-clinicos");
  });

  it("se a API falhar, o resto do site continua a encontrar-se e a pesquisa diz que está incompleta", async () => {
    listarPublicadas.mockRejectedValue(new Error("sem rede"));
    const user = userEvent.setup();
    const { campo } = renderPesquisa();

    expect(await screen.findByText(/não foi possível procurar nas publicações/i)).toBeInTheDocument();
    await user.type(campo, "estrabismo");
    expect(opcoes()[0]).toHaveTextContent("O que é o Estrabismo?");
  });

  it("sem resultados diz que não encontrou e mantém as sugestões e o contacto", async () => {
    const user = userEvent.setup();
    const { campo } = renderPesquisa();

    await user.type(campo, "xyzabc");
    expect(screen.getByText('Não encontrámos nada para "xyzabc".')).toBeInTheDocument();
    expect(screen.getByText("Sugestões")).toBeInTheDocument();
    expect(opcoes().length).toBeGreaterThan(3);
    expect(screen.getByRole("link", { name: /Fale connosco/ })).toHaveAttribute("href", "/junte-se#contacto");

    // Enter não abre uma sugestão que a pessoa não escolheu.
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("onde")).toHaveTextContent(/^\/$/);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(screen.getByTestId("onde")).toHaveTextContent("/scanner");
  });

  it("páginas de conta só aparecem com sessão", async () => {
    const user = userEvent.setup();
    const { campo } = renderPesquisa();
    await user.type(campo, "editar perfil");
    expect(screen.queryByRole("option", { name: /Editar Perfil/ })).not.toBeInTheDocument();
  });

  it("com sessão, encontra as páginas da conta", async () => {
    useAuthMock.mockReturnValue({ isLoggedIn: true, user: { role: "estrabico" } });
    const user = userEvent.setup();
    const { campo } = renderPesquisa();
    await user.type(campo, "editar perfil");
    expect(opcoes()[0]).toHaveTextContent("Editar Perfil");
  });
});
