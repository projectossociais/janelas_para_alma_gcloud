import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import ptAO from "@/i18n/locales/pt-AO.json";
import { violacoesAcessibilidade } from "@/design/testes/acessibilidade";

const T = ptAO.RastreioCompleto;
const R = ptAO.Rastreio;

// Tudo o que é de hardware ou de rede é simulado; a lógica do ecrã, a medição
// da sessão (`medirFotografias`) e o resultado guardado são os verdadeiros.
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
  sessionStorage.clear();
  vi.stubGlobal("createImageBitmap", vi.fn(async () => bitmap()));
});

const Resultados = () => <p>Página de resultados{useLocation().search}</p>;

const montar = () =>
  render(
    <MemoryRouter initialEntries={["/rastreio-completo"]}>
      <Routes>
        <Route path="/rastreio-completo" element={<RastreioCompleto />} />
        <Route path="/scanner/resultados" element={<Resultados />} />
        <Route path="/" element={<p>Página inicial</p>} />
      </Routes>
    </MemoryRouter>,
  );

/** A acção principal existe duas vezes no DOM (telemóvel e computador): usa-se a primeira. */
const accao = (nome: string) => screen.getAllByRole("button", { name: nome })[0]!;
const esperarAccao = async (nome: string) => (await screen.findAllByRole("button", { name: nome }))[0]!;

async function prepararEIrParaACamera(u: ReturnType<typeof userEvent.setup>) {
  for (const r of [T.pessoa, T.oculos, T.luz, T.alvo]) await u.click(screen.getByText(r));
  await u.click(accao(R.estouPronto));
}

describe("RastreioCompleto — preparação", () => {
  it("só avança com as quatro confirmações, e diz o que falta", async () => {
    const u = userEvent.setup();
    montar();
    expect(accao(R.estouPronto)).toBeDisabled();
    expect(screen.getByText(T.faltaConfirmar)).toBeInTheDocument();
    for (const r of [T.pessoa, T.oculos, T.luz]) await u.click(screen.getByText(r));
    expect(accao(R.estouPronto)).toBeDisabled();
    await u.click(screen.getByText(T.alvo));
    expect(accao(R.estouPronto)).toBeEnabled();
  });

  it("avisa que é uma versão de teste", () => {
    montar();
    expect(screen.getByText(T.testeTitulo)).toBeInTheDocument();
  });

  it("sem violações de acessibilidade no primeiro passo", async () => {
    const { container } = montar();
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});

describe("RastreioCompleto — câmara na página (caminho A)", () => {
  it("fluxo completo: mede no telemóvel, envia só números e mostra o resultado", async () => {
    const u = userEvent.setup();
    montar();
    await prepararEIrParaACamera(u);
    await u.click(await esperarAccao(T.permitir));
    await u.click(await esperarAccao(T.tirarFotografias));

    expect(await screen.findByText(/Página de resultados/)).toBeInTheDocument();
    expect(detectarIris).toHaveBeenCalledTimes(4);
    const [corpo] = classificar.mock.calls[0] as [Record<string, unknown>];
    expect(corpo).toMatchObject({ horizontal_delta: 1.5, fotografias_validas: 4, fotografias_total: 4, falha: null });
    // Nunca uma imagem no pedido (CLAUDE.md §4, regra 4).
    expect(JSON.stringify(corpo)).not.toMatch(/base64|imagem|image|data:|bitmap/i);
    const guardado = JSON.parse(sessionStorage.getItem("scanResult")!);
    expect(guardado.conclusao).toBe("normal");
    expect(guardado.motor.horizontalDelta).toBe(1.5);
    expect(desligar).toHaveBeenCalled();
  });

  it("liberta as fotografias da memória depois de medidas", async () => {
    const u = userEvent.setup();
    const tiradas = [bitmap(), bitmap(), bitmap(), bitmap()];
    fotografarSequencia.mockResolvedValue(tiradas);
    montar();
    await prepararEIrParaACamera(u);
    await u.click(await esperarAccao(T.permitir));
    await u.click(await esperarAccao(T.tirarFotografias));
    await screen.findByText(/Página de resultados/);
    for (const f of tiradas) expect(f.close).toHaveBeenCalled();
  });

  it("sem consentimento para dados de saúde, a câmara nem liga", async () => {
    garantir.mockResolvedValue(false);
    const u = userEvent.setup();
    montar();
    await prepararEIrParaACamera(u);
    await u.click(await esperarAccao(T.permitir));
    expect(ligar).not.toHaveBeenCalled();
    expect(screen.queryByText(T.fotografarTitulo)).not.toBeInTheDocument();
  });

  it("câmara bloqueada: explica e oferece a câmara do telemóvel", async () => {
    estadoDepoisDeLigar = "recusada";
    ligar.mockResolvedValue(false);
    const u = userEvent.setup();
    montar();
    await prepararEIrParaACamera(u);
    await u.click(await esperarAccao(T.permitir));
    expect(await screen.findByText(R.recusadaTitulo)).toBeInTheDocument();
    await u.click(await esperarAccao(T.usarNativa));
    expect(await screen.findByRole("heading", { name: T.nativaTitulo })).toBeInTheDocument();
  });

  it("menos de duas fotografias tiradas: avisa e não envia nada", async () => {
    fotografarSequencia.mockResolvedValue([bitmap()]);
    const u = userEvent.setup();
    montar();
    await prepararEIrParaACamera(u);
    await u.click(await esperarAccao(T.permitir));
    await u.click(await esperarAccao(T.tirarFotografias));
    expect(await screen.findByText(T.erroFotografar)).toBeInTheDocument();
    expect(classificar).not.toHaveBeenCalled();
  });
});

describe("RastreioCompleto — resultado e falhas", () => {
  it("'não mediu' (sem rosto em nenhuma) fica inconclusivo, com a dica certa, e nunca normal", async () => {
    detectarIris.mockResolvedValue(null);
    classificar.mockResolvedValue({ conclusao: "nao_mediu", motivo: "poucas-fotografias-validas", versao_regra: "regra-1", screening_id: null });
    const u = userEvent.setup();
    montar();
    await prepararEIrParaACamera(u);
    await u.click(await esperarAccao(T.permitir));
    await u.click(await esperarAccao(T.tirarFotografias));
    await screen.findByText(/Página de resultados/);
    const guardado = JSON.parse(sessionStorage.getItem("scanResult")!);
    expect(guardado.conclusao).toBe("inconclusivo");
    expect(guardado.motor.dica).toBe("semRosto");
    expect(guardado.diagnosis).not.toBe("Alinhamento Fisiológico Normal");
  });

  it("falha do servidor: mostra o erro e 'Tentar de novo' reenvia as mesmas medições, sem medir outra vez", async () => {
    classificar
      .mockRejectedValueOnce(new Error("rede"))
      .mockResolvedValueOnce({ conclusao: "encaminhar", motivo: "desvio-horizontal", versao_regra: "regra-1", screening_id: null });
    const u = userEvent.setup();
    montar();
    await prepararEIrParaACamera(u);
    await u.click(await esperarAccao(T.permitir));
    await u.click(await esperarAccao(T.tirarFotografias));

    expect(await screen.findByText(T.erroTexto)).toBeInTheDocument();
    expect(sessionStorage.getItem("scanResult")).toBeNull(); // nunca resultado antes da resposta
    const medicoesAntes = analisarFoto.mock.calls.length;
    await u.click(await esperarAccao(R.tentarDeNovo));

    expect(await screen.findByText(/Página de resultados/)).toBeInTheDocument();
    expect(analisarFoto.mock.calls.length).toBe(medicoesAntes);
    expect(classificar).toHaveBeenCalledTimes(2);
    expect(classificar.mock.calls[1]).toEqual(classificar.mock.calls[0]);
    expect(JSON.parse(sessionStorage.getItem("scanResult")!).conclusao).toBe("avaliacao");
  });

  it("com o rastreio gravado, o resultado fica ligado a ele (para marcar consulta)", async () => {
    const u = userEvent.setup();
    montar();
    await prepararEIrParaACamera(u);
    await u.click(await esperarAccao(T.permitir));
    await u.click(await esperarAccao(T.tirarFotografias));
    expect(await screen.findByText("Página de resultados?id=s-1")).toBeInTheDocument();
  });

  it("convidado (sem rastreio gravado): resultado sem id", async () => {
    classificar.mockResolvedValue({ conclusao: "sem_sinais", motivo: null, versao_regra: "regra-1", screening_id: null });
    const u = userEvent.setup();
    montar();
    await prepararEIrParaACamera(u);
    await u.click(await esperarAccao(T.permitir));
    await u.click(await esperarAccao(T.tirarFotografias));
    expect(await screen.findByText("Página de resultados")).toBeInTheDocument();
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
    await u.click(await esperarAccao(T.abrirCamera));
    expect(ligar).not.toHaveBeenCalled(); // não usa a câmara da página
    expect(await screen.findByText("Fotografia 1 de 3")).toBeInTheDocument();

    const entrada = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(entrada.getAttribute("capture")).toBe("environment");
    for (let i = 1; i <= 3; i++) {
      fireEvent.change(entrada, { target: { files: [fotografiaNativa()] } });
      if (i < 3) await screen.findByText(`${i} de 3 fotografias prontas.`);
    }

    expect(await screen.findByText(/Página de resultados/)).toBeInTheDocument();
    expect(detectarIris).toHaveBeenCalledTimes(3);
    expect(classificar).toHaveBeenCalledTimes(1);
  });

  it("uma fotografia ilegível não conta e pede para tentar de novo", async () => {
    caminhoA = false;
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("formato não suportado")));
    const u = userEvent.setup();
    montar();
    await prepararEIrParaACamera(u);
    await u.click(await esperarAccao(T.abrirCamera));
    const entrada = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(entrada, { target: { files: [fotografiaNativa()] } });
    await waitFor(() => expect(screen.getByText(T.erroFotografar)).toBeInTheDocument());
    expect(screen.getByText("0 de 3 fotografias prontas.")).toBeInTheDocument();
  });
});
