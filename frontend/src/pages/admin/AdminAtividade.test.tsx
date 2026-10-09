import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { violacoesAcessibilidade } from "@/design/testes/acessibilidade";

const listarSessoesExercicio = vi.fn();
const listarAtivos = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  adminApi: {
    listarSessoesExercicio: (...a: unknown[]) => listarSessoesExercicio(...a),
    listarAtivos: (...a: unknown[]) => listarAtivos(...a),
  },
  mensagemDeErroApi: (err: unknown, fallback: string) => (err as { message?: string })?.message || fallback,
}));

import AdminAtividade from "./AdminAtividade";

const BASE = {
  user_id: "u1",
  utilizador_nome: "Rui",
  utilizador_email: "rui@example.com",
  created_at: "2026-10-08T10:00:00Z",
  baixa_atencao: false,
  astigmatismo: null,
};

const V1 = {
  ...BASE,
  id: "s1",
  exercicio_id: "convergence",
  duracao_segundos: 120,
  pontuacao: 80,
  precisao_percentual: 91.5,
  versao: 1,
  olho: null,
  segundos_activos: null,
  limiar: null,
  unidade: null,
};

const V2 = {
  ...BASE,
  id: "s2",
  exercicio_id: "figure8",
  duracao_segundos: 90,
  pontuacao: 0,
  precisao_percentual: 0,
  versao: 2,
  olho: "direito",
  segundos_activos: 75,
  limiar: 0.3,
  unidade: "logmar",
  baixa_atencao: true,
};

const abrir = (url = "/admin/atividade") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <AdminAtividade />
    </MemoryRouter>,
  );

describe("AdminAtividade", () => {
  beforeEach(() => {
    listarSessoesExercicio.mockReset().mockResolvedValue([V1, V2]);
    listarAtivos.mockReset().mockResolvedValue([
      { user_id: "u1", utilizador_nome: "Rui", utilizador_email: "rui@example.com", sessoes_no_periodo: 4, ultima_sessao_em: "2026-10-08T10:00:00Z" },
    ]);
  });

  // Caso real (2026-10-09): as sessões novas não têm pontuação nem precisão
  // (ficam a 0), e a tabela só tinha essas colunas -- "0" e "0 %" em todas.
  it("uma sessão nova mostra o que o exercício mede (limiar, olho, tempo activo), nunca '0 %'", async () => {
    abrir();
    const linha = (await screen.findByText("Teste de Acuidade")).closest("tr") as HTMLElement;
    expect(linha).toHaveTextContent("Olho direito");
    expect(linha).toHaveTextContent("logMAR 0,30");
    expect(linha).toHaveTextContent("1 min 15 s");
    expect(within(linha).getByText("Baixa atenção")).toBeInTheDocument();
    expect(linha).not.toHaveTextContent("0 %");
  });

  it("uma sessão antiga fica marcada como tal, com a pontuação e a precisão de então", async () => {
    abrir();
    const linha = (await screen.findByText("convergence (versão antiga)")).closest("tr") as HTMLElement;
    expect(linha).toHaveTextContent("80 pts · 92 %");
  });

  it("abre na vista e no período que vêm da visão geral", async () => {
    abrir("/admin/atividade?tab=ativos&dias=7");
    expect(await screen.findByRole("table", { name: "Utilizadores activos" })).toBeInTheDocument();
    expect(listarAtivos).toHaveBeenCalledWith(7);
    expect(screen.getByText("Últimos 7 dias.")).toBeInTheDocument();
  });

  it("mudar de vista mostra a outra tabela", async () => {
    abrir();
    await screen.findByRole("table", { name: "Sessões de exercício" });
    await userEvent.click(screen.getByRole("radio", { name: /Activos no período/ }));
    expect(await screen.findByRole("table", { name: "Utilizadores activos" })).toBeInTheDocument();
  });

  it("se falhar: diz porquê, nunca 'Sem sessões'", async () => {
    listarSessoesExercicio.mockReset().mockRejectedValue(new Error("Sem permissões"));
    abrir();
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem permissões");
    expect(screen.queryByText(/Sem sessões/)).not.toBeInTheDocument();
  });

  it("sem violações de acessibilidade", async () => {
    const { container } = abrir();
    await screen.findByText("Teste de Acuidade");
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
