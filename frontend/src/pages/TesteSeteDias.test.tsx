import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import ptAO from "@/i18n/locales/pt-AO.json";
import { violacoesAcessibilidade } from "@/design/testes/acessibilidade";

const T = ptAO.TesteSeteDias;

// O estado do acesso vem da API; aqui controla-se. `iniciarTrial` troca o estado
// (como o contexto verdadeiro faz) e a página volta a desenhar-se com ele.
const TRIAL = ["figure8", "ambliopia", "cerebro", "relax"];
const base = {
  estado: "trial_disponivel",
  exercicios_desbloqueados: [] as string[],
  exercicios_trial: TRIAL,
  exercicios_premium: [],
  trial_iniciado_em: null as string | null,
  trial_termina_em: null as string | null,
  trial_dias_restantes: null as number | null,
};
let acesso = { ...base };
let aCarregar = false;
const iniciarTrial = vi.fn();
vi.mock("@/contexts/AcessoExerciciosContext", () => ({
  useAcessoExercicios: () => ({ acesso, loading: aCarregar, iniciarTrial: () => iniciarTrial() }),
}));

let mensagemDeErro = "";
vi.mock("@/lib/apiClient", () => ({
  mensagemDeErroApi: (_e: unknown, fallback: string) => mensagemDeErro || fallback,
}));

import TesteSeteDias from "./TesteSeteDias";

const Onde = () => <p data-testid="onde">{useLocation().pathname}</p>;

const montar = () =>
  render(
    <MemoryRouter initialEntries={["/teste-de-7-dias"]}>
      <Routes>
        <Route path="/teste-de-7-dias" element={<TesteSeteDias />} />
        <Route path="*" element={<Onde />} />
      </Routes>
    </MemoryRouter>,
  );

/** A acção principal existe duas vezes no DOM (telemóvel e computador): usa-se a primeira. */
const accao = (nome: string | RegExp, papel: "button" | "link" = "button") =>
  screen.getAllByRole(papel, { name: nome })[0]!;

beforeEach(() => {
  acesso = { ...base };
  aCarregar = false;
  mensagemDeErro = "";
  iniciarTrial.mockReset();
});

describe("TesteSeteDias — antes de começar", () => {
  it("explica o que inclui, como funciona e o que custa continuar, antes de iniciar nada", () => {
    montar();
    expect(screen.getByRole("heading", { level: 1, name: T.titulo })).toBeInTheDocument();
    for (const nome of ["Teste de Acuidade", "Treino de Anéis com tapa-olho", "Teste de Contraste", "Teste de Astigmatismo"]) {
      expect(screen.getByText(nome)).toBeInTheDocument();
    }
    expect(screen.getByText(T.comoFuncionaUmaVez)).toBeInTheDocument();
    // O preço vem do plano do Premium, nunca escrito aqui.
    expect(screen.getByText(/15\.000 Kz por mês/)).toBeInTheDocument();
    expect(screen.getByText(T.comoFuncionaTriagem)).toBeInTheDocument();
    expect(iniciarTrial).not.toHaveBeenCalled();
  });

  it("só começa quando se carrega em 'Começar', e mostra o teste activo depois da resposta", async () => {
    iniciarTrial.mockImplementation(async () => {
      acesso = {
        ...base,
        estado: "trial_ativo",
        exercicios_desbloqueados: TRIAL,
        trial_iniciado_em: "2026-10-07T10:00:00Z",
        trial_termina_em: "2026-10-14T10:00:00Z",
        trial_dias_restantes: 7,
      };
    });
    const u = userEvent.setup();
    montar();
    await u.click(accao(T.comecar));

    expect(await screen.findByRole("heading", { level: 1, name: T.activoTitulo })).toBeInTheDocument();
    expect(iniciarTrial).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/faltam 7 dias/)).toBeInTheDocument();
    // Cada exercício do teste é uma ligação para começar.
    expect(screen.getByRole("link", { name: "Teste de Acuidade" })).toHaveAttribute("href", "/exercicios/acuidade");
  });

  it("se a API recusar (ex.: já foi usado), diz porquê e nunca mostra o teste como activo", async () => {
    iniciarTrial.mockRejectedValue(Object.assign(new Error("o teste já foi utilizado"), { status: 409 }));
    mensagemDeErro = "o teste já foi utilizado";
    const u = userEvent.setup();
    montar();
    await u.click(accao(T.comecar));

    expect(await screen.findByText(T.erroTitulo)).toBeInTheDocument();
    expect(screen.getByText("o teste já foi utilizado")).toBeInTheDocument();
    expect(screen.queryByText(T.activoTitulo)).not.toBeInTheDocument();
    // Fica o botão para tentar de novo.
    expect(accao(T.comecar)).toBeEnabled();
  });

  it("sem violações de acessibilidade", async () => {
    const { container } = montar();
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});

describe("TesteSeteDias — os outros estados", () => {
  it("enquanto o estado se confirma, não mostra nada que se possa clicar por engano", () => {
    aCarregar = true;
    montar();
    expect(screen.getByRole("status")).toHaveTextContent(T.aPreparar);
    expect(screen.queryByRole("button", { name: T.comecar })).not.toBeInTheDocument();
  });

  it("sem sessão: leva a criar conta ou entrar e volta à página do teste", () => {
    acesso = { ...base, estado: "sem_sessao" };
    montar();
    expect(screen.getByRole("heading", { level: 1, name: T.semContaTitulo })).toBeInTheDocument();
    expect(accao(T.criarConta, "link").getAttribute("href")).toContain("modo=registo");
    expect(accao(T.criarConta, "link").getAttribute("href")).toContain("next=%2Fteste-de-7-dias");
    expect(accao(T.entrar, "link").getAttribute("href")).toContain("/login?next=%2Fteste-de-7-dias");
    expect(screen.queryByRole("button", { name: T.comecar })).not.toBeInTheDocument();
  });

  it("teste a decorrer ao voltar à página: mostra até quando e não deixa começar outro", () => {
    acesso = {
      ...base,
      estado: "trial_ativo",
      exercicios_desbloqueados: TRIAL,
      trial_termina_em: "2026-10-14T10:00:00Z",
      trial_dias_restantes: 1,
    };
    montar();
    expect(screen.getByRole("heading", { level: 1, name: T.activoTitulo })).toBeInTheDocument();
    expect(screen.getByText(/falta 1 dia/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: T.comecar })).not.toBeInTheDocument();
  });

  it("teste terminado: já não se pode repetir, só o Premium", () => {
    acesso = { ...base, estado: "trial_terminado" };
    montar();
    expect(screen.getByRole("heading", { level: 1, name: T.terminouTitulo })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: T.comecar })).not.toBeInTheDocument();
    expect(accao(T.verPremium, "link")).toHaveAttribute("href", "/registo-premium");
  });

  it("com Premium, diz que não precisa do teste", () => {
    acesso = { ...base, estado: "premium" };
    montar();
    expect(screen.getByRole("heading", { level: 1, name: T.premiumTitulo })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: T.comecar })).not.toBeInTheDocument();
  });

  it("'Sair' volta aos exercícios", async () => {
    const u = userEvent.setup();
    montar();
    await u.click(screen.getByRole("button", { name: T.sair }));
    await waitFor(() => expect(screen.getByTestId("onde")).toHaveTextContent("/exercicios"));
  });
});
