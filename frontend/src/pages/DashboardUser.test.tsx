import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// "Análises realizadas" lia directamente do Supabase (scanner_analyses),
// uma fonte que deixou de ser escrita depois da migração do Scanner para a
// API própria (screenings). Este teste fixa a fonte nova e garante que uma
// falha na chamada não rebenta o dashboard nem inventa um número.

const listarMinhas = vi.fn();
const minhaProximaTeleconsulta = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  screeningsApi: { listarMinhas: (...a: unknown[]) => listarMinhas(...a) },
  agendamentosApi: { minhaProximaTeleconsulta: (...a: unknown[]) => minhaProximaTeleconsulta(...a) },
  linkDaSalaVideo: (sala: string) => `https://meet.jit.si/${sala}`,
}));

vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/PremiumRequestBanner", () => ({ default: () => null }));

let mockUser: { id: string; name: string } | null = { id: "u-1", name: "Ana" };
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

let mockDesbloqueados: string[] = [];
vi.mock("@/contexts/AcessoExerciciosContext", () => ({
  useAcessoExercicios: () => ({ acesso: { exercicios_desbloqueados: mockDesbloqueados } }),
}));

import DashboardUser from "./DashboardUser";

describe("DashboardUser — Análises realizadas", () => {
  beforeEach(() => {
    listarMinhas.mockReset();
    minhaProximaTeleconsulta.mockReset();
    minhaProximaTeleconsulta.mockResolvedValue(null);
    mockUser = { id: "u-1", name: "Ana" };
    mockDesbloqueados = [];
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

    const rotulo = await screen.findByText("Análises realizadas");
    expect(rotulo.previousSibling).toHaveTextContent("0");
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
    minhaProximaTeleconsulta.mockReset();
    minhaProximaTeleconsulta.mockResolvedValue(null);
    mockUser = { id: "u-1", name: "Ana" };
    mockDesbloqueados = [];
  });

  it("sem teste nem Premium, mostra 0 -- os 8 exercícios são pagos", () => {
    render(
      <MemoryRouter>
        <DashboardUser />
      </MemoryRouter>,
    );

    expect(screen.getByText("Exercícios disponíveis").previousSibling).toHaveTextContent("0");
  });

  it("com o teste de 7 dias activo, conta os 4 exercícios do teste", () => {
    mockDesbloqueados = ["figure8", "ambliopia", "cerebro", "relax"];
    render(
      <MemoryRouter>
        <DashboardUser />
      </MemoryRouter>,
    );

    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("com Premium (ou admin), conta os 8", () => {
    mockDesbloqueados = [
      "figure8",
      "convergence",
      "cerebro",
      "relax",
      "ambliopia",
      "sacadas-convergencia",
      "flexibilidade-acomodativa",
      "estereopsia",
    ];
    render(
      <MemoryRouter>
        <DashboardUser />
      </MemoryRouter>,
    );

    expect(screen.getByText("8")).toBeInTheDocument();
  });
});

describe("DashboardUser — Próxima teleconsulta", () => {
  beforeEach(() => {
    listarMinhas.mockReset();
    listarMinhas.mockResolvedValue([]);
    minhaProximaTeleconsulta.mockReset();
    mockUser = { id: "u-1", name: "Ana" };
    mockDesbloqueados = [];
  });

  it("sem nenhuma marcada, mostra 'Em breve' em vez de um valor fabricado", async () => {
    minhaProximaTeleconsulta.mockResolvedValue(null);
    render(
      <MemoryRouter>
        <DashboardUser />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Em breve")).toBeInTheDocument();
  });

  it("uma falha ao carregar não rebenta o ecrã -- cai no mesmo 'Em breve'", async () => {
    minhaProximaTeleconsulta.mockRejectedValue(new Error("falha de rede"));
    render(
      <MemoryRouter>
        <DashboardUser />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Em breve")).toBeInTheDocument();
  });

  it("com uma teleconsulta confirmada, mostra a data e um atalho para a sala", async () => {
    minhaProximaTeleconsulta.mockResolvedValue({
      agendamento_id: "ag-1",
      clinica_nome: "Óptica Optioptika",
      horario_inicio: "2027-01-04T09:00:00+00:00",
      sala_video: "janelas-para-alma-abc123",
    });
    render(
      <MemoryRouter>
        <DashboardUser />
      </MemoryRouter>,
    );

    await screen.findByText("Óptica Optioptika");
    const link = screen.getByRole("link", { name: /Entrar na sala/i });
    expect(link).toHaveAttribute("href", "https://meet.jit.si/janelas-para-alma-abc123");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
