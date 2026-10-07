import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import i18n from "@/i18n";
import ptAO from "@/i18n/locales/pt-AO.json";
import { violacoesAcessibilidade } from "@/design/testes/acessibilidade";
import type { ScreeningResponse } from "@/services/api/screeningApi";

const T = ptAO.ResultadoRastreio;

let mockLogado = false;
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoggedIn: mockLogado }),
}));

// O PDF: o jsPDF real não corre aqui; regista-se só que se gravou um ficheiro.
const gravarPdf = vi.fn();
vi.mock("jspdf", () => ({
  default: class {
    save = (nome: string) => gravarPdf(nome);
  },
}));
vi.mock("@/lib/relatorio/pdfRelatorio", () => ({
  RelatorioPdf: class {
    cabecalho() {}
    paragrafo() {}
    seccao() {}
    campos() {}
    tabela() {}
    lista() {}
    rodape() {}
  },
}));
// O jsdom não carrega imagens: sem logótipo, o relatório sai na mesma.
vi.mock("@/lib/rastreio/relatorioRastreio", async (original) => ({
  ...(await original<typeof import("@/lib/rastreio/relatorioRastreio")>()),
  carregarImagemComoDataUrl: () => Promise.reject(new Error("sem imagens no jsdom")),
}));

import ScannerResultados from "./ScannerResultados";

const FIAVEL = { pontuacao: 0.9, fiavel: true };
const posicoes = (rostoDireita = true) =>
  ["CENTRO", "DIREITA", "ESQUERDA"].map((posicao) => ({
    posicao,
    estado: "ok",
    rosto_detetado: posicao === "DIREITA" ? rostoDireita : true,
    qualidade_captura: FIAVEL,
  }));

const ANALISE_NORMAL: ScreeningResponse = { estado: "concluido", posicoes: posicoes(), requer_avaliacao_humana: false };
const ANALISE_AVALIACAO: ScreeningResponse = { ...ANALISE_NORMAL, requer_avaliacao_humana: true };
const ANALISE_FRACA: ScreeningResponse = { ...ANALISE_NORMAL, posicoes: posicoes(false) };

function guardar(diagnosis: string, apiData: ScreeningResponse | null, confidence = 92) {
  sessionStorage.setItem(
    "scanResult",
    JSON.stringify({ diagnosis, confidence, date: "2026-09-30T10:00:00Z", apiData }),
  );
}

const abrir = (url = "/scanner/resultados") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/scanner/resultados" element={<ScannerResultados />} />
        <Route path="/en/scanner/results" element={<ScannerResultados />} />
        <Route path="/scanner" element={<p>Página do rastreio</p>} />
        <Route path="/rastreio-completo" element={<p>Página do rastreio completo</p>} />
      </Routes>
    </MemoryRouter>,
  );

/** A acção principal existe duas vezes no DOM (barra do telemóvel e fim da coluna). */
const principal = (nome: string) => screen.getAllByRole("link", { name: nome })[0]!;

beforeEach(() => {
  sessionStorage.clear();
  mockLogado = false;
  gravarPdf.mockReset();
});

describe("ScannerResultados — as três conclusões", () => {
  it("avaliação: diz para ir ao oftalmologista e o próximo passo é marcar consulta", async () => {
    guardar("Necessária Avaliação Oftalmológica", ANALISE_AVALIACAO);
    abrir();
    expect(await screen.findByRole("heading", { level: 1, name: T.avaliacaoTitulo })).toBeInTheDocument();
    expect(screen.getByText(T.avaliacaoAvisoTitulo)).toBeInTheDocument();
    expect(principal(T.marcarConsulta)).toHaveAttribute("href", "/marcar-consulta");
  });

  it("normal com fotografias fiáveis: sem sinais, mas deixa marcar consulta na mesma", async () => {
    guardar("Alinhamento Fisiológico Normal", ANALISE_NORMAL);
    abrir();
    expect(await screen.findByRole("heading", { level: 1, name: T.normalTitulo })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: T.marcarMesmoAssim })).toHaveAttribute("href", "/marcar-consulta");
    expect(principal(T.voltarInicio)).toHaveAttribute("href", "/");
  });

  it("'normal' com uma fotografia sem rosto nunca aparece como normal: pede para repetir", async () => {
    guardar("Alinhamento Fisiológico Normal", ANALISE_FRACA);
    abrir();
    expect(await screen.findByRole("heading", { level: 1, name: T.inconclusivoTitulo })).toBeInTheDocument();
    expect(screen.queryByText(T.normalTitulo)).not.toBeInTheDocument();
    expect(principal(T.repetir)).toHaveAttribute("href", "/scanner");
  });

  it("não mostra o que foi retirado: confiança, tipos de estrabismo, clínicas, preços, convergência", async () => {
    guardar("Esotropia", null);
    abrir();
    await screen.findByRole("heading", { level: 1, name: T.avaliacaoTitulo });
    expect(document.body.textContent).not.toMatch(
      /92\s*%|confian|esotropia|exotropia|hipertropia|hipotropia|Sagrada|Girassol|Multiperfil|Kz|converg/i,
    );
  });
});

describe("ScannerResultados — ligação à marcação", () => {
  it("com o rastreio guardado, a marcação leva o id dele (o pedido fica ligado)", async () => {
    mockLogado = true;
    guardar("Necessária Avaliação Oftalmológica", ANALISE_AVALIACAO);
    abrir("/scanner/resultados?id=scr-1");
    await screen.findByRole("heading", { level: 1 });
    expect(principal(T.marcarConsulta)).toHaveAttribute("href", "/marcar-consulta?rastreio=scr-1");
  });
});

describe("ScannerResultados — sem resultado", () => {
  it("sem resultado guardado, volta ao rastreio", async () => {
    abrir();
    expect(await screen.findByText("Página do rastreio")).toBeInTheDocument();
  });

  it("com um resultado estragado, volta ao rastreio em vez de partir o ecrã", async () => {
    sessionStorage.setItem("scanResult", "{estragado");
    abrir();
    expect(await screen.findByText("Página do rastreio")).toBeInTheDocument();
  });
});

describe("ScannerResultados — onde fica o resultado", () => {
  it("guardado na conta (o rastreio passa o id)", async () => {
    mockLogado = true;
    guardar("Alinhamento Fisiológico Normal", ANALISE_NORMAL);
    abrir("/scanner/resultados?id=abc");
    expect(await screen.findByText(T.guardado)).toBeInTheDocument();
    expect(principal(T.minhaArea)).toHaveAttribute("href", "/dashboard");
  });

  it("com sessão mas sem id, a gravação falhou: diz-se, nunca se finge que ficou guardado", async () => {
    mockLogado = true;
    guardar("Alinhamento Fisiológico Normal", ANALISE_NORMAL);
    abrir();
    expect(await screen.findByText(T.naoGuardadoConta)).toBeInTheDocument();
    expect(screen.queryByText(T.guardado)).not.toBeInTheDocument();
  });

  it("sem sessão, avisa que não fica guardado", async () => {
    guardar("Alinhamento Fisiológico Normal", ANALISE_NORMAL);
    abrir();
    expect(await screen.findByText(T.naoGuardadoSemSessao)).toBeInTheDocument();
  });
});

describe("ScannerResultados — relatório para o médico", () => {
  it("descarrega o PDF", async () => {
    guardar("Necessária Avaliação Oftalmológica", ANALISE_AVALIACAO);
    abrir();
    await userEvent.click(await screen.findByRole("button", { name: T.descarregar }));
    await waitFor(() => expect(gravarPdf).toHaveBeenCalledWith("rastreio-ocular-2026-09-30.pdf"));
  });

  it("se o PDF falhar, diz que falhou", async () => {
    gravarPdf.mockImplementation(() => {
      throw new Error("disco cheio");
    });
    guardar("Necessária Avaliação Oftalmológica", ANALISE_AVALIACAO);
    abrir();
    await userEvent.click(await screen.findByRole("button", { name: T.descarregar }));
    expect(await screen.findByRole("alert")).toHaveTextContent(T.erroPdf);
  });
});

describe("ScannerResultados — nota da análise (texto livre do microserviço)", () => {
  const RECOMENDACAO_PT =
    "Não foi possível comparar as posições do olhar. Para repetir: na foto esquerda e direita, olhe para o lado pedido.";

  afterEach(() => {
    vi.unstubAllEnvs();
    void i18n.changeLanguage("pt-AO");
  });

  it("em português mostra a nota tal como veio", async () => {
    guardar("Necessária Avaliação Oftalmológica", { ...ANALISE_AVALIACAO, recomendacao: RECOMENDACAO_PT });
    abrir();
    const seccao = (await screen.findByRole("heading", { name: T.notaAnalise })).closest("section")!;
    expect(within(seccao).getByText(RECOMENDACAO_PT)).toBeInTheDocument();
  });

  describe("no site inglês", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_ENABLE_EN", "true");
      void i18n.changeLanguage("en-US");
    });

    it("traduz a nota conhecida -- nenhum português no ecrã", async () => {
      guardar("Necessária Avaliação Oftalmológica", { ...ANALISE_AVALIACAO, recomendacao: RECOMENDACAO_PT });
      abrir("/en/scanner/results");
      expect(await screen.findByText(/We couldn't compare your gaze positions/)).toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(/Não foi possível|olhe para o lado/);
    });

    it("uma nota desconhecida não aparece", async () => {
      guardar("Necessária Avaliação Oftalmológica", {
        ...ANALISE_AVALIACAO,
        recomendacao: "Recomenda-se nova captura com melhor iluminação.",
      });
      abrir("/en/scanner/results");
      await screen.findByRole("heading", { level: 1 });
      expect(document.body.textContent).not.toMatch(/Recomenda-se nova captura/);
    });
  });
});

describe("ScannerResultados — acessibilidade", () => {
  it.each([
    ["avaliação", ANALISE_AVALIACAO],
    ["normal", ANALISE_NORMAL],
    ["inconclusivo", ANALISE_FRACA],
  ])("sem violações (%s)", async (_, analise) => {
    guardar("Necessária Avaliação Oftalmológica", analise);
    const { container } = abrir();
    await screen.findByRole("heading", { level: 1 });
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});

describe("ScannerResultados — rastreio completo (motor próprio)", () => {
  const motor = (dica = "geral") => ({
    horizontalDelta: 9.2,
    verticalDelta: 0.4,
    dispersaoDelta: 0.9,
    fotografiasValidas: 4,
    fotografiasTotal: 5,
    versaoRegra: "regra-1",
    motivo: null,
    dica,
  });
  const guardarMotor = (conclusao: string, dica = "geral") =>
    sessionStorage.setItem(
      "scanResult",
      JSON.stringify({
        diagnosis: conclusao === "normal" ? "Alinhamento Fisiológico Normal" : "Necessária Avaliação Oftalmológica",
        confidence: 0,
        date: "2026-10-07T10:00:00Z",
        apiData: null,
        conclusao,
        motor: motor(dica),
      }),
    );

  it("avaliação do motor: encaminha para consulta e repetir leva ao rastreio completo", async () => {
    guardarMotor("avaliacao");
    abrir();
    expect(await screen.findByRole("heading", { level: 1, name: T.avaliacaoTitulo })).toBeInTheDocument();
    expect(principal(T.marcarConsulta)).toHaveAttribute("href", "/marcar-consulta");
    expect(screen.getByRole("link", { name: T.repetir })).toHaveAttribute("href", "/rastreio-completo");
  });

  it("não mediu: inconclusivo, com a dica do motivo e a repetir no rastreio completo", async () => {
    guardarMotor("inconclusivo", "luz");
    abrir();
    expect(await screen.findByRole("heading", { level: 1, name: T.inconclusivoTitulo })).toBeInTheDocument();
    expect(screen.getByText(T.dicaLuz)).toBeInTheDocument();
    expect(principal(T.repetir)).toHaveAttribute("href", "/rastreio-completo");
  });

  it("o relatório PDF sai com as medições do motor", async () => {
    guardarMotor("avaliacao");
    const u = userEvent.setup();
    abrir();
    await u.click(await screen.findByRole("button", { name: T.descarregar }));
    await waitFor(() => expect(gravarPdf).toHaveBeenCalled());
  });
});
