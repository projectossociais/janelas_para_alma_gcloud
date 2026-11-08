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
  it("três rondas a tocar no ecrã: grava o ponto mais próximo, a recuperação e quem chegou ao nariz", async () => {
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
    fireEvent.click(await screen.findByRole("button", { name: V.fioComecar })); // já calibrado: salta o cartão
    const esperar = (ms: number) =>
      act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
      });
    const tocar = async (nome: string) => fireEvent.pointerDown(await screen.findByRole("button", { name: nome }));

    // 768 px de altura a 6 px/mm: a missanga parte dos 12 cm.
    await esperar(1200 + 4000); // 12 -> 8 cm
    await tocar(V.fioToqueDuas);
    await esperar(2000); // 8 -> 10 cm
    await tocar(V.fioToqueUma);

    await esperar(1200 + 3000); // 12 -> 9 cm
    await tocar(V.fioToqueDuas);
    await esperar(1000);
    await tocar(V.fioToqueUma);

    await esperar(1200 + 12_000); // nunca fica a dobrar: chega ao nariz

    expect(await screen.findByText(V.fioResultadoTitulo)).toBeInTheDocument();
    await waitFor(() => expect(registar).toHaveBeenCalledTimes(1));
    const s = registar.mock.calls[0][0];
    expect(s).toMatchObject({ exercicio_id: "cerebro", olho: "ambos", limiar: 5.7, unidade: "cm", calibrado: true });
    expect(s.sinais).toMatchObject({
      modo: "fio_missangas",
      versao: 2,
      rotura_cm: [8, 9, 0],
      recuperacao_cm: [10, 10, 0],
      chegou_ao_nariz: false,
      alem_do_ecra: false,
      cansaco: false,
      inicio_cm: 12,
    });
    window.localStorage.clear();
  });
});
