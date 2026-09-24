import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import Exercicios from "./Exercicios";
import { AcessoExerciciosProvider } from "@/contexts/AcessoExerciciosContext";

// Os 8 exercícios são pagos e o acesso decide-se na API (GET /exercicios/acesso).
// A página tem de mostrar cada estado de forma consistente e nunca
// desbloquear nada por conta própria (CLAUDE.md secção 8 — decidir acesso
// exige teste).

vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/FeedbackWidget", () => ({ default: () => null }));

let mockLoggedIn = true;
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoggedIn: mockLoggedIn, loading: false }),
}));
vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: null }),
}));

const acesso = vi.fn();
const iniciarTrial = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  exerciciosApi: {
    acesso: (...a: unknown[]) => acesso(...a),
    iniciarTrial: (...a: unknown[]) => iniciarTrial(...a),
  },
  mensagemDeErroApi: (_e: unknown, fallback: string) => fallback,
}));

const TRIAL = ["figure8", "convergence", "cerebro", "relax"];
const PREMIUM = ["ambliopia", "sacadas-convergencia", "flexibilidade-acomodativa", "estereopsia"];

const estado = (over: Record<string, unknown>) => ({
  estado: "trial_disponivel",
  exercicios_desbloqueados: [],
  exercicios_trial: TRIAL,
  exercicios_premium: PREMIUM,
  trial_iniciado_em: null,
  trial_termina_em: null,
  trial_dias_restantes: null,
  ...over,
});

const renderPagina = () =>
  render(
    <MemoryRouter>
      <AcessoExerciciosProvider>
        <Exercicios />
      </AcessoExerciciosProvider>
    </MemoryRouter>,
  );

const grupo = (titulo: string) =>
  screen.getByRole("heading", { level: 2, name: titulo }).closest("section") as HTMLElement;
const contarDisponiveis = (el: HTMLElement) => within(el).queryAllByText("Disponível").length;
const contarBloqueados = (el: HTMLElement) =>
  within(el).queryAllByText("Bloqueado", { selector: "span" }).length;

describe("Exercicios — 8 exercícios em dois grupos", () => {
  beforeEach(() => {
    mockLoggedIn = true;
    acesso.mockReset();
    iniciarTrial.mockReset();
  });

  it("mostra exactamente 4 no grupo do teste e 4 no Premium, sem os exercícios eliminados", async () => {
    acesso.mockResolvedValue(estado({}));
    renderPagina();

    await screen.findByText("Trial disponível");
    expect(contarBloqueados(grupo("Incluídos no teste de 7 dias"))).toBe(4);
    expect(contarBloqueados(grupo("Premium"))).toBe(4);
    for (const eliminado of [
      /Sacadas com Distratores/i,
      /Facilidade de Vergência/i,
      /Consciência Periférica/i,
      /Programa Adaptativo/i,
    ]) {
      expect(screen.queryByText(eliminado)).not.toBeInTheDocument();
    }
  });

  it("visitante: sem botões nos cartões, e o CTA do banner abre o registo em /login (não 404)", async () => {
    mockLoggedIn = false;
    const OndeEstou = () => {
      const l = useLocation();
      return <p data-testid="onde">{l.pathname + l.search}</p>;
    };
    render(
      <MemoryRouter initialEntries={["/exercicios"]}>
        <AcessoExerciciosProvider>
          <Routes>
            <Route path="/exercicios" element={<Exercicios />} />
            <Route path="*" element={<OndeEstou />} />
          </Routes>
        </AcessoExerciciosProvider>
      </MemoryRouter>,
    );

    const cta = await screen.findByRole("button", { name: /Criar conta e começar teste de 7 dias/i });
    expect(within(grupo("Incluídos no teste de 7 dias")).queryAllByRole("button")).toHaveLength(0);
    expect(within(grupo("Premium")).queryAllByRole("button", { name: /Criar conta/i })).toHaveLength(0);

    fireEvent.click(cta);
    expect(await screen.findByTestId("onde")).toHaveTextContent(
      "/login?modo=registo&next=%2Fexercicios",
    );
  });

  it("visitante sem sessão: tudo bloqueado e CTA para criar conta, sem chamar a API", async () => {
    mockLoggedIn = false;
    renderPagina();

    expect(
      await screen.findByRole("button", { name: /Criar conta e começar teste de 7 dias/i }),
    ).toBeInTheDocument();
    expect(contarBloqueados(grupo("Incluídos no teste de 7 dias"))).toBe(4);
    expect(contarBloqueados(grupo("Premium"))).toBe(4);
    expect(acesso).not.toHaveBeenCalled();
  });

  it("trial disponível: 8 bloqueados e botão para começar o teste", async () => {
    acesso.mockResolvedValue(estado({ estado: "trial_disponivel" }));
    renderPagina();

    expect(
      await screen.findByRole("button", { name: /Começar teste gratuito de 7 dias/i }),
    ).toBeInTheDocument();
    expect(contarDisponiveis(grupo("Incluídos no teste de 7 dias"))).toBe(0);
    expect(contarDisponiveis(grupo("Premium"))).toBe(0);
  });

  it("trial activo: só os 4 do teste desbloqueados, com os dias que faltam", async () => {
    acesso.mockResolvedValue(
      estado({ estado: "trial_ativo", exercicios_desbloqueados: TRIAL, trial_dias_restantes: 5 }),
    );
    renderPagina();

    expect(await screen.findByText(/Faltam 5 dias do seu teste gratuito/)).toBeInTheDocument();
    expect(contarDisponiveis(grupo("Incluídos no teste de 7 dias"))).toBe(4);
    expect(contarBloqueados(grupo("Premium"))).toBe(4);
  });

  it("trial terminado: o grupo do teste continua visível mas bloqueado, CTA para Premium", async () => {
    acesso.mockResolvedValue(estado({ estado: "trial_terminado" }));
    renderPagina();

    expect(await screen.findByText("Trial terminado")).toBeInTheDocument();
    expect(contarBloqueados(grupo("Incluídos no teste de 7 dias"))).toBe(4);
    expect(contarBloqueados(grupo("Premium"))).toBe(4);
    expect(screen.queryByRole("button", { name: /Começar teste/i })).not.toBeInTheDocument();
  });

  it("Premium: os 8 desbloqueados, sem CTA de compra", async () => {
    acesso.mockResolvedValue(estado({ estado: "premium", exercicios_desbloqueados: [...TRIAL, ...PREMIUM] }));
    renderPagina();

    await screen.findByText(/Tem acesso aos 8 exercícios/);
    expect(contarDisponiveis(grupo("Incluídos no teste de 7 dias"))).toBe(4);
    expect(contarDisponiveis(grupo("Premium"))).toBe(4);
    expect(screen.queryByRole("button", { name: /Ver planos Premium/i })).not.toBeInTheDocument();
  });

  it("uma falha da API deixa tudo bloqueado -- nunca desbloqueia por omissão", async () => {
    acesso.mockRejectedValue(new Error("falha de rede"));
    renderPagina();

    await waitFor(() => expect(contarBloqueados(grupo("Premium"))).toBe(4));
    expect(contarDisponiveis(grupo("Incluídos no teste de 7 dias"))).toBe(0);
  });

  it("começar o teste com sucesso desbloqueia os 4 do teste", async () => {
    acesso.mockResolvedValue(estado({ estado: "trial_disponivel" }));
    iniciarTrial.mockResolvedValue(
      estado({ estado: "trial_ativo", exercicios_desbloqueados: TRIAL, trial_dias_restantes: 7 }),
    );
    renderPagina();

    fireEvent.click(await screen.findByRole("button", { name: /Começar teste gratuito de 7 dias/i }));

    expect(await screen.findByText(/Faltam 7 dias/)).toBeInTheDocument();
    expect(iniciarTrial).toHaveBeenCalledTimes(1);
    expect(contarDisponiveis(grupo("Incluídos no teste de 7 dias"))).toBe(4);
  });

  it("se a API recusar o início do teste (ex.: 409), nada fica desbloqueado", async () => {
    acesso.mockResolvedValue(estado({ estado: "trial_disponivel" }));
    iniciarTrial.mockRejectedValue(Object.assign(new Error("já utilizado"), { status: 409 }));
    renderPagina();

    fireEvent.click(await screen.findByRole("button", { name: /Começar teste gratuito de 7 dias/i }));

    await waitFor(() => expect(iniciarTrial).toHaveBeenCalled());
    expect(contarDisponiveis(grupo("Incluídos no teste de 7 dias"))).toBe(0);
  });
});
