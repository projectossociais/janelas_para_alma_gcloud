import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AssistenteTeste from "./AssistenteTeste";
import AssistenteTreino from "./AssistenteTreino";
import { guardarCalibracao } from "@/lib/visao/calibracao";
import { guardarEscolhas } from "@/lib/visao/preparacao";
import ptAO from "@/i18n/locales/pt-AO.json";

// Passos antes de começar (2026-11-11): só se pergunta o que ainda não se
// sabe. O brilho deixou de ser um ecrã, o cartão salta com o ecrã calibrado,
// os óculos de graduação perguntam-se uma vez e ficam no perfil, e o passo do
// tapa-olho já não contradiz o aviso do exercício ("a mão não basta").

const V = ptAO.Visao;

let perfil: Record<string, unknown> = {};
const setProfile = vi.fn();
vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: perfil, setProfile: (...a: unknown[]) => setProfile(...a), loading: false }),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isLoggedIn: true }) }));
const atualizar = vi.fn();
vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/apiClient")>()),
  perfilApi: { atualizar: (...a: unknown[]) => atualizar(...a) },
  sessoesExercicioApi: { minhas: () => Promise.resolve([]), registar: () => Promise.reject(new Error("não usado")) },
}));
// A casca (acesso, consentimento) tem os seus próprios testes.
vi.mock("@/components/exercises/BaseExercise", () => ({
  default: ({ children, passos }: { children: React.ReactNode; passos?: string[] }) => (
    <div>
      <p data-testid="passos">{(passos ?? []).join(" > ")}</p>
      {children}
    </div>
  ),
}));

const continuar = () => fireEvent.click(screen.getByRole("button", { name: V.continuar }));

beforeEach(() => {
  window.localStorage.clear();
  perfil = { olho_mais_fraco: "esquerdo", usa_oculos: null, px_por_mm: null };
  atualizar.mockReset();
  atualizar.mockResolvedValue({ usa_oculos: true });
  setProfile.mockReset();
});

const abrirTreino = () =>
  render(
    <MemoryRouter>
      <AssistenteTreino
        exercicioId="ambliopia"
        titulo="Treino"
        descricao=""
        monocular
        aviso={<p>Como se joga</p>}
        tarefa={() => <p>A JOGAR</p>}
      />
    </MemoryRouter>,
  );

describe("AssistenteTreino: passos antes de começar", () => {
  it("na primeira vez: aviso, cartão, óculos (fica no perfil) e tapa-olho; o brilho é só uma linha", async () => {
    abrirTreino();
    expect(await screen.findByText("Como se joga")).toBeInTheDocument();
    expect(screen.getByText(V.brilhoLinha)).toBeInTheDocument();
    expect(screen.getByTestId("passos")).toHaveTextContent(
      [V.passoOlhoMaisFraco, V.passoAviso, V.passoCartao, V.passoOculos, V.passoTapaOlho, V.passoTreino, V.passoResumo].join(" > "),
    );

    continuar();
    expect(screen.getByText(V.calibracaoTitulo)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: V.naoTenhoCartao }));

    expect(screen.getByText(V.oculosTitulo)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: V.oculosComCorreccao }));
    expect(atualizar).toHaveBeenCalledWith({ usa_oculos: true });

    // O olho mais fraco é o esquerdo: tapa-se o direito, e a mão serve.
    expect(screen.getByText(V.tapeOlhoDireito)).toBeInTheDocument();
    expect(screen.getByText(V.tapaOlhoTexto)).toBeInTheDocument();
    expect(V.tapaOlhoTexto).toMatch(/mão/);
    expect(screen.queryByText(/não basta/)).not.toBeInTheDocument();

    continuar();
    expect(screen.getByText("A JOGAR")).toBeInTheDocument();
    await waitFor(() => expect(setProfile).toHaveBeenCalled());
  });

  it("com o ecrã calibrado e os óculos no perfil, não volta a perguntar nenhum dos dois", async () => {
    guardarCalibracao({ pxPorMm: 6, calibrado: true });
    perfil = { ...perfil, usa_oculos: false };
    abrirTreino();
    expect(await screen.findByText("Como se joga")).toBeInTheDocument();
    expect(screen.getByTestId("passos")).not.toHaveTextContent(V.passoCartao);
    expect(screen.getByTestId("passos")).not.toHaveTextContent(V.passoOculos);
    continuar();
    expect(screen.getByText(V.tapeOlhoDireito)).toBeInTheDocument();
    continuar();
    expect(screen.getByText("A JOGAR")).toBeInTheDocument();
    expect(atualizar).not.toHaveBeenCalled();
  });

  it("com o ecrã calibrado, 'calibrar de novo' continua à mão e abre logo a moldura", async () => {
    guardarCalibracao({ pxPorMm: 6, calibrado: true });
    perfil = { ...perfil, usa_oculos: false };
    abrirTreino();
    fireEvent.click(await screen.findByRole("button", { name: V.calibrarEcraDeNovo }));
    expect(screen.getByText(V.calibracaoTitulo)).toBeInTheDocument();
  });

  it("sessão rápida: 'Alterar definições' volta a mostrar o cartão e a pergunta dos óculos", async () => {
    guardarCalibracao({ pxPorMm: 6, calibrado: true });
    guardarEscolhas("ambliopia", { distanciaMm: 600, usaCorreccao: true, olho: "esquerdo" });
    perfil = { ...perfil, usa_oculos: true };
    abrirTreino();
    expect(await screen.findByText(V.rapidoTitulo)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: V.rapidoAlterar }));
    expect(screen.getByText(V.antesDeComecar)).toBeInTheDocument();
    continuar();
    expect(screen.getByText(V.calibracaoTitulo)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /O cartão coincide/ }));
    expect(screen.getByText(V.oculosTitulo)).toBeInTheDocument();
  });

  it("se a gravação dos óculos no perfil falhar, o treino segue na mesma", async () => {
    guardarCalibracao({ pxPorMm: 6, calibrado: true });
    atualizar.mockRejectedValue(new Error("500"));
    abrirTreino();
    await screen.findByText("Como se joga");
    continuar();
    fireEvent.click(screen.getByRole("button", { name: V.oculosSemCorreccao }));
    expect(screen.getByText(V.tapeOlhoDireito)).toBeInTheDocument();
    await waitFor(() => expect(atualizar).toHaveBeenCalledWith({ usa_oculos: false }));
    expect(setProfile).not.toHaveBeenCalled();
  });
});

const abrirTeste = (semPassoTapar: boolean) =>
  render(
    <AssistenteTeste<number>
      exercicioId="figure8"
      titulo="Teste"
      descricao=""
      comDistancia={false}
      semPassoTapar={semPassoTapar}
      preparacao={{ nome: "Preparar", render: (aoContinuar) => <button onClick={aoContinuar}>MONTADO</button> }}
      tarefa={(olho, ctx) => (
        <p>
          TAREFA {olho} {ctx.usaCorreccao ? "com" : "sem"} óculos
        </p>
      )}
      resultado={() => <p>FIM</p>}
    />,
  );

describe("AssistenteTeste: passos antes de começar", () => {
  it("com tudo já sabido, começa logo na preparação do teste", async () => {
    guardarCalibracao({ pxPorMm: 6, calibrado: true });
    perfil = { ...perfil, usa_oculos: true };
    abrirTeste(true);
    fireEvent.click(await screen.findByRole("button", { name: "MONTADO" }));
    // Sem o ecrã "tape o olho": a tarefa traz o seu.
    expect(screen.getByText("TAREFA direito com óculos")).toBeInTheDocument();
    expect(atualizar).not.toHaveBeenCalled();
  });

  it("na primeira vez pede o cartão e os óculos, e guarda a resposta no perfil", async () => {
    abrirTeste(false);
    expect(await screen.findByText(V.calibracaoTitulo)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: V.naoTenhoCartao }));
    fireEvent.click(screen.getByRole("button", { name: V.oculosSemCorreccao }));
    expect(atualizar).toHaveBeenCalledWith({ usa_oculos: false });
    fireEvent.click(screen.getByRole("button", { name: "MONTADO" }));
    // Sem `semPassoTapar`, o passo de tapar o outro olho mantém-se.
    expect(screen.getByText(V.tapeOlhoEsquerdo)).toBeInTheDocument();
    continuar();
    expect(screen.getByText("TAREFA direito sem óculos")).toBeInTheDocument();
  });
});
