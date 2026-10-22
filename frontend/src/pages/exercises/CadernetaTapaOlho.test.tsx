import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CadernetaTapaOlho from "./CadernetaTapaOlho";
import { AcessoExerciciosProvider } from "@/contexts/AcessoExerciciosContext";
import ptAO from "@/i18n/locales/pt-AO.json";

const V = ptAO.Visao;

vi.mock("@/contexts/ConsentimentoSaudeContext", () => ({
  useConsentimentoSaude: () => ({ consentido: true, carregando: false, garantir: () => Promise.resolve(true), retirar: () => Promise.resolve() }),
}));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isLoggedIn: true, loading: false }) }));
vi.mock("@/contexts/ProfileContext", () => ({ useProfile: () => ({ profile: { olho_mais_fraco: "esquerdo" }, loading: false, setProfile: () => undefined }) }));

const registar = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  sessoesExercicioApi: { registar: (...a: unknown[]) => registar(...a), minhas: () => Promise.resolve([]) },
  exerciciosApi: {
    acesso: () =>
      Promise.resolve({
        estado: "premium",
        exercicios_desbloqueados: ["flexibilidade-acomodativa"],
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

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("Caderneta do Tapa-olho", () => {
  it("uma hora com as perguntas de 15 em 15 minutos: dá o cromo e grava só o tempo confirmado", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const t0 = new Date(2026, 9, 21, 10, 0, 0).getTime();
    vi.setSystemTime(t0);
    window.localStorage.setItem("jpa.visao.caderneta.alvo", "60");
    registar.mockReset().mockResolvedValue({});
    render(
      <MemoryRouter>
        <AcessoExerciciosProvider>
          <CadernetaTapaOlho />
        </AcessoExerciciosProvider>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: V.cadernetaComecar }));
    const aos = async (min: number) => {
      await act(async () => {
        vi.setSystemTime(t0 + min * 60_000);
        await vi.advanceTimersByTimeAsync(1000);
      });
    };

    await aos(14);
    expect(screen.getByText("14 min")).toBeInTheDocument();
    for (const m of [15, 31, 47]) {
      await aos(m);
      fireEvent.click(await screen.findByRole("button", { name: V.cadernetaSim }));
    }
    await aos(60);
    expect(await screen.findByText(V.cadernetaCromoNovo)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: V.cadernetaColar }));
    fireEvent.click(await screen.findByRole("button", { name: V.cadernetaTirei }));

    await waitFor(() => expect(registar).toHaveBeenCalledTimes(1));
    const s = registar.mock.calls[0][0];
    expect(s).toMatchObject({ exercicio_id: "flexibilidade-acomodativa", olho: "esquerdo", limiar: null });
    expect(s.segundos_activos).toBeGreaterThanOrEqual(3600);
    expect(s.sinais).toMatchObject({ modo: "tapa_olho_horas", alvo_min: 60, verificacoes: 3 });
  }, 30000);

  it("se ninguém confirmar, só conta até à última confirmação", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const t0 = new Date(2026, 9, 21, 10, 0, 0).getTime();
    vi.setSystemTime(t0);
    registar.mockReset().mockResolvedValue({});
    render(
      <MemoryRouter>
        <AcessoExerciciosProvider>
          <CadernetaTapaOlho />
        </AcessoExerciciosProvider>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: V.cadernetaComecar }));
    await act(async () => {
      vi.setSystemTime(t0 + 50 * 60_000); // esqueceram-se: 50 min sem responder
      await vi.advanceTimersByTimeAsync(1000);
    });
    fireEvent.click(await screen.findByRole("button", { name: V.cadernetaTirou }));
    // Nada confirmado: menos de um minuto, não se grava.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(registar).not.toHaveBeenCalled();
  }, 30000);
});
