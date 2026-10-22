import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DesafioAgulha from "./DesafioAgulha";
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
        exercicios_desbloqueados: ["estereopsia"],
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

/** Avança o relógio aos bocados até aparecer o botão (as transições do jogo vivem em efeitos). */
async function ateAparecer(nome: string | RegExp) {
  for (let k = 0; k < 40; k++) {
    const b = screen.queryByRole("button", { name: nome });
    if (b) return b;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
  }
  throw new Error(`não apareceu: ${nome}`);
}

describe("Desafio da Agulha (sem óculos)", () => {
  it("12 rondas com o árbitro: grava os acertos com os dois olhos e com um, e a vantagem", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    registar.mockReset().mockResolvedValue({});
    render(
      <MemoryRouter>
        <AcessoExerciciosProvider>
          <DesafioAgulha />
        </AcessoExerciciosProvider>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Continuar" })); // sem óculos, por omissão
    fireEvent.click(await screen.findByRole("button", { name: V.agulhaComecar }));

    for (let i = 0; i < 12; i++) {
      const vez = screen.getByText(/^Vez de:/).textContent ?? "";
      const comDois = screen.queryByText(V.agulhaDoisOlhos) !== null;
      fireEvent.click(await ateAparecer(V.agulhaPronto));
      const acerta = vez.includes(V.agulhaJogador2Omissao) || comDois;
      fireEvent.click(await ateAparecer(acerta ? V.agulhaAcertou : V.agulhaFalhou));
      if (i < 11) await ateAparecer(V.agulhaPronto);
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(await screen.findByText("Ganhou: Adulto!")).toBeInTheDocument();
    await waitFor(() => expect(registar).toHaveBeenCalledTimes(1));
    const s = registar.mock.calls[0][0];
    expect(s).toMatchObject({ exercicio_id: "estereopsia", olho: "ambos", limiar: null });
    expect(s.sinais).toMatchObject({
      modo: "agulha",
      material: "lapis",
      jogador: { acertos_dois: 3, acertos_um: 0, vantagem: "grande" },
      outro_jogador: { acertos_dois: 3, acertos_um: 3 },
    });
  }, 30000);
});
