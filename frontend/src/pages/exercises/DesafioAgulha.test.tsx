import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

// Sem escolha guardada, cada teste começa pela pergunta "com ou sem óculos 3D".
beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("Desafio da Agulha (sem óculos)", () => {
  it("5 tentativas com os dois olhos e 5 com um tapado: grava os acertos e a vantagem", async () => {
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
    fireEvent.click(await screen.findByRole("button", { name: V.agulhaVamos }));

    const responder = async (acertos: boolean[]) => {
      for (const a of acertos) fireEvent.click(await screen.findByRole("button", { name: a ? V.agulhaAcertou : V.agulhaFalhou }));
    };
    await responder([true, true, false, true, true]);
    // Com um olho: o ecrã diz qual tapar, a começar pelo esquerdo.
    fireEvent.click(await screen.findByRole("button", { name: V.agulhaVamos }));
    expect(screen.getByText("Tapa o olho esquerdo")).toBeInTheDocument();
    await responder([false, true]);
    // Corrigir a anterior: o "acertou" da 2.ª passa a "falhou".
    fireEvent.click(screen.getByRole("button", { name: V.agulhaCorrigir }));
    expect(screen.getByText("Tapa o olho direito")).toBeInTheDocument();
    await responder([false, false, true, false]);

    expect(await screen.findByText(V.agulhaVeredicto_grande)).toBeInTheDocument();
    await waitFor(() => expect(registar).toHaveBeenCalledTimes(1));
    const s = registar.mock.calls[0][0];
    expect(s).toMatchObject({ exercicio_id: "estereopsia", olho: "ambos", limiar: null });
    expect(s.sinais).toMatchObject({
      modo: "agulha",
      versao: 2,
      jogador: { acertos_dois: 4, acertos_um: 1, tentativas: 5, vantagem: "grande" },
      tentativas: {
        dois: [true, true, false, true, true],
        um: [
          { tapado: "esquerdo", acertou: false },
          { tapado: "direito", acertou: false },
          { tapado: "esquerdo", acertou: false },
          { tapado: "direito", acertou: true },
          { tapado: "esquerdo", acertou: false },
        ],
      },
    });
  });

  it("igual com um olho: sinal para mostrar ao médico", async () => {
    registar.mockReset().mockResolvedValue({});
    render(
      <MemoryRouter>
        <AcessoExerciciosProvider>
          <DesafioAgulha />
        </AcessoExerciciosProvider>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Continuar" }));
    fireEvent.click(await screen.findByRole("button", { name: V.agulhaComecar }));
    for (const _ of [0, 1]) {
      fireEvent.click(await screen.findByRole("button", { name: V.agulhaVamos }));
      for (const a of [true, true, true, false, false])
        fireEvent.click(await screen.findByRole("button", { name: a ? V.agulhaAcertou : V.agulhaFalhou }));
    }
    expect(await screen.findByText(V.agulhaVeredicto_nenhuma)).toBeInTheDocument();
    expect(screen.getByText(V.agulhaVeredictoTexto_nenhuma)).toBeInTheDocument();
  });
});
