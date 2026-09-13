import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Resultados from "./ScannerResultados";

// O que importa aqui: o sinal técnico (W-13/W-15) só existe para a captura
// por câmara, nunca é fabricado quando a API falha, e o fluxo de upload
// (sem landmarks enviados) nunca sequer o pede. CLAUDE.md secção 8 -- decidir
// o que aparece como "resultado" de um exame exige teste.

vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

const obterScreening = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  screeningsApi: { obter: (...a: unknown[]) => obterScreening(...a) },
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));

const renderPagina = () =>
  render(
    <MemoryRouter>
      <Resultados />
    </MemoryRouter>
  );

const definirScanResult = (over: Record<string, unknown> = {}) => {
  sessionStorage.setItem(
    "scanResult",
    JSON.stringify({
      capturedAt: "2026-09-12T10:00:00.000Z",
      method: "upload",
      posesCapturadas: [],
      analysisId: null,
      ...over,
    })
  );
};

beforeEach(() => {
  sessionStorage.clear();
  obterScreening.mockReset();
});

describe("ScannerResultados — sinal técnico honesto", () => {
  it("fluxo de upload nunca pede nem mostra um sinal técnico", async () => {
    definirScanResult({ method: "upload", analysisId: null });
    renderPagina();

    expect(await screen.findByText(/Sinais registados/i)).toBeInTheDocument();
    expect(obterScreening).not.toHaveBeenCalled();
    expect(screen.queryByText(/Sinal técnico/i)).not.toBeInTheDocument();
  });

  it("fluxo de câmara busca e mostra o sinal técnico calculado pela API", async () => {
    definirScanResult({
      method: "camera",
      analysisId: "screening-1",
      posesCapturadas: ["center", "right", "left"],
    });
    obterScreening.mockResolvedValue({
      id: "screening-1",
      user_id: "u1",
      estado: "concluido",
      rosto_detetado: true,
      requer_avaliacao_humana: true,
      assimetria_horizontal: 0.031,
      assimetria_vertical: -0.004,
      qualidade_captura: 0.9,
      qualidade_fiavel: true,
      qualidade_motivos: [],
      versao_analise: "geometria-iris-v1-experimental",
      criado_em: "2026-09-12T10:00:05.000Z",
    });

    renderPagina();

    expect(await screen.findByText(/Sinal técnico \(experimental\)/i)).toBeInTheDocument();
    expect(screen.getByText("0.031")).toBeInTheDocument();
    expect(obterScreening).toHaveBeenCalledWith("screening-1");
  });

  it("mostra os motivos de baixa qualidade, nunca esconde uma captura problemática", async () => {
    definirScanResult({ method: "camera", analysisId: "screening-2" });
    obterScreening.mockResolvedValue({
      id: "screening-2",
      user_id: "u1",
      estado: "concluido",
      rosto_detetado: true,
      requer_avaliacao_humana: true,
      assimetria_horizontal: 0.4,
      assimetria_vertical: 0.1,
      qualidade_captura: 0.3,
      qualidade_fiavel: false,
      qualidade_motivos: ["cabeça inclinada (~15°) durante a captura"],
      versao_analise: "geometria-iris-v1-experimental",
      criado_em: "2026-09-12T10:00:05.000Z",
    });

    renderPagina();

    expect(await screen.findByText(/cabeça inclinada/i)).toBeInTheDocument();
    expect(screen.getByText(/Qualidade técnica da captura: baixa/i)).toBeInTheDocument();
  });

  it("nunca finge um sinal técnico quando a API falha", async () => {
    definirScanResult({ method: "camera", analysisId: "screening-3" });
    obterScreening.mockRejectedValue({ status: 500, message: "falha simulada" });

    renderPagina();

    expect(await screen.findByText("falha simulada")).toBeInTheDocument();
    expect(screen.queryByText(/Sinal técnico \(experimental\)/i)).not.toBeInTheDocument();
  });

  it("rosto não detetado: nunca inventa um número, mostra o estado honesto", async () => {
    definirScanResult({ method: "camera", analysisId: "screening-4" });
    obterScreening.mockResolvedValue({
      id: "screening-4",
      user_id: "u1",
      estado: "sem_deteccao",
      rosto_detetado: false,
      requer_avaliacao_humana: true,
      assimetria_horizontal: null,
      assimetria_vertical: null,
      qualidade_captura: 0,
      qualidade_fiavel: false,
      qualidade_motivos: ["rosto não detetado na pose central"],
      versao_analise: "geometria-iris-v1-experimental",
      criado_em: "2026-09-12T10:00:05.000Z",
    });

    renderPagina();

    expect(await screen.findByText(/Não foi possível calcular um sinal técnico/i)).toBeInTheDocument();
  });
});
