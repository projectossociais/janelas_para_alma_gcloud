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

const abrir = () =>
  render(
    <MemoryRouter>
      <AcessoExerciciosProvider>
        <TesteLuzOlhos />
      </AcessoExerciciosProvider>
    </MemoryRouter>,
  );
const escolher = async (nome: string | RegExp) => fireEvent.click(await screen.findByRole("button", { name: nome }));

describe("Luz nos Olhos", () => {
  it("lanterna, pontinho fora do sítio e teste de tapar: grava o desvio e diz que concordam", async () => {
    registar.mockReset().mockResolvedValue({});
    abrir();

    await escolher(V.luzLanternaAcesa);
    await escolher(new RegExp(V.luzIguais_diferente));
    await escolher(new RegExp(V.luzOlhoEsquerdoDela));
    await escolher(V.luzLado_orelha);
    await escolher(V.luzNivel_pupila);
    await escolher(V.luzDemoPercebi);
    // Tapa-se o esquerdo e olha-se para o direito: não se mexeu.
    await escolher(V.luzMovimento_nao);
    // Tapa-se o direito e olha-se para o esquerdo: foi para a orelha (estava virado para dentro).
    await escolher(V.luzMovimento_fora);
    fireEvent.click(await screen.findByRole("radio", { name: V.luzFrequencia_as_vezes }));
    fireEvent.click(screen.getByRole("button", { name: V.luzQuando_cansaco }));
    await escolher(V.luzVerResultado);

    expect(await screen.findByText(V.luzResultadoTitulo)).toBeInTheDocument();
    expect(screen.getByText("Pelo reflexo, o olho esquerdo desvia para dentro: cerca de 30 Δ.")).toBeInTheDocument();
    expect(screen.getByText("Ao tapar o outro olho, o olho esquerdo mexeu-se: estava desviado para dentro.")).toBeInTheDocument();
    expect(screen.getByText(V.luzConcordam)).toBeInTheDocument();
    await waitFor(() => expect(registar).toHaveBeenCalledTimes(1));
    const s = registar.mock.calls[0][0];
    expect(s).toMatchObject({ exercicio_id: "relax", olho: "ambos", limiar: 30, unidade: "dioptrias_prismaticas" });
    expect(s.sinais).toMatchObject({
      modo: "luz_olhos",
      versao: 2,
      reflexo: { resposta: "diferente", olho: "esquerdo", lado: "orelha", nivel: "pupila" },
      achados: [{ olho: "esquerdo", sentido: "dentro", mm: 2, delta: 30 }],
      tapar: { direito: "nao", esquerdo: "fora" },
      desvio_tapar: [{ olho: "esquerdo", sentido: "dentro" }],
      diario: { frequencia: "as_vezes", quando: ["cansaco"] },
    });
  });

  it("sem lanterna: salta para o tapar e grava sem estimativa pelo reflexo", async () => {
    registar.mockReset().mockResolvedValue({});
    abrir();

    await escolher(V.luzSemLanterna);
    expect(await screen.findByText(V.luzDemoTextoSemLuz)).toBeInTheDocument();
    await escolher(V.luzDemoPercebi);
    await escolher(V.luzMovimento_nao);
    await escolher(V.luzMovimento_nao);
    fireEvent.click(await screen.findByRole("radio", { name: V.luzFrequencia_nunca }));
    await escolher(V.luzVerResultado);

    expect(await screen.findByText(V.luzLuz_sem_lanterna)).toBeInTheDocument();
    expect(screen.getByText(V.luzTaparNada)).toBeInTheDocument();
    await waitFor(() => expect(registar).toHaveBeenCalledTimes(1));
    const s = registar.mock.calls[0][0];
    expect(s.limiar).toBeNull();
    expect(s.sinais).toMatchObject({ reflexo: { resposta: "sem_lanterna" }, achados: [], desvio_tapar: [] });
  });
});
