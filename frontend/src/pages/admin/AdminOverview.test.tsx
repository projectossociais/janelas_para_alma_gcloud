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
    expect(screen.getByText("Ativos este mês")).toBeInTheDocument();
  });

  it("mostra a Central de Pendências com os totais certos e liga aos sítios certos", async () => {
    render(<AdminOverview />, { wrapper: MemoryRouter });

    const linkPremium = await screen.findByRole("link", { name: /Pedidos Premium por decidir/i });
    expect(linkPremium).toHaveAttribute("href", "/admin/mensagens?tab=premium");

    const linkVoluntariado = screen.getByRole("link", { name: /Candidaturas de voluntariado por decidir/i });
    expect(linkVoluntariado).toHaveAttribute("href", "/admin/voluntariado");

    // 2 + 3 + 1 = 6, mostrado como destaque no cabeçalho da Central. O link
    // acima já aparece no primeiro render (usa "?? 0" antes dos dados
    // chegarem) -- o Badge só depois de obterPendencias() resolver, por
    // isso tem de se esperar por ele em vez de o verificar de imediato
    // (senão o teste fica dependente da velocidade da máquina que o corre).
    await waitFor(() => {
      const titulo = screen.getByText("Central de Pendências").closest("h3") as HTMLElement;
      expect(within(titulo).getByText("6")).toBeInTheDocument();
    });
  });

  it("pede as estatísticas outra vez quando o período muda", async () => {
    render(<AdminOverview />, { wrapper: MemoryRouter });
    await waitFor(() => expect(obterEstatisticas).toHaveBeenCalledWith(30));

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Semanal" }));

    await waitFor(() => expect(obterEstatisticas).toHaveBeenCalledWith(7));
  });
});
