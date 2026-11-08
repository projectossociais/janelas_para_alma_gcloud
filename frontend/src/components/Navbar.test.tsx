import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// UX-06: nenhum utilizador logado (estrábico ou profissional de clínica) tinha
// um link visível para o seu próprio painel -- só o admin tinha. Este ficheiro
// cobre só esse comportamento de navegação, não o resto do Navbar (visual).

const useAuthMock = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: null }),
}));

vi.mock("@/contexts/SiteBannerContext", () => ({
  useSiteBannerAltura: () => 0,
}));

vi.mock("@/components/NotificationBell", () => ({ default: () => null }));

import Navbar from "./Navbar";

function renderComRota() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Navbar />
      <Routes>
        <Route path="/" element={null} />
        <Route path="/dashboard" element={<div>Painel do utilizador</div>} />
        <Route path="/dashboard-pro" element={<div>Painel da clínica</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function abrirMenuDePerfil(user: ReturnType<typeof userEvent.setup>) {
  const botoesPerfil = screen.getAllByRole("button", { name: /perfil/i });
  await user.click(botoesPerfil[0]);
}

describe("Navbar — link para o painel próprio", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  it("utilizador estrábico vê 'O Meu Painel' e é levado a /dashboard", async () => {
    useAuthMock.mockReturnValue({
      isLoggedIn: true,
      isAdmin: false,
      user: { name: "Ana", email: "ana@example.com", role: "estrabico" },
      logout: vi.fn(),
    });
    const user = userEvent.setup();
    renderComRota();

    await abrirMenuDePerfil(user);
    await user.click(screen.getByRole("button", { name: /O Meu Painel/i }));

    expect(await screen.findByText("Painel do utilizador")).toBeInTheDocument();
  });

  it("profissional de clínica vê 'O Meu Painel' e é levado a /dashboard-pro", async () => {
    useAuthMock.mockReturnValue({
      isLoggedIn: true,
      isAdmin: false,
      user: { name: "Dr.ª Ana", email: "dra.ana@example.com", role: "profissional" },
      logout: vi.fn(),
    });
    const user = userEvent.setup();
    renderComRota();

    await abrirMenuDePerfil(user);
    await user.click(screen.getByRole("button", { name: /O Meu Painel/i }));

    expect(await screen.findByText("Painel da clínica")).toBeInTheDocument();
  });

  it("admin não vê 'O Meu Painel' -- só o Painel Admin", async () => {
    useAuthMock.mockReturnValue({
      isLoggedIn: true,
      isAdmin: true,
      user: { name: "Admin", email: "admin@example.com", role: "admin" },
      logout: vi.fn(),
    });
    const user = userEvent.setup();
    renderComRota();

    await abrirMenuDePerfil(user);
    expect(screen.getByRole("button", { name: /Painel Admin/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /O Meu Painel/i })).not.toBeInTheDocument();
  });

  it("visitante sem sessão não vê nenhum link de painel", async () => {
    useAuthMock.mockReturnValue({ isLoggedIn: false, isAdmin: false, user: null, logout: vi.fn() });
    renderComRota();

    expect(screen.queryByRole("button", { name: /O Meu Painel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Painel Admin/i })).not.toBeInTheDocument();
  });
});

describe("Navbar — menus suspensos do cabeçalho", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    useAuthMock.mockReturnValue({ isLoggedIn: false, isAdmin: false, user: null, logout: vi.fn() });
  });

  it("abre por clique, mostra os destinos e fecha com Escape devolvendo o foco ao botão", async () => {
    const user = userEvent.setup();
    renderComRota();
    const botao = screen.getByRole("button", { name: "Sobre Nós" });
    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: /A Nossa Equipa/ })).not.toBeInTheDocument();

    await user.click(botao);

    expect(botao).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /A Nossa Equipa/ })).toHaveAttribute("href", "/equipa");
    expect(screen.getByRole("link", { name: /Contactos/ })).toHaveAttribute("href", "/junte-se#contacto");
    expect(screen.getByRole("link", { name: /FAQs/ })).toHaveAttribute("href", "/faq");

    // Um segundo clique fecha; a seta para baixo abre e leva o foco ao primeiro destino.
    await user.click(botao);
    expect(botao).toHaveAttribute("aria-expanded", "false");
    botao.focus();
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(screen.getByRole("link", { name: /A Nossa Equipa/ })).toHaveFocus());
    await user.keyboard("{Escape}");
    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(botao).toHaveFocus();
  });

  it("só um menu aberto de cada vez", async () => {
    const user = userEvent.setup();
    renderComRota();
    await user.click(screen.getByRole("button", { name: "Sobre Nós" }));
    await user.click(screen.getByRole("button", { name: "Serviços" }));

    expect(screen.getByRole("button", { name: "Sobre Nós" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("link", { name: /Triagem Ocular/ })).toHaveAttribute("href", "/scanner");
    expect(screen.getByRole("link", { name: /Exercícios Visuais/ })).toHaveAttribute("href", "/exercicios");
  });

  it("Doar Agora oferece doar uma vez e doar mensalmente", async () => {
    const user = userEvent.setup();
    renderComRota();
    await user.click(screen.getByRole("button", { name: "Doar Agora" }));

    expect(screen.getByRole("link", { name: /Doar Uma Vez/ })).toHaveAttribute("href", "/apoiar?modo=unica");
    expect(screen.getByRole("link", { name: /Doar Mensalmente/ })).toHaveAttribute("href", "/apoiar?modo=mensal");
  });

  it("O Nosso Trabalho e Portal Clínico têm os destinos pedidos", async () => {
    const user = userEvent.setup();
    renderComRota();
    await user.click(screen.getByRole("button", { name: "O Nosso Trabalho" }));
    expect(screen.getByRole("link", { name: /Meu Kamba Estrábico/ })).toHaveAttribute("href", "/kamba");
    expect(screen.getByRole("link", { name: /^Blog/ })).toHaveAttribute("href", "/publicacoes#artigos");
    expect(screen.getByRole("link", { name: /Sobre|O Estrabismo/ })).toHaveAttribute("href", "/sobre");

    await user.click(screen.getByRole("button", { name: "Portal Clínico" }));
    expect(screen.getByRole("link", { name: /Rede de Parceiros de Saúde/ })).toHaveAttribute("href", "/parceiros");
    expect(screen.getByRole("link", { name: /Óptica Optioptika/ })).toHaveAttribute("href", "/portal-clinico/optioptika");
  });
});
