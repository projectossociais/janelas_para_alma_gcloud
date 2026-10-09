import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Sessões de exercício versão 2 (sem webcam) guardam o limiar, não pontuação
// nem precisão: até 2026-10-09 o painel mostrava-as todas com "0" e "0%".

const base = {
  utilizador_id: "u1",
  utilizador_nome: "Ana",
  utilizador_email: "ana@exemplo.ao",
  duracao_segundos: 120,
  pontuacao: 0,
  precisao_percentual: 0,
  created_at: "2026-10-09T10:00:00Z",
  versao: 2,
  olho: "direito",
  segundos_activos: 110,
  limiar: null,
  unidade: null,
  baixa_atencao: false,
  astigmatismo: null,
};
const listarSessoesExercicio = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  adminApi: {
    listarSessoesExercicio: (...a: unknown[]) => listarSessoesExercicio(...a),
    listarAtivos: () => Promise.resolve([]),
  },
  mensagemDeErroApi: (_e: unknown, f: string) => f,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import AdminAtividade from "./AdminAtividade";

describe("AdminAtividade -- resultado de cada sessão", () => {
  it("versão 2 mostra o limiar e o olho; versão 1 continua com pontos e precisão", async () => {
    listarSessoesExercicio.mockResolvedValue([
      { ...base, id: "s1", exercicio_id: "ambliopia", limiar: 0.3, unidade: "logmar", baixa_atencao: true },
      { ...base, id: "s2", exercicio_id: "relax", astigmatismo: true },
      { ...base, id: "s3", exercicio_id: "figure8", versao: 1, olho: null, pontuacao: 80, precisao_percentual: 92 },
    ]);
    render(<AdminAtividade />, { wrapper: MemoryRouter });

    expect(await screen.findByText("logMAR 0,30")).toBeInTheDocument();
    expect(screen.getByText("(baixa atenção)")).toBeInTheDocument();
    expect(screen.getByText("80 pts · 92%")).toBeInTheDocument();
    expect(screen.queryByText("0 pts · 0%")).not.toBeInTheDocument();
  });
});
