import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "@/i18n";

vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/BackButton", () => ({ default: () => null }));

import ScannerResultados from "./ScannerResultados";

const RECOMENDACAO_PT =
  "Não foi possível comparar as posições do olhar. Para repetir: na foto esquerda e direita, olhe para o lado pedido.";

// Uma resposta real do serviço traz sempre as três posições do olhar.
const posicao = (posicao: string, fiavel = true) => ({
  posicao,
  rosto_detetado: true,
  utilizavel: fiavel,
  qualidade_captura: { pontuacao: fiavel ? 0.8 : 0.39, fiavel, motivos: [] },
});
const POSICOES_BOAS = [posicao("CENTRO"), posicao("ESQUERDA"), posicao("DIREITA")];

function guardarResultado(recomendacao?: string) {
  sessionStorage.setItem(
    "scanResult",
    JSON.stringify({
      diagnosis: "Necessária Avaliação Oftalmológica",
      confidence: 60,
      date: "2026-09-24T10:00:00Z",
      apiData: recomendacao
        ? {
            recomendacao,
            requer_avaliacao_humana: true,
            motilidade: { variacao_desalinhamento: 0.12, incomitante: false },
            posicoes: POSICOES_BOAS,
          }
        : null,
    }),
  );
}

function guardarAnalise(diagnosis: string, apiData: Record<string, unknown>) {
  sessionStorage.setItem(
    "scanResult",
    JSON.stringify({ diagnosis, confidence: 39, date: "2026-10-09T10:00:00Z", apiData }),
  );
}

const abrir = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <ScannerResultados />
    </MemoryRouter>,
  );

describe("ScannerResultados -- recomendação vinda do microserviço", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => {
    vi.unstubAllEnvs();
    void i18n.changeLanguage("pt-AO");
  });

  it("em português mostra a recomendação sem ponto duplo antes da frase seguinte (bug real: 'pedido..')", async () => {
    guardarResultado(RECOMENDACAO_PT);
    abrir("/scanner/resultados");
    const texto = await screen.findByText(/Não foi possível comparar as posições do olhar/);
    expect(texto.textContent).toContain("olhe para o lado pedido. Recomenda-se consulta");
    expect(texto.textContent).not.toContain("..");
  });

  describe("no site inglês", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_ENABLE_EN", "true");
      void i18n.changeLanguage("en-US");
    });

    it("traduz a recomendação conhecida -- nenhum português no ecrã", async () => {
      guardarResultado(RECOMENDACAO_PT);
      abrir("/en/scanner/results");
      const texto = await screen.findByText(/We couldn't compare your gaze positions/);
      expect(texto.textContent).toContain("when the left and right photos are taken. An eye exam");
      expect(document.body.textContent).not.toMatch(/Não foi possível|olhe para o lado/);
    });

    it("uma recomendação desconhecida dá lugar à descrição traduzida da categoria", async () => {
      guardarResultado("Recomenda-se nova captura com melhor iluminação.");
      abrir("/en/scanner/results");
      await screen.findByText(/An eye exam with an ophthalmologist is recommended/);
      expect(document.body.textContent).not.toMatch(/Recomenda-se nova captura/);
    });
  });
});

describe("ScannerResultados -- fotografias fracas nunca dão 'normal'", () => {
  it("sem sinal mas com uma fotografia não fiável: diz que não conseguiu medir e pede para repetir", async () => {
    guardarAnalise("Alinhamento Fisiológico Normal", {
      requer_avaliacao_humana: false,
      motilidade: { variacao_desalinhamento: 0.02, incomitante: false },
      posicoes: [posicao("CENTRO"), posicao("ESQUERDA"), posicao("DIREITA", false)],
    });
    abrir("/scanner/resultados");
    expect(await screen.findByRole("heading", { name: "Não conseguimos medir bem" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fazer o rastreio de novo" })).toBeInTheDocument();
    expect(screen.queryByText(/Alinhamento Fisiológico Normal/)).not.toBeInTheDocument();
  });

  it("pedido de avaliação só porque não comparou as posições, com fotografia fraca: também inconclusivo (caso real 2026-10-06)", async () => {
    guardarAnalise("Necessária Avaliação Oftalmológica", {
      requer_avaliacao_humana: true,
      motilidade: null,
      posicoes: [posicao("CENTRO"), posicao("ESQUERDA"), posicao("DIREITA", false)],
    });
    abrir("/scanner/resultados");
    expect(await screen.findByRole("heading", { name: "Não conseguimos medir bem" })).toBeInTheDocument();
  });

  it("sem sinal e com as três fotografias fiáveis: continua normal", async () => {
    guardarAnalise("Alinhamento Fisiológico Normal", {
      requer_avaliacao_humana: false,
      motilidade: { variacao_desalinhamento: 0.02, incomitante: false },
      posicoes: POSICOES_BOAS,
    });
    abrir("/scanner/resultados");
    expect((await screen.findAllByText(/Alinhamento Fisiológico Normal/)).length).toBeGreaterThan(0);
    expect(screen.queryByText("Não conseguimos medir bem")).not.toBeInTheDocument();
  });
});
