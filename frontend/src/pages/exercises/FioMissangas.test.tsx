import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FioMissangas from "./FioMissangas";
import { AcessoExerciciosProvider } from "@/contexts/AcessoExerciciosContext";
import ptAO from "@/i18n/locales/pt-AO.json";

const V = ptAO.Visao;

vi.mock("@/contexts/ConsentimentoSaudeContext", () => ({
  useConsentimentoSaude: () => ({ consentido: true, carregando: false, garantir: () => Promise.resolve(true), retirar: () => Promise.resolve() }),
}));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isLoggedIn: true, loading: false }) }));
vi.mock("@/contexts/ProfileContext", () => ({ useProfile: () => ({ profile: null, loading: false, setProfile: () => undefined }) }));

const registar = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  sessoesExercicioApi: { registar: (...a: unknown[]) => registar(...a), minhas: () => Promise.resolve([]) },
  exerciciosApi: {
    acesso: () =>
      Promise.resolve({
        estado: "premium",
        exercicios_desbloqueados: ["cerebro"],
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
});

describe("Fio de Missangas", () => {
  it("três missangas, duas medições na régua: grava o ponto mais próximo em cm e a supressão", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    registar.mockReset().mockResolvedValue({});
    window.localStorage.setItem("jpa.visao.calibracao", JSON.stringify({ pxPorMm: 6, calibrado: true }));
    render(
      <MemoryRouter>
        <AcessoExerciciosProvider>
          <FioMissangas />
        </AcessoExerciciosProvider>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Continuar" })); // montar o fio (já calibrado: salta o cartão)

    for (const r of ["x", "um", "depois"] as const) {
      fireEvent.click(await screen.findByRole("button", { name: new RegExp(V[`fioResposta_${r}`]) }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(11_000);
      });
    }

    const regua = await screen.findByRole("img", { name: V.fioRotuloRegua });
    const tocar = (cm: number) => regua.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 100, clientY: 28 + cm * 10 * 6 }));
    for (const cm of [8, 9]) {
      act(() => tocar(cm));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }

    expect(await screen.findByText(V.fioResultadoTitulo)).toBeInTheDocument();
    expect(screen.getByText(V.fioSinalSupressao)).toBeInTheDocument();
    await waitFor(() => expect(registar).toHaveBeenCalledTimes(1));
    const s = registar.mock.calls[0][0];
    expect(s).toMatchObject({ exercicio_id: "cerebro", olho: "ambos", limiar: 8.5, unidade: "cm", calibrado: true });
    expect(s.sinais).toMatchObject({
      modo: "fio_missangas",
      respostas: { vermelha: "x", amarela: "um", verde: "depois" },
      supressao: true,
      x_no_sitio: 1,
      ppc_medicoes_cm: [8, 9],
    });
    window.localStorage.clear();
  });
});
