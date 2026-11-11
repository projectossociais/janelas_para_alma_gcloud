import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import VaivemMissanga from "./VaivemMissanga";
import ptAO from "@/i18n/locales/pt-AO.json";

// O lugar do Olho Mágico (id `convergence`) passou a ser o Vaivém da Missanga
// (2026-11-11). Sem óculos: o treino do fio. Com óculos 3D: as Pontes de Fusão.

const V = ptAO.Visao;

vi.mock("@/components/visao/PaginaExercicio", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/exercises/BaseExercise", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("./PontesFusao", () => ({
  default: ({ aoTrocarModo }: { aoTrocarModo: () => void }) => <button onClick={aoTrocarModo}>PONTES 3D</button>,
}));
vi.mock("@/contexts/ProfileContext", () => ({ useProfile: () => ({ profile: { usa_oculos: false }, loading: false, setProfile: () => undefined }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isLoggedIn: true }) }));
vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/apiClient")>()),
  perfilApi: { atualizar: () => Promise.resolve({}) },
  sessoesExercicioApi: { minhas: () => Promise.resolve([]), registar: () => Promise.resolve({}) },
}));

const CHAVE = "jpa.visao.convergencia.oculos";
const comRato = (sim: boolean) =>
  vi.spyOn(window, "matchMedia").mockImplementation((q) => ({ matches: sim && q.includes("pointer: fine"), media: q }) as MediaQueryList);

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("Vaivém da Missanga", () => {
  it("na primeira vez pergunta com ou sem óculos 3D, com o treino da missanga por omissão", () => {
    render(<VaivemMissanga />);
    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toHaveAccessibleName(new RegExp("Vaivém da Missanga"));
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
  });

  it("quem tinha escolhido 'sem óculos' no Olho Mágico entra directo no treino, com a explicação e os avisos", async () => {
    window.localStorage.setItem(CHAVE, "sem");
    window.localStorage.setItem("jpa.visao.calibracao", JSON.stringify({ pxPorMm: 6, calibrado: true }));
    comRato(false);
    render(<VaivemMissanga />);
    expect(await screen.findByText(V.fioTreinoParaQueServe)).toBeInTheDocument();
    expect(screen.getByText(/nunca no olho/)).toBeInTheDocument();
    // Convergência: quem desvia para dentro não deve treinar.
    expect(screen.getByText(V.fioTreinoAvisoEstrabismo)).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("num computador não deixa começar e oferece as Pontes de Fusão", async () => {
    window.localStorage.setItem(CHAVE, "sem");
    comRato(true);
    render(<VaivemMissanga />);
    expect(await screen.findByText(V.fioSoTelemovelTitulo)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: V.continuar })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: V.trocarParaOculos3D }));
    expect(screen.getByRole("button", { name: "PONTES 3D" })).toBeInTheDocument();
    expect(window.localStorage.getItem(CHAVE)).toBe("com");
  });
});
