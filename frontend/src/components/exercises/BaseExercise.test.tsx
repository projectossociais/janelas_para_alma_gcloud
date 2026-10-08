import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import BaseExercise from "./BaseExercise";
import ptAO from "@/i18n/locales/pt-AO.json";
import enUS from "@/i18n/locales/en-US.json";
import { violacoesAcessibilidade } from "@/design/testes/acessibilidade";

const B = ptAO.BaseExercise;

// O consentimento para dados de saúde tem testes próprios
// (BaseExercise.consentimento.test.tsx); aqui a conta já consentiu.
vi.mock("@/contexts/ConsentimentoSaudeContext", () => ({
  useConsentimentoSaude: () => ({
    consentido: true,
    carregando: false,
    garantir: () => Promise.resolve(true),
    retirar: () => Promise.resolve(),
  }),
}));

let temAcesso = true;
let aCarregar = false;
let tipo: "criar_conta" | "iniciar_trial" | "premium" | null = null;
const executar = vi.fn();
vi.mock("@/contexts/AcessoExerciciosContext", () => ({
  useAcessoExercicios: () => ({ temAcesso: () => temAcesso, loading: aCarregar }),
}));
vi.mock("@/components/exercises/useAcaoDesbloqueio", () => ({
  useAcaoDesbloqueio: () => ({ tipoPara: () => tipo, executar: (t: string) => executar(t) }),
}));

const IDS = [
  "figure8",
  "cerebro",
  "relax",
  "estereopsia",
  "ambliopia",
  "sacadas-convergencia",
  "convergence",
  "flexibilidade-acomodativa",
] as const;

const PASSOS = ["Ecrã", "Cartão", "Olho direito"];

const montar = (passoActual = 0, id = "figure8") =>
  render(
    <MemoryRouter initialEntries={["/exercicios/acuidade"]}>
      <Routes>
        <Route
          path="/exercicios/acuidade"
          element={
            <BaseExercise
              title="Teste de Acuidade"
              description="Descrição"
              exercicioId={id}
              grupo="trial"
              tipo="teste"
              passos={PASSOS}
              passoActual={passoActual}
            >
              <p>conteúdo</p>
            </BaseExercise>
          }
        />
        <Route path="/exercicios" element={<p>Lista dos exercícios</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  temAcesso = true;
  aCarregar = false;
  tipo = null;
  executar.mockReset();
});

describe("BaseExercise (casca dos exercícios)", () => {
  // O botão "Ver vídeo explicativo" foi retirado (2026-09-28: não há vídeos). Falha
  // se voltar a aparecer na casca, com o exercício desbloqueado.
  it.each(IDS)("%s desbloqueado: título, aviso, conteúdo e Sair, sem vídeo", (id) => {
    montar(0, id);
    expect(screen.getByRole("heading", { level: 1, name: "Teste de Acuidade" })).toBeInTheDocument();
    expect(screen.getByText("conteúdo")).toBeInTheDocument();
    expect(screen.getByText(ptAO.Visao.avisoTeste)).toBeInTheDocument();
    expect(screen.queryByText(/v[ií]deo/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: B.sair })).toBeInTheDocument();
  });

  it("não há chave de tradução do botão de vídeo nos ficheiros PT e EN", () => {
    for (const locale of [ptAO, enUS] as unknown as Record<string, Record<string, unknown>>[]) {
      expect(locale.ExercicioVideo).toBeUndefined();
      const textos = Object.values(locale.BaseExercise ?? {}).concat(Object.values(locale.Visao ?? {}));
      expect(textos.some((x) => typeof x === "string" && /v[ií]deo/i.test(x) && /explicativo|explainer/i.test(x))).toBe(false);
    }
  });

  it("diz em que passo se está, com o nome do passo", () => {
    montar(1);
    expect(screen.getAllByText(/Passo 2 de 3 · Cartão/).length).toBeGreaterThan(0);
  });

  it("no primeiro passo, Sair volta logo à lista (nada a perder)", async () => {
    const u = userEvent.setup();
    montar(0);
    await u.click(screen.getByRole("button", { name: B.sair }));
    expect(await screen.findByText("Lista dos exercícios")).toBeInTheDocument();
  });

  it("a meio do exercício, Sair pede confirmação e 'Continuar' fica no exercício", async () => {
    const u = userEvent.setup();
    montar(2);
    await u.click(screen.getByRole("button", { name: B.sair }));
    expect(await screen.findByText(B.confirmarSaidaTitulo)).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: B.ficar }));
    expect(screen.getByText("conteúdo")).toBeInTheDocument();
    expect(screen.queryByText("Lista dos exercícios")).not.toBeInTheDocument();
  });

  it("a meio do exercício, confirmar Sair volta à lista", async () => {
    const u = userEvent.setup();
    montar(2);
    await u.click(screen.getByRole("button", { name: B.sair }));
    const dialogo = await screen.findByRole("dialog");
    await u.click(within(dialogo).getByRole("button", { name: B.sair }));
    expect(await screen.findByText("Lista dos exercícios")).toBeInTheDocument();
  });

  it("sem violações de acessibilidade", async () => {
    const { container } = montar(1);
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});

describe("BaseExercise bloqueado (o acesso vem da API)", () => {
  it("enquanto o acesso se confirma, o conteúdo nem é montado", () => {
    aCarregar = true;
    montar();
    expect(screen.queryByText("conteúdo")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(B.aPreparar);
  });

  it.each([
    ["criar_conta", B.tituloCriarConta, B.botaoCriarConta],
    ["iniciar_trial", B.tituloIniciarTrial, B.botaoIniciarTrial],
    ["premium", B.tituloPremium, B.botaoPremium],
  ] as const)("sem acesso (%s): não monta o exercício e oferece o caminho certo", async (t, titulo, botao) => {
    temAcesso = false;
    tipo = t;
    const u = userEvent.setup();
    montar();
    expect(screen.queryByText("conteúdo")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: titulo })).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: botao }));
    expect(executar).toHaveBeenCalledWith(t);
  });
});
