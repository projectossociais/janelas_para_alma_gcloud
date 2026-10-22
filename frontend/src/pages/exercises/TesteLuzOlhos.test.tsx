import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TesteLuzOlhos from "./TesteLuzOlhos";
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
        exercicios_desbloqueados: ["relax"],
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

afterEach(() => vi.restoreAllMocks());

describe("Luz nos Olhos", () => {
  it("diário, reflexo e teste de tapar: grava o desvio estimado e mostra-o como sinal", async () => {
    registar.mockReset().mockResolvedValue({});
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(400);
    render(
      <MemoryRouter>
        <AcessoExerciciosProvider>
          <TesteLuzOlhos />
        </AcessoExerciciosProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("radio", { name: V.luzFrequencia_as_vezes }));
    fireEvent.click(screen.getByRole("button", { name: V.luzQuando_cansaco }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(await screen.findByRole("button", { name: V.luzAcender }));
    fireEvent.click(await screen.findByRole("button", { name: V.luzJaVi }));

    // Desenho de 400 x 200: íris com 68 px de raio (6 mm). Direito no centro;
    // esquerdo 1,5 mm para a orelha dela (para a direita de quem vê).
    const desenho = await screen.findByRole("img", { name: V.luzRotuloDesenho });
    const tocar = (x: number, y: number) => desenho.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: x, clientY: y }));
    tocar(400 * 0.27, 200 * 0.55);
    tocar(400 * 0.73 + (1.5 / 6) * 68, 200 * 0.55);
    expect(await screen.findByText(V.luzMarcados)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    // Tapa-se o direito e olha-se para o esquerdo: foi para a orelha (estava virado para dentro).
    fireEvent.click(await screen.findByRole("button", { name: V.luzMovimento_fora }));
    fireEvent.click(await screen.findByRole("button", { name: V.luzMovimento_nao }));

    expect(await screen.findByText(V.luzResultadoTitulo)).toBeInTheDocument();
    expect(screen.getByText("Pelo reflexo, o olho esquerdo desvia para dentro: cerca de 25 Δ.")).toBeInTheDocument();
    expect(screen.getByText("Ao tapar o outro olho, o olho esquerdo mexeu-se: estava desviado para dentro.")).toBeInTheDocument();
    await waitFor(() => expect(registar).toHaveBeenCalledTimes(1));
    const s = registar.mock.calls[0][0];
    expect(s).toMatchObject({ exercicio_id: "relax", olho: "ambos", limiar: 25, unidade: "dioptrias_prismaticas" });
    expect(s.sinais).toMatchObject({
      modo: "luz_olhos",
      tapar: { esquerdo: "fora", direito: "nao" },
      desvio_tapar: [{ olho: "esquerdo", sentido: "dentro" }],
      diario: { frequencia: "as_vezes", quando: ["cansaco"] },
    });
  });
});
