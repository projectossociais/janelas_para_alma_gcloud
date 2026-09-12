import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Exercicios from "./Exercicios";

// O que importa testar aqui: o acesso aos exercícios premium decide-se por
// profile.premium_ativo (ou papel admin), nunca mais pelo bypass fixo
// `temAcessoPremium = true` que existia antes (CLAUDE.md secção 8 — decidir
// acesso exige teste).

vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/FeedbackWidget", () => ({ default: () => null }));

let mockProfile: Record<string, unknown> | null = null;
vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: mockProfile, loading: false, refetch: vi.fn(), setProfile: vi.fn() }),
}));

const baseProfile = {
  id: "user-1",
  nome_completo: "Ana Teste",
  email: "ana@example.com",
  biografia: null,
  data_nascimento: null,
  genero: null,
  telefone: null,
  provincia: null,
  avatar_url: null,
  notificacoes_projetos: false,
  notificacoes_lembretes: false,
  notificacoes_comunidade: false,
  created_at: "2026-01-01T00:00:00.000Z",
};

const renderPagina = () =>
  render(
    <MemoryRouter>
      <Exercicios />
    </MemoryRouter>,
  );

describe("Exercicios — acesso ao plano Premium", () => {
  it("sem premium_ativo e sem sessão: exercícios premium ficam bloqueados", () => {
    mockProfile = null;
    renderPagina();

    expect(screen.getAllByLabelText(/conteúdo bloqueado/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /desbloquear tudo/i })).toBeInTheDocument();
  });

  it("com sessão mas premium_ativo=false: continua bloqueado", () => {
    mockProfile = { ...baseProfile, papel: "comum", premium_ativo: false };
    renderPagina();

    expect(screen.getAllByLabelText(/conteúdo bloqueado/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /desbloquear tudo/i })).toBeInTheDocument();
  });

  it("com premium_ativo=true: exercícios premium ficam desbloqueados", () => {
    mockProfile = { ...baseProfile, papel: "comum", premium_ativo: true };
    renderPagina();

    expect(screen.queryAllByLabelText(/conteúdo bloqueado/i)).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /desbloquear tudo/i })).not.toBeInTheDocument();
  });

  it("papel admin sem premium_ativo: também fica desbloqueado", () => {
    mockProfile = { ...baseProfile, papel: "admin", premium_ativo: false };
    renderPagina();

    expect(screen.queryAllByLabelText(/conteúdo bloqueado/i)).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /desbloquear tudo/i })).not.toBeInTheDocument();
  });
});
