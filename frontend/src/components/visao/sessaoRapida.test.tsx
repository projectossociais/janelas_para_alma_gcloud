import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TreinoConvergencia from "@/pages/exercises/TreinoConvergencia";
import { AcessoExerciciosProvider } from "@/contexts/AcessoExerciciosContext";

// O consentimento para dados de saúde tem testes próprios
// (ConsentimentoSaudeContext.test.tsx); aqui a conta já consentiu.
vi.mock("@/contexts/ConsentimentoSaudeContext", () => ({
  useConsentimentoSaude: () => ({
    consentido: true,
    carregando: false,
    garantir: () => Promise.resolve(true),
    retirar: () => Promise.resolve(),
  }),
}));


// Sessão rápida (Fase A, docs/ANALISE_EXERCICIOS.md): da segunda vez em diante
// um treino abre num só ecrã de confirmação, em vez dos 5-6 passos de preparação.

vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoggedIn: true, loading: false }),
}));
vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: null, loading: false, setProfile: () => undefined }),
}));

const acesso = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  sessoesExercicioApi: {
    registar: () => Promise.resolve({}),
    minhas: () => Promise.resolve([]),
  },
  exerciciosApi: {
    acesso: (...a: unknown[]) => acesso(...a),
    iniciarTrial: () => Promise.resolve(),
  },
  perfilApi: { atualizar: () => Promise.resolve({}) },
  mensagemDeErroApi: (_e: unknown, fallback: string) => fallback,
}));

const abrir = () =>
  render(
    <MemoryRouter>
      <AcessoExerciciosProvider>
        <TreinoConvergencia />
      </AcessoExerciciosProvider>
    </MemoryRouter>,
  );

const comEscolhasGuardadas = () => {
  window.localStorage.setItem("jpa.visao.calibracao", JSON.stringify({ pxPorMm: 4.2, calibrado: true }));
  window.localStorage.setItem(
    "jpa.visao.escolhas.convergence",
    JSON.stringify({ distanciaMm: 600, usaCorreccao: true, olho: null }),
  );
};

describe("Sessão rápida dos treinos", () => {
  beforeEach(() => {
    window.localStorage.clear();
    acesso.mockResolvedValue({
      estado: "premium",
      exercicios_desbloqueados: ["convergence"],
      exercicios_trial: [],
      exercicios_premium: [],
      trial_iniciado_em: null,
      trial_termina_em: null,
      trial_dias_restantes: null,
    });
  });

  it("na primeira vez faz o fluxo completo, a começar pelo brilho", async () => {
    abrir();
    await screen.findByText("Ponha o brilho do ecrã no máximo");
    expect(screen.queryByText("Pronto para treinar?")).not.toBeInTheDocument();
  });

  it("com as escolhas da última vez, abre num só ecrã com o resumo e o aviso de segurança", async () => {
    comEscolhasGuardadas();
    abrir();

    await screen.findByText("Pronto para treinar?");
    expect(screen.getByText("Com os seus óculos ou lentes postos")).toBeInTheDocument();
    expect(screen.getByText(/Pare se sentir dor de cabeça/)).toBeInTheDocument();
    expect(screen.queryByText("Ponha o brilho do ecrã no máximo")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Começar treino/ }));
    await screen.findByRole("button", { name: "Vejo 1" });
  });

  it("'Alterar definições' volta ao fluxo completo", async () => {
    comEscolhasGuardadas();
    abrir();

    fireEvent.click(await screen.findByRole("button", { name: "Alterar definições" }));
    await screen.findByText("Ponha o brilho do ecrã no máximo");
  });

  it("o fluxo completo guarda as escolhas quando o treino arranca, para a próxima vez", async () => {
    abrir();
    fireEvent.click(await screen.findByRole("button", { name: "Continuar" })); // brilho
    fireEvent.click(await screen.findByRole("button", { name: "Continuar" })); // aviso da convergência
    fireEvent.click(await screen.findByRole("button", { name: "Não tenho cartão" }));
    fireEvent.click(await screen.findByRole("button", { name: /Não uso óculos nem lentes/ }));

    await screen.findByRole("button", { name: "Vejo 1" });
    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem("jpa.visao.escolhas.convergence") ?? "null")).toEqual({
        distanciaMm: 600,
        usaCorreccao: false,
        olho: null,
      }),
    );
  });
});
