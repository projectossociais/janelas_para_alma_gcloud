import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ptAO from "@/i18n/locales/pt-AO.json";
import { violacoesAcessibilidade } from "@/design/testes/acessibilidade";

const P = ptAO.ProgressoApp;
const V = ptAO.Visao;

// O ecrã mostra dados de saúde: nada inventado, erro dito como erro, e o
// gráfico nunca é a única forma de ler os números.

vi.mock("@/components/NotificationBell", () => ({ default: () => null }));
let logado = true;
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoggedIn: logado, user: logado ? { id: "u1", name: "Ana Silva" } : null, logout: vi.fn() }),
}));
vi.mock("@/contexts/ProfileContext", () => ({ useProfile: () => ({ profile: null }) }));

let sessoes: unknown[] | null = [];
let erro = false;
const recarregar = vi.fn();
vi.mock("@/components/visao/hooks", () => ({
  useHistoricoVisao: () => ({ sessoes, erro, recarregar }),
}));

// O gráfico (Recharts) precisa de medidas que o jsdom não tem; é só imagem
// (aria-hidden) e os mesmos valores estão na tabela, que se testa.
vi.mock("recharts", async () => {
  const React = await import("react");
  const Nada = ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children);
  return { ResponsiveContainer: Nada, LineChart: Nada, CartesianGrid: Nada, XAxis: Nada, YAxis: Nada, Tooltip: Nada, Line: Nada };
});

import ProgressoVisao from "./ProgressoVisao";

const hoje = new Date();
const haDias = (n: number, h = 10) => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - n, h).toISOString();
const sessao = (o: Record<string, unknown>) => ({
  exercicio_id: "ambliopia",
  created_at: haDias(0),
  segundos_activos: 300,
  olho: "esquerdo",
  limiar: null,
  unidade: null,
  sinais: null,
  calibrado: true,
  ...o,
});

const montar = () =>
  render(
    <MemoryRouter initialEntries={["/exercicios/progresso"]}>
      <ProgressoVisao />
    </MemoryRouter>,
  );

beforeEach(() => {
  logado = true;
  sessoes = [];
  erro = false;
  recarregar.mockReset();
});

describe("ProgressoVisao — estados", () => {
  it("sem sessão: pede para entrar e volta ao progresso depois", () => {
    logado = false;
    montar();
    expect(screen.getByRole("heading", { level: 1, name: P.semSessaoTitulo })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: P.entrar })[0]).toHaveAttribute("href", "/login?next=%2Fexercicios%2Fprogresso");
  });

  it("enquanto carrega, diz que está a carregar e não mostra números", () => {
    sessoes = null;
    montar();
    expect(screen.getByRole("status")).toHaveTextContent(P.aCarregar);
    expect(screen.queryByText(P.actividadeTitulo)).not.toBeInTheDocument();
  });

  it("com erro: diz que não conseguiu ler, sem inventar, e deixa tentar de novo", async () => {
    sessoes = null;
    erro = true;
    const u = userEvent.setup();
    montar();
    expect(screen.getByRole("alert")).toHaveTextContent(V.erroACarregar);
    await u.click(screen.getByRole("button", { name: V.tentarDeNovo }));
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it("sem histórico: estado vazio com o caminho para os treinos (nunca gráficos vazios)", () => {
    montar();
    expect(screen.getByRole("heading", { name: P.vazioTitulo })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: P.verTreinos })).toHaveAttribute("href", "/exercicios");
    expect(screen.queryByText(P.actividadeTitulo)).not.toBeInTheDocument();
  });

  it("é o separador Progresso da app", () => {
    sessoes = [sessao({})];
    montar();
    const nav = screen.getByRole("navigation", { name: ptAO.PainelApp.navegacao });
    expect(within(nav).getByRole("link", { name: ptAO.PainelApp.progresso })).toHaveAttribute("aria-current", "page");
  });
});

describe("ProgressoVisao — os últimos 14 dias", () => {
  it("soma os minutos que contam, os dias e a sequência ('1 dia', nunca '1 dias')", () => {
    sessoes = [sessao({ created_at: haDias(0) }), sessao({ created_at: haDias(0, 15) }), sessao({ created_at: haDias(5) })];
    montar();
    const r = within(screen.getByRole("region", { name: P.actividadeTitulo }));
    expect(r.getByText("15 min")).toBeInTheDocument();
    expect(r.getByText("2 de 14")).toBeInTheDocument();
    expect(r.getByText("1 dia")).toBeInTheDocument();
  });

  it("os minutos por dia estão numa tabela (as barras são só imagem)", () => {
    sessoes = [sessao({ created_at: haDias(0) })];
    montar();
    const tabela = screen.getByRole("table", { name: P.tabelaMinutos });
    expect(within(tabela).getAllByRole("row")).toHaveLength(15); // cabeçalho + 14 dias
  });

  it("só testes, sem treinos: diz que os testes não contam aqui", () => {
    sessoes = [sessao({ exercicio_id: "figure8", olho: "direito", limiar: 0.3, unidade: "logmar" })];
    montar();
    expect(screen.getByText(P.semTreinos)).toBeInTheDocument();
  });
});

describe("ProgressoVisao — evolução por olho", () => {
  const acuidade = [
    sessao({ exercicio_id: "figure8", olho: "direito", limiar: 0.5, unidade: "logmar", created_at: haDias(6) }),
    sessao({ exercicio_id: "figure8", olho: "direito", limiar: 0.4, unidade: "logmar", created_at: haDias(6, 18) }),
    sessao({ exercicio_id: "figure8", olho: "esquerdo", limiar: 0.6, unidade: "logmar", created_at: haDias(6) }),
    sessao({ exercicio_id: "figure8", olho: "direito", limiar: 0.3, unidade: "logmar", created_at: haDias(0) }),
  ];

  it("a tabela tem um dia por linha (o mais recente primeiro) e o último valor do dia", async () => {
    sessoes = acuidade;
    const u = userEvent.setup();
    montar();
    await u.click(screen.getByText(P.verValores));
    const tabela = screen.getByRole("table", { name: /Teste de Acuidade/ });
    const linhas = within(tabela).getAllByRole("row").slice(1);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toHaveTextContent("0,30");
    expect(linhas[0]).toHaveTextContent("—"); // nesse dia não se testou o olho esquerdo
    expect(linhas[1]).toHaveTextContent("0,40"); // a última do dia, não a primeira
    expect(linhas[1]).toHaveTextContent("0,60");
  });

  it("escolher outro exercício sem resultados diz isso", async () => {
    sessoes = acuidade;
    const u = userEvent.setup();
    montar();
    await u.selectOptions(screen.getByLabelText(P.exercicio), "cerebro");
    expect(screen.getByText(P.semResultadosExercicio)).toBeInTheDocument();
  });

  it("a legenda distingue os olhos pelo nome, não só pela cor", () => {
    sessoes = acuidade;
    montar();
    const r = within(screen.getByRole("region", { name: V.curvaLimiar }));
    expect(r.getAllByText(V.olhoDireito).length).toBeGreaterThan(0);
    expect(r.getAllByText(V.olhoEsquerdo).length).toBeGreaterThan(0);
  });

  it("liga ao relatório para a consulta", () => {
    sessoes = acuidade;
    montar();
    expect(screen.getByRole("link", { name: V.verRelatorio })).toHaveAttribute("href", "/exercicios/relatorio");
  });

  it("sem violações de acessibilidade", async () => {
    sessoes = acuidade;
    const { container } = montar();
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
