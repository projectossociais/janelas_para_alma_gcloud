import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const obterEstatisticas = vi.fn();
const obterPendencias = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  adminApi: {
    obterEstatisticas: (...a: unknown[]) => obterEstatisticas(...a),
    obterPendencias: (...a: unknown[]) => obterPendencias(...a),
  },
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// recharts não corre bem em jsdom sem medidas de layout reais -- não é o que
// este teste quer verificar (isso fica ao critério da própria recharts).
vi.mock("recharts", () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import AdminOverview from "./AdminOverview";

const ESTATISTICAS = {
  total_utilizadores: 120,
  novos_utilizadores: 8,
  utilizadores_ativos_periodo: 34,
  sessoes_exercicio: 210,
  analises_scanner: 15,
  pedidos_premium: 6,
  mensagens_contacto: 9,
  serie: [],
};

const PENDENCIAS = {
  pedidos_premium_pendentes: 2,
  mensagens_por_ler: 3,
  candidaturas_voluntariado_pendentes: 1,
};

describe("AdminOverview", () => {
  beforeEach(() => {
    obterEstatisticas.mockReset().mockResolvedValue(ESTATISTICAS);
    obterPendencias.mockReset().mockResolvedValue(PENDENCIAS);
  });

  it("mostra os KPIs reais vindos da API própria", async () => {
    render(<AdminOverview />, { wrapper: MemoryRouter });

    await waitFor(() => expect(screen.getByText("120")).toBeInTheDocument());
    expect(screen.getByText("34")).toBeInTheDocument();
    // Período por omissão é "month" -- o rótulo acompanha o filtro
    // seleccionado (ver AdminOverview.tsx, periodLabel).
    expect(screen.getByText("Activos este mês")).toBeInTheDocument();
  });

  it("o título da página é o h1 (não o nome do painel)", async () => {
    render(<AdminOverview />, { wrapper: MemoryRouter });
    expect(screen.getByRole("heading", { level: 1, name: "Visão geral" })).toBeInTheDocument();
  });

  // Caso real (2026-10-09): sem resposta da API, os cartões mostravam 0 em
  // todas as métricas -- números inventados num painel de decisão.
  it("se as estatísticas falharem: diz porquê, deixa tentar de novo e nunca mostra 0", async () => {
    obterEstatisticas.mockReset().mockRejectedValueOnce(Object.assign(new Error("Sem permissões"), { status: 403 }));
    render(<AdminOverview />, { wrapper: MemoryRouter });

    expect(await screen.findByRole("alert")).toHaveTextContent("Sem permissões");
    expect(screen.queryByText("Utilizadores (total)")).not.toBeInTheDocument();

    obterEstatisticas.mockResolvedValue(ESTATISTICAS);
    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("120")).toBeInTheDocument();
  });

  it("mostra a Central de Pendências com os totais certos e liga aos sítios certos", async () => {
    render(<AdminOverview />, { wrapper: MemoryRouter });

    const linkPremium = await screen.findByRole("link", { name: /Pedidos Premium por decidir/i });
    expect(linkPremium).toHaveAttribute("href", "/admin/mensagens?tab=premium");

    const linkVoluntariado = screen.getByRole("link", { name: /Candidaturas de voluntariado por decidir/i });
    expect(linkVoluntariado).toHaveAttribute("href", "/admin/voluntariado");

    // 2 + 3 + 1 = 6, em destaque no título da secção.
    const titulo = screen.getByRole("heading", { name: /Por decidir/ });
    expect(within(titulo).getByText("6")).toBeInTheDocument();
  });

  it("pede as estatísticas outra vez quando o período muda", async () => {
    render(<AdminOverview />, { wrapper: MemoryRouter });
    await waitFor(() => expect(obterEstatisticas).toHaveBeenCalledWith(30));

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "Semanal" }));

    await waitFor(() => expect(obterEstatisticas).toHaveBeenCalledWith(7));
  });
});
