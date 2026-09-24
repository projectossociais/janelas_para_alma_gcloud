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

function guardarResultado(recomendacao?: string) {
  sessionStorage.setItem(
    "scanResult",
    JSON.stringify({
      diagnosis: "Necessária Avaliação Oftalmológica",
      confidence: 60,
      date: "2026-09-24T10:00:00Z",
      apiData: recomendacao ? { recomendacao } : null,
    }),
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
