import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ResumoTendencia from "./ResumoTendencia";
import RelatorioSemanal from "@/pages/exercises/RelatorioSemanal";
import type { SessaoExercicioPublica } from "@/lib/apiClient";

// Resultados em linguagem simples (Fase A, docs/ANALISE_EXERCICIOS.md).

const hoje = new Date();
const haDias = (n: number) => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - n, 10).toISOString();

const sessao = (over: Partial<SessaoExercicioPublica>): SessaoExercicioPublica => ({
  id: Math.random().toString(36).slice(2),
  user_id: "u1",
  exercicio_id: "figure8",
  duracao_segundos: 120,
  pontuacao: 0,
  precisao_percentual: 0,
  detalhes: null,
  created_at: haDias(0),
  versao: 2,
  olho: "esquerdo",
  segundos_activos: 120,
  limiar: 0.3,
  unidade: "logmar",
  distancia_mm: 600,
  px_por_mm: 4.2,
  calibrado: true,
  sinais: null,
  ...over,
});

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isLoggedIn: true, loading: false }) }));
vi.mock("@/contexts/ProfileContext", () => ({ useProfile: () => ({ profile: null, loading: false }) }));
let historico: SessaoExercicioPublica[] = [];
vi.mock("@/components/visao/hooks", () => ({
  useHistoricoVisao: () => ({ sessoes: historico, erro: false, recarregar: () => undefined }),
}));

describe("ResumoTendencia", () => {
  it("diz em linguagem simples quantas linhas o olho melhorou, sem jargão", () => {
    const sessoes = [sessao({ created_at: haDias(21), limiar: 0.5 }), sessao({ created_at: haDias(0), limiar: 0.3 })];
    render(<ResumoTendencia sessoes={sessoes} exercicioId="figure8" olhos={["esquerdo"]} />);
    expect(screen.getByText("Olho esquerdo: já lê 2 linhas mais pequenas do que há 21 dias.")).toBeInTheDocument();
    expect(screen.queryByText(/logMAR/)).not.toBeInTheDocument();
  });

  it("com uma só sessão, pede mais uma noutro dia em vez de inventar uma tendência", () => {
    render(<ResumoTendencia sessoes={[sessao({})]} exercicioId="figure8" olhos={["direito", "esquerdo"]} />);
    expect(screen.getByText(/Olho esquerdo: faça pelo menos mais uma sessão/)).toBeInTheDocument();
    expect(screen.getByText(/Olho direito: faça pelo menos mais uma sessão/)).toBeInTheDocument();
  });

  it("a piorar, recomenda falar com o oftalmologista", () => {
    const sessoes = [sessao({ created_at: haDias(10), limiar: 0.2 }), sessao({ created_at: haDias(0), limiar: 0.3 })];
    render(<ResumoTendencia sessoes={sessoes} exercicioId="figure8" olhos={["esquerdo"]} />);
    expect(screen.getByText(/uma linha maiores do que há 10 dias\. Se continuar assim, fale com o oftalmologista\./)).toBeInTheDocument();
  });

  it("só com sessões sem cartão, avisa que é aproximado", () => {
    const sessoes = [
      sessao({ created_at: haDias(7), limiar: 0.5, calibrado: false }),
      sessao({ created_at: haDias(0), limiar: 0.3, calibrado: false }),
    ];
    render(<ResumoTendencia sessoes={sessoes} exercicioId="figure8" olhos={["esquerdo"]} />);
    expect(screen.getByText(/aproximado: ecrã sem calibração com cartão/)).toBeInTheDocument();
  });
});

describe("Relatório semanal: auto-avaliação separada das medições", () => {
  it("marca a Convergência e o Perto e longe como auto-avaliação, e não os treinos medidos", () => {
    historico = [
      sessao({ exercicio_id: "convergence", olho: "ambos", limiar: 42, unidade: "segundos" }),
      sessao({ exercicio_id: "ambliopia", limiar: 0.3, unidade: "logmar" }),
    ];
    render(
      <MemoryRouter>
        <RelatorioSemanal />
      </MemoryRouter>,
    );
    const marcas = screen.getAllByText(/\(auto-avaliação\)/);
    expect(marcas).toHaveLength(1);
    expect(marcas[0].closest("tr")).toHaveTextContent("Treino de Convergência");
    expect(screen.getByText(/Os resultados marcados como auto-avaliação/)).toBeInTheDocument();
  });
});
