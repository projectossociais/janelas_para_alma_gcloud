import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ptAO from "@/i18n/locales/pt-AO.json";
import { violacoesAcessibilidade } from "@/design/testes/acessibilidade";

// Bug real nº1: "Carregar Fotografia" nunca chamava a API de rastreio e
// mostrava sempre um diagnóstico de estrabismo tirado de Math.random() — um
// resultado clínico que ninguém calculou. A correcção remove essa opção.
//
// Bug real nº2: o fluxo de câmara persistia as 3 fotografias reais
// permanentemente num bucket do Supabase — violação directa do CLAUDE.md
// secção 4 (nunca guardar fotografias do scanner a longo prazo, são imagens
// faciais de crianças). A correcção passa a persistir só as medições, na API
// própria, nunca a imagem.

const T = ptAO.Rastreio;

const submeterRastreioMultiGaze = vi.fn();
vi.mock("@/services/api/screeningApi", () => ({
  submeterRastreioMultiGaze: (...a: unknown[]) => submeterRastreioMultiGaze(...a),
  textoDoScannerNoIdioma: (t: string | null) => t,
}));

const registarScreening = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  screeningsApi: { registar: (...a: unknown[]) => registarScreening(...a) },
}));

let mockUser: { id: string } | null = { id: "u-1" };
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

// O consentimento para dados de saúde tem testes próprios
// (ConsentimentoSaudeContext.test.tsx); aqui controla-se só a resposta.
const garantir = vi.fn();
vi.mock("@/contexts/ConsentimentoSaudeContext", () => ({
  useConsentimentoSaude: () => ({ garantir: () => garantir() }),
}));

// O detector real (MediaPipe) não corre em jsdom: este diz logo "rosto visível".
vi.mock("@/components/EyeLandmarkOverlay", async () => {
  const { useEffect } = await import("react");
  const DetectorFalso = ({ onLandmarks, active }: { onLandmarks?: (v: boolean) => void; active: boolean }) => {
    useEffect(() => {
      if (active) onLandmarks?.(true);
    }, [active, onLandmarks]);
    return null;
  };
  return { default: DetectorFalso };
});

import Scanner from "./Scanner";

const RESPOSTA = {
  estado: "concluido",
  posicoes: [
    { posicao: "CENTRO", estado: "ok", rosto_detetado: true, qualidade_captura: { pontuacao: 0.9, fiavel: true, motivos: [] } },
  ],
  requer_avaliacao_humana: false,
  motilidade: { variacao_desalinhamento: 1.4, incomitante: false },
};

const getUserMedia = vi.fn();
const pararCamera = vi.fn();

beforeEach(() => {
  submeterRastreioMultiGaze.mockReset();
  registarScreening.mockReset().mockResolvedValue({ id: "screening-1" });
  garantir.mockReset().mockResolvedValue(true);
  pararCamera.mockReset();
  getUserMedia.mockReset().mockResolvedValue({ getTracks: () => [{ stop: pararCamera }] });
  mockUser = { id: "u-1" };
  sessionStorage.clear();

  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  // Um vídeo "com imagem", e uma imagem clara (a luz é medida a sério).
  Object.defineProperty(HTMLMediaElement.prototype, "readyState", { configurable: true, get: () => 4 });
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    drawImage: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray(4 * 64).fill(200) }),
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue("data:image/jpeg;base64,AAAA");
});

const montar = () =>
  render(
    <MemoryRouter initialEntries={["/scanner"]}>
      <Routes>
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/scanner/resultados" element={<p>Página de resultados</p>} />
        <Route path="/" element={<p>Página inicial</p>} />
      </Routes>
    </MemoryRouter>,
  );

const user = () => userEvent.setup();

/**
 * A acção principal existe duas vezes no DOM (barra fixa no telemóvel, fim da
 * coluna no computador; o CSS esconde uma delas, o jsdom não): usa-se a primeira.
 */
const accao = (nome: string) => screen.getAllByRole("button", { name: nome })[0]!;
const esperarAccao = async (nome: string) => (await screen.findAllByRole("button", { name: nome }))[0]!;

async function prepararEPedirCamera(u: ReturnType<typeof user>) {
  for (const r of [T.luz, T.altura, T.oculos]) await u.click(screen.getByText(r));
  await u.click(accao(T.estouPronto));
  await u.click(await esperarAccao(T.permitir));
}

async function tirarAsTres(u: ReturnType<typeof user>) {
  for (const titulo of [T.poseFrenteTitulo, T.poseDireitaTitulo, T.poseEsquerdaTitulo]) {
    await screen.findByRole("heading", { name: titulo });
    const botao = accao(T.tirarFotografia);
    await waitFor(() => expect(botao).toBeEnabled());
    await u.click(botao);
  }
}

describe("Scanner — preparação e câmara", () => {
  it("não oferece upload de fotografia única — só a captura guiada por câmara", () => {
    montar();
    expect(screen.queryByText(/Carregar Fotografia/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Escolher ficheiro/i })).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("diz que é uma triagem e não menciona o Supabase", () => {
    montar();
    expect(screen.getByText(T.triagem)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/supabase|Scanner de Estrabismo/i);
  });

  it("só avança com as três confirmações, e diz o que falta", async () => {
    const u = user();
    montar();
    const pronto = accao(T.estouPronto);
    expect(pronto).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(T.faltaConfirmar);
    for (const r of [T.luz, T.altura, T.oculos]) await u.click(screen.getByText(r));
    expect(pronto).toBeEnabled();
  });

  it("sem consentimento, a câmara nunca é pedida", async () => {
    garantir.mockResolvedValue(false);
    const u = user();
    montar();
    await prepararEPedirCamera(u);
    expect(garantir).toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(await screen.findByRole("heading", { name: T.cameraTitulo })).toBeInTheDocument();
  });

  it("browser sem câmara nesta página (http por IP): diz porquê e não promete 'tentar de novo'", async () => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
    const u = user();
    montar();
    for (const r of [T.luz, T.altura, T.oculos]) await u.click(screen.getByText(r));
    await u.click(accao(T.estouPronto));
    await u.click(await esperarAccao(T.permitir));
    expect(await screen.findByRole("alert")).toHaveTextContent(T.semSuporteTitulo);
    expect(screen.queryByText(T.indisponivelTitulo)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: T.tentarDeNovo })).not.toBeInTheDocument();
  });

  it("câmara recusada: explica como desbloquear e deixa tentar de novo", async () => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error("x"), { name: "NotAllowedError" }));
    const u = user();
    montar();
    await prepararEPedirCamera(u);
    expect(await screen.findByRole("alert")).toHaveTextContent(T.recusadaTitulo);
    await u.click(accao(T.tentarDeNovo));
    expect(await screen.findByRole("heading", { name: T.poseFrenteTitulo })).toBeInTheDocument();
  });
});

describe("Scanner — fotografias e análise", () => {
  it("grava só as medições devolvidas pela API — nunca uma imagem", async () => {
    submeterRastreioMultiGaze.mockResolvedValue(RESPOSTA);
    const u = user();
    montar();
    await prepararEPedirCamera(u);
    await tirarAsTres(u);

    await waitFor(() => expect(registarScreening).toHaveBeenCalled());
    const payload = registarScreening.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("imagem");
    expect(payload).not.toHaveProperty("imagem_base64");
    expect(JSON.stringify(payload)).not.toContain("base64,AAAA");
    expect(payload.estado).toBe("concluido");
    expect(payload.qualidade_captura).toBe(0.9);
    expect(payload.diagnostico).toBe("normal");

    // As 3 poses chegam ao microserviço como Blobs reais.
    const imagens = submeterRastreioMultiGaze.mock.calls[0]![0] as Record<string, unknown>;
    for (const pose of ["centro", "direita", "esquerda"]) expect(imagens[pose]).toBeInstanceOf(Blob);

    // Segue logo para os resultados (sem atraso fingido), com o que a API devolveu.
    expect(await screen.findByText("Página de resultados")).toBeInTheDocument();
    const guardado = JSON.parse(sessionStorage.getItem("scanResult")!) as { apiData: { motilidade: { variacao_desalinhamento: number } } };
    expect(guardado.apiData.motilidade.variacao_desalinhamento).toBe(1.4);
    // A câmara desliga-se depois da última fotografia.
    expect(pararCamera).toHaveBeenCalled();
  });

  it("quando requer avaliação humana, grava diagnostico=requer_avaliacao", async () => {
    submeterRastreioMultiGaze.mockResolvedValue({ ...RESPOSTA, requer_avaliacao_humana: true });
    const u = user();
    montar();
    await prepararEPedirCamera(u);
    await tirarAsTres(u);
    await waitFor(() => expect(registarScreening).toHaveBeenCalled());
    expect((registarScreening.mock.calls[0]![0] as Record<string, unknown>).diagnostico).toBe("requer_avaliacao");
  });

  it("sem sessão não grava nada, mas mostra o resultado", async () => {
    mockUser = null;
    submeterRastreioMultiGaze.mockResolvedValue(RESPOSTA);
    const u = user();
    montar();
    await prepararEPedirCamera(u);
    await tirarAsTres(u);
    expect(await screen.findByText("Página de resultados")).toBeInTheDocument();
    expect(registarScreening).not.toHaveBeenCalled();
  });

  it("se gravar o histórico falhar, o resultado continua a aparecer", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    registarScreening.mockRejectedValue(new Error("rede"));
    submeterRastreioMultiGaze.mockResolvedValue(RESPOSTA);
    const u = user();
    montar();
    await prepararEPedirCamera(u);
    await tirarAsTres(u);
    expect(await screen.findByText("Página de resultados")).toBeInTheDocument();
  });

  it("sem internet, diz que falta a internet", async () => {
    submeterRastreioMultiGaze.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const u = user();
    montar();
    await prepararEPedirCamera(u);
    await tirarAsTres(u);
    expect(await screen.findByRole("alert")).toHaveTextContent(T.erroAnaliseTexto);
    online.mockRestore();
  });

  it("se a análise falhar, não há resultado; tentar de novo reenvia as mesmas fotografias", async () => {
    submeterRastreioMultiGaze.mockRejectedValueOnce(new Error("Failed to fetch")).mockResolvedValueOnce(RESPOSTA);
    const u = user();
    montar();
    await prepararEPedirCamera(u);
    await tirarAsTres(u);

    // Com internet, a culpa não é da ligação: é o serviço que não respondeu
    // (caso real, 2026-10-05: a mensagem mandava verificar a internet).
    expect(await screen.findByRole("alert")).toHaveTextContent(T.erroServicoTexto);
    expect(screen.queryByText("Página de resultados")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("scanResult")).toBeNull();

    await u.click(accao(T.tentarDeNovo));
    expect(await screen.findByText("Página de resultados")).toBeInTheDocument();
    expect(submeterRastreioMultiGaze).toHaveBeenCalledTimes(2);
    expect(getUserMedia).toHaveBeenCalledTimes(1); // sem voltar a fotografar
  });

  it("com imagem escura, não deixa fotografar e diz porquê", async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray(4 * 64).fill(10) }),
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    const u = user();
    montar();
    await prepararEPedirCamera(u);
    expect(await screen.findByText(T.escuro, {}, { timeout: 2000 })).toBeInTheDocument();
    expect(accao(T.tirarFotografia)).toBeDisabled();
  });

  it("sair a meio pede confirmação e desliga a câmara", async () => {
    const u = user();
    montar();
    await prepararEPedirCamera(u);
    await screen.findByRole("heading", { name: T.poseFrenteTitulo });
    await u.click(screen.getByRole("button", { name: T.sair }));
    await u.click(await screen.findByRole("button", { name: T.confirmarSair }));
    expect(await screen.findByText("Página inicial")).toBeInTheDocument();
    expect(pararCamera).toHaveBeenCalled();
  });
});

describe("Scanner — acessibilidade", () => {
  it("sem violações no primeiro passo", async () => {
    const { container } = montar();
    await act(async () => {});
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
