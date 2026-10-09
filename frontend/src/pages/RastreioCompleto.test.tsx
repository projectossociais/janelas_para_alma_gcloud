import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ptAO from "@/i18n/locales/pt-AO.json";

const T = ptAO.RastreioCompleto;

// Tudo o que é de hardware ou de rede é simulado; a lógica do ecrã e a medição
// da sessão (`medirFotografias`) são as verdadeiras.
let caminhoA = true;
const ligar = vi.fn();
const desligar = vi.fn();
const fotografarSequencia = vi.fn();
// O estado que a câmara "verdadeira" teria depois de `ligar`; muda com re-desenho, como no hook real.
let estadoDepoisDeLigar = "ligada";
vi.mock("@/hooks/useCameraTraseira", async () => {
  const { useState } = await import("react");
  return {
    suportaCaminhoA: () => caminhoA,
    useCameraTraseira: () => {
      const [estado, setEstado] = useState("desligada");
      return {
        refVideo: () => {},
        estado,
        luzDisponivel: true,
        ligar: async () => {
          const ok = await ligar();
          setEstado(estadoDepoisDeLigar);
          return ok;
        },
        desligar: () => desligar(),
        fotografarSequencia: (...a: unknown[]) => fotografarSequencia(...a),
      };
    },
  };
});

const IRIS = [
  { centro: { x: 100, y: 100 }, raio: 20 },
  { centro: { x: 200, y: 100 }, raio: 20 },
];
const detectarIris = vi.fn();
vi.mock("@/lib/rastreio/detectorIris", () => ({ detectarIris: (...a: unknown[]) => detectarIris(...a) }));

const analisarFoto = vi.fn();
vi.mock("@/lib/rastreio/captura/analisarFoto", () => ({ analisarFoto: (...a: unknown[]) => analisarFoto(...a) }));

const classificar = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  rastreioCompletoApi: { classificar: (...a: unknown[]) => classificar(...a) },
}));

const garantir = vi.fn();
vi.mock("@/contexts/ConsentimentoSaudeContext", () => ({
  useConsentimentoSaude: () => ({ garantir: () => garantir() }),
}));

let sessaoIniciada = false;
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isLoggedIn: sessaoIniciada }) }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/BackButton", () => ({ default: () => null }));

import RastreioCompleto from "./RastreioCompleto";

const bitmap = () => ({ close: vi.fn(), width: 4000, height: 3000 });
const desvio = (h: number) => ({
  horizontalDelta: h,
  verticalDelta: 0.2,
  mmPorPx: 0.03,
  direito: { nasal: 0.5, superior: 0 },
  esquerdo: { nasal: 0.5, superior: 0 },
});

beforeEach(() => {
  caminhoA = true;
  sessaoIniciada = false;
  estadoDepoisDeLigar = "ligada";
  ligar.mockReset().mockResolvedValue(true);
  desligar.mockReset();
  fotografarSequencia.mockReset().mockImplementation(async () => [bitmap(), bitmap(), bitmap(), bitmap()]);
  detectarIris.mockReset().mockResolvedValue(IRIS);
  analisarFoto.mockReset().mockReturnValue({ desvio: desvio(1.5), motivo: null });
  classificar
    .mockReset()
    .mockResolvedValue({ conclusao: "sem_sinais", motivo: null, versao_regra: "regra-1", screening_id: "s-1" });
  garantir.mockReset().mockResolvedValue(true);
  vi.stubGlobal("createImageBitmap", vi.fn(async () => bitmap()));
  vi.stubGlobal("scrollTo", vi.fn());
});

const montar = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/rastreio-completo"]}>
        <Routes>
          <Route path="/rastreio-completo" element={<RastreioCompleto />} />
          <Route path="/" element={<p>Página inicial</p>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

const botao = (nome: string) => screen.getByRole("button", { name: nome });
const esperarBotao = (nome: string) => screen.findByRole("button", { name: nome });

async function prepararEIrParaACamera(u: ReturnType<typeof userEvent.setup>) {
  for (const r of [T.pessoa, T.oculos, T.luz, T.alvo]) await u.click(screen.getByText(r));
  await u.click(botao(T.estouPronto));
}

async function tirarFotografias(u: ReturnType<typeof userEvent.setup>) {
  await prepararEIrParaACamera(u);
  await u.click(await esperarBotao(T.permitir));
  await u.click(await esperarBotao(T.tirarFotografias));
}

describe("RastreioCompleto — preparação", () => {
  it("só avança com as quatro confirmações, e diz o que falta", async () => {
    const u = userEvent.setup();
    montar();
    expect(botao(T.estouPronto)).toBeDisabled();
    expect(screen.getByText(T.faltaConfirmar)).toBeInTheDocument();
    for (const r of [T.pessoa, T.oculos, T.luz]) await u.click(screen.getByText(r));
    expect(botao(T.estouPronto)).toBeDisabled();
    await u.click(screen.getByText(T.alvo));
    expect(botao(T.estouPronto)).toBeEnabled();
  });

  it("oferece a folha com os pontos para imprimir (abre noutro separador)", () => {
    montar();
    const ligacao = screen.getByRole("link", { name: T.alvoLigacao });
    expect(ligacao).toHaveAttribute("href", "/alvo-fixacao.svg");
    expect(ligacao).toHaveAttribute("target", "_blank");
    expect(ligacao).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("não se deixa indexar pelos motores de busca e avisa que é uma versão de teste", async () => {
    montar();
    expect(screen.getByText(T.testeTitulo)).toBeInTheDocument();
    await waitFor(() => expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toContain("noindex"));
  });
});

describe("RastreioCompleto — câmara na página (caminho A)", () => {
  it("fluxo completo: mede no telemóvel, envia só números e mostra o resultado com as medições", async () => {
    const u = userEvent.setup();
    montar();
    await tirarFotografias(u);

    expect(await screen.findByRole("heading", { name: T.sem_sinaisTitulo })).toBeInTheDocument();
    expect(detectarIris).toHaveBeenCalledTimes(4);
    const [corpo] = classificar.mock.calls[0] as [Record<string, unknown>];
    expect(corpo).toMatchObject({ horizontal_delta: 1.5, fotografias_validas: 4, fotografias_total: 4, falha: null });
    // Nunca uma imagem no pedido (CLAUDE.md §4, regra 4).
    expect(JSON.stringify(corpo)).not.toMatch(/base64|imagem|image|data:|bitmap/i);
    expect(screen.getByText("1,5 Δ")).toBeInTheDocument();
    expect(screen.getByText(T.guardado)).toBeInTheDocument();
    expect(desligar).toHaveBeenCalled();
  });

  it("liberta as fotografias da memória depois de medidas", async () => {
    const u = userEvent.setup();
    const tiradas = [bitmap(), bitmap(), bitmap(), bitmap()];
    fotografarSequencia.mockResolvedValue(tiradas);
    montar();
    await tirarFotografias(u);
    await screen.findByRole("heading", { name: T.sem_sinaisTitulo });
    for (const f of tiradas) expect(f.close).toHaveBeenCalled();
  });

  it("sem consentimento para dados de saúde, a câmara nem liga", async () => {
    garantir.mockResolvedValue(false);
    const u = userEvent.setup();
    montar();
    await prepararEIrParaACamera(u);
    await u.click(await esperarBotao(T.permitir));
    expect(ligar).not.toHaveBeenCalled();
    expect(screen.queryByText(T.fotografarTitulo)).not.toBeInTheDocument();
  });

  it("câmara bloqueada: explica e oferece a câmara do telemóvel", async () => {
    estadoDepoisDeLigar = "recusada";
    ligar.mockResolvedValue(false);
    const u = userEvent.setup();
    montar();
    await prepararEIrParaACamera(u);
    await u.click(await esperarBotao(T.permitir));
    expect(await screen.findByText(T.recusadaTitulo)).toBeInTheDocument();
    await u.click(await esperarBotao(T.usarNativa));
    expect(await screen.findByRole("heading", { name: T.nativaTitulo })).toBeInTheDocument();
  });

  it("menos de duas fotografias tiradas: avisa e não envia nada", async () => {
    fotografarSequencia.mockResolvedValue([bitmap()]);
    const u = userEvent.setup();
    montar();
    await tirarFotografias(u);
    expect(await screen.findByText(T.erroFotografar)).toBeInTheDocument();
    expect(classificar).not.toHaveBeenCalled();
  });
});

describe("RastreioCompleto — resultado e falhas", () => {
  it("'não mediu' (sem rosto em nenhuma) diz que não mediu, com a dica certa, e nunca mostra medições", async () => {
    detectarIris.mockResolvedValue(null);
    classificar.mockResolvedValue({ conclusao: "nao_mediu", motivo: "poucas-fotografias-validas", versao_regra: "regra-1", screening_id: null });
    const u = userEvent.setup();
    montar();
    await tirarFotografias(u);
    expect(await screen.findByRole("heading", { name: T.nao_mediuTitulo })).toBeInTheDocument();
    expect(screen.getByText(T.dicaSemRosto)).toBeInTheDocument();
    expect(screen.queryByText(T.sem_sinaisTitulo)).not.toBeInTheDocument();
    expect(screen.queryByText(T.medicoesTitulo)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: T.marcarConsulta })).not.toBeInTheDocument();
  });

  it("encaminhar: oferece marcar consulta", async () => {
    classificar.mockResolvedValue({ conclusao: "encaminhar", motivo: "desvio-horizontal", versao_regra: "regra-1", screening_id: null });
    const u = userEvent.setup();
    montar();
    await tirarFotografias(u);
    expect(await screen.findByRole("heading", { name: T.encaminharTitulo })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: T.marcarConsulta })).toHaveAttribute("href", "/parceiros?agendar=optiotica");
  });

  it("falha do servidor: mostra o erro e 'Tentar de novo' reenvia as mesmas medições, sem medir outra vez", async () => {
    classificar
      .mockRejectedValueOnce(new Error("rede"))
      .mockResolvedValueOnce({ conclusao: "encaminhar", motivo: "desvio-horizontal", versao_regra: "regra-1", screening_id: null });
    const u = userEvent.setup();
    montar();
    await tirarFotografias(u);

    expect(await screen.findByText(T.erroTexto)).toBeInTheDocument();
    // Nunca um resultado antes da resposta da API.
    expect(screen.queryByRole("heading", { name: T.encaminharTitulo })).not.toBeInTheDocument();
    const medicoesAntes = analisarFoto.mock.calls.length;
    await u.click(await esperarBotao(T.tentarDeNovo));

    expect(await screen.findByRole("heading", { name: T.encaminharTitulo })).toBeInTheDocument();
    expect(analisarFoto.mock.calls.length).toBe(medicoesAntes);
    expect(classificar).toHaveBeenCalledTimes(2);
    expect(classificar.mock.calls[1]).toEqual(classificar.mock.calls[0]);
  });

  it("diz quando o resultado não ficou guardado (convidado e conta)", async () => {
    classificar.mockResolvedValue({ conclusao: "sem_sinais", motivo: null, versao_regra: "regra-1", screening_id: null });
    const u = userEvent.setup();
    const { unmount } = montar();
    await tirarFotografias(u);
    expect(await screen.findByText(T.naoGuardadoSemSessao)).toBeInTheDocument();
    unmount();

    sessaoIniciada = true;
    montar();
    await tirarFotografias(u);
    expect(await screen.findByText(T.naoGuardadoConta)).toBeInTheDocument();
  });
});

describe("RastreioCompleto — câmara do telemóvel (caminho B, iPhone)", () => {
  const fotografiaNativa = () => new File([new Uint8Array([1, 2, 3])], "foto.jpg", { type: "image/jpeg" });

  it("pede a câmara nativa e analisa depois de três fotografias, uma de cada vez", async () => {
    caminhoA = false;
    const u = userEvent.setup();
    montar();
    await prepararEIrParaACamera(u);
    expect(await screen.findByRole("heading", { name: T.nativaTitulo })).toBeInTheDocument();
    await u.click(await esperarBotao(T.abrirCamera));
    expect(ligar).not.toHaveBeenCalled(); // não usa a câmara da página
    expect(await screen.findByText("Fotografia 1 de 3")).toBeInTheDocument();

    const entrada = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(entrada.getAttribute("capture")).toBe("environment");
    for (let i = 1; i <= 3; i++) {
      fireEvent.change(entrada, { target: { files: [fotografiaNativa()] } });
      if (i < 3) await screen.findByText(`${i} de 3 fotografias prontas.`);
    }

    expect(await screen.findByRole("heading", { name: T.sem_sinaisTitulo })).toBeInTheDocument();
    expect(detectarIris).toHaveBeenCalledTimes(3);
    expect(classificar).toHaveBeenCalledTimes(1);
  });

  it("uma fotografia ilegível não conta e pede para tentar de novo", async () => {
    caminhoA = false;
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("formato não suportado")));
    const u = userEvent.setup();
    montar();
    await prepararEIrParaACamera(u);
    await u.click(await esperarBotao(T.abrirCamera));
    const entrada = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(entrada, { target: { files: [fotografiaNativa()] } });
    await waitFor(() => expect(screen.getByText(T.erroFotografar)).toBeInTheDocument());
    expect(screen.getByText("0 de 3 fotografias prontas.")).toBeInTheDocument();
  });
});
