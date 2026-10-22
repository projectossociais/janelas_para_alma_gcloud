import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ptAO from "@/i18n/locales/pt-AO.json";
import Kianda from "@/pages/exercises/Kianda";
import { AcessoExerciciosProvider } from "@/contexts/AcessoExerciciosContext";

const V = ptAO.Visao;

// Caso real (2026-10-08): um treino parado logo no início mostrava no resumo
// um "Limiar desta sessão" que a sessão nunca mediu (o nível de partida). O
// resumo tem de dizer que não houve medição, sem número nenhum.

vi.mock("@/contexts/ConsentimentoSaudeContext", () => ({
  useConsentimentoSaude: () => ({
    consentido: true,
    carregando: false,
    garantir: () => Promise.resolve(true),
    retirar: () => Promise.resolve(),
  }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoggedIn: true, loading: false }),
}));
vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: { olho_mais_fraco: "esquerdo" }, loading: false, setProfile: () => undefined }),
}));

const registar = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  sessoesExercicioApi: {
    registar: (...a: unknown[]) => registar(...a),
    minhas: () =>
      Promise.resolve([
        {
          exercicio_id: "figure8",
          olho: "esquerdo",
          limiar: 0.3,
          unidade: "logmar",
          created_at: new Date().toISOString(),
          segundos_activos: 60,
          sinais: null,
        },
      ]),
  },
  exerciciosApi: {
    acesso: () =>
      Promise.resolve({
        estado: "premium",
        exercicios_desbloqueados: ["ambliopia"],
        exercicios_trial: [],
        exercicios_premium: [],
        trial_iniciado_em: null,
        trial_termina_em: null,
        trial_dias_restantes: null,
      }),
    iniciarTrial: () => Promise.resolve(),
  },
  perfilApi: { atualizar: () => Promise.resolve({}) },
  mensagemDeErroApi: (_e: unknown, fallback: string) => fallback,
}));

describe("Resumo de um treino sem medição", () => {
  beforeEach(() => {
    window.localStorage.clear();
    registar.mockReset().mockResolvedValue({ bonus: null });
    window.localStorage.setItem("jpa.visao.calibracao", JSON.stringify({ pxPorMm: 4.2, calibrado: true }));
    window.localStorage.setItem(
      "jpa.visao.escolhas.ambliopia",
      JSON.stringify({ distanciaMm: 600, usaCorreccao: false, olho: "esquerdo" }),
    );
  });

  it("Kianda com tapa-olho parado sem apanhar nenhum peixe: diz que não mediu, sem inventar um limiar", async () => {
    window.localStorage.setItem("jpa.visao.kianda.modo", "tapaOlho");
    render(
      <MemoryRouter>
        <AcessoExerciciosProvider>
          <Kianda />
        </AcessoExerciciosProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Continuar" })); // sem óculos
    fireEvent.click(await screen.findByRole("button", { name: /Começar treino/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Terminar agora/ }));

    expect(await screen.findByText(V.pescaSemLimiar)).toBeInTheDocument();
    expect(screen.queryByText(/°/)).not.toBeInTheDocument();
  });
});
