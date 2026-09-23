import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// "Análises realizadas" lia directamente do Supabase (scanner_analyses),
// uma fonte que deixou de ser escrita depois da migração do Scanner para a
// API própria (screenings). Este teste fixa a fonte nova e garante que uma
// falha na chamada não rebenta o dashboard nem inventa um número.

const listarMinhas = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  screeningsApi: { listarMinhas: (...a: unknown[]) => listarMinhas(...a) },
}));

vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

let mockUser: { id: string; name: string } | null = { id: "u-1", name: "Ana" };
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

let mockProfile: { premium_ativo: boolean; papel: string } | null = null;
vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: mockProfile }),
}));

import DashboardUser from "./DashboardUser";

describe("DashboardUser — Análises realizadas", () => {
  beforeEach(() => {
    listarMinhas.mockReset();
    mockUser = { id: "u-1", name: "Ana" };
    mockProfile = null;
  });

  it("mostra a contagem real de rastreios devolvida pela API própria", async () => {
    listarMinhas.mockResolvedValue([{ id: "1" }, { id: "2" }, { id: "3" }]);

    render(
      <MemoryRouter>
        <DashboardUser />
      </MemoryRouter>,
    );

    expect(await screen.findByText("3")).toBeInTheDocument();
  });

  it("uma falha ao carregar o histórico mostra 0, nunca rebenta o ecrã", async () => {
    listarMinhas.mockRejectedValue(new Error("falha de rede"));

    render(
      <MemoryRouter>
        <DashboardUser />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Análises realizadas")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("sem utilizador autenticado, nunca chama a API", () => {
    mockUser = null;
    render(
      <MemoryRouter>
        <DashboardUser />
      </MemoryRouter>,
    );

    expect(listarMinhas).not.toHaveBeenCalled();
  });
});

describe("DashboardUser — Exercícios disponíveis", () => {
  beforeEach(() => {
    listarMinhas.mockReset();
    listarMinhas.mockResolvedValue([]);
    mockUser = { id: "u-1", name: "Ana" };
    mockProfile = null;
  });

  it("sem Premium, conta só os 4 exercícios gratuitos", () => {
    render(
      <MemoryRouter>
        <DashboardUser />
      </MemoryRouter>,
    );

    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("com Premium ativo, soma os 8 exercícios premium aos 4 gratuitos", () => {
    mockProfile = { premium_ativo: true, papel: "comum" };
    render(
      <MemoryRouter>
        <DashboardUser />
      </MemoryRouter>,
    );

    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("um admin também vê os exercícios premium, mesmo sem premium_ativo", () => {
    mockProfile = { premium_ativo: false, papel: "admin" };
    render(
      <MemoryRouter>
        <DashboardUser />
      </MemoryRouter>,
    );

    expect(screen.getByText("12")).toBeInTheDocument();
  });
});

describe("DashboardUser — Próxima teleconsulta", () => {
  it("mostra 'Em breve' em vez de um valor fabricado, já que a funcionalidade não existe", () => {
    listarMinhas.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <DashboardUser />
      </MemoryRouter>,
    );

    expect(screen.getByText("Em breve")).toBeInTheDocument();
  });
});
