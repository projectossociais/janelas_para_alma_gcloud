import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// Bug real nº1: "Carregar Fotografia" nunca chamava a API de rastreio e
// mostrava sempre um diagnóstico de estrabismo tirado de Math.random() — um
// resultado clínico que ninguém calculou. A correcção remove essa opção.
//
// Bug real nº2: o fluxo de câmara persistia as 3 fotografias reais
// permanentemente num bucket do Supabase — violação directa do CLAUDE.md
// secção 4 (nunca guardar fotografias do scanner a longo prazo, são imagens
// faciais de crianças). A correcção passa a persistir só as medições, na API
// própria, nunca a imagem.

const submeterRastreioMultiGaze = vi.fn();
vi.mock("@/services/api/screeningApi", () => ({
  submeterRastreioMultiGaze: (...a: unknown[]) => submeterRastreioMultiGaze(...a),
}));

const registarScreening = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  screeningsApi: { registar: (...a: unknown[]) => registarScreening(...a) },
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const message = (err as { message?: unknown } | null)?.message;
    return typeof message === "string" ? message : fallback;
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u-1", name: "Ana" } }),
}));

vi.mock("@/components/EyeLandmarkOverlay", () => ({ default: () => null }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/BackButton", () => ({ default: () => null }));

import Scanner from "./Scanner";

describe("Scanner — opção de upload removida", () => {
  it("não oferece upload de fotografia única — só a captura guiada por câmara", () => {
    render(
      <MemoryRouter>
        <Scanner />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/Carregar Fotografia/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Escolher ficheiro/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Usar Câmara/i })).toBeInTheDocument();
  });
});

describe("Scanner — persistência do rastreio guiado", () => {
  beforeEach(() => {
    submeterRastreioMultiGaze.mockReset();
    registarScreening.mockReset();

    Object.defineProperty(window, "HTMLCanvasElement", {
      value: window.HTMLCanvasElement,
      writable: true,
    });
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4 * 64) }),
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue("data:image/jpeg;base64,AAAA");

    Object.defineProperty(navigator, "mediaDevices", {
      writable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
    });
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  });

  it("grava só as medições devolvidas pela API — nunca uma imagem", async () => {
    submeterRastreioMultiGaze.mockResolvedValue({
      estado: "concluido",
      posicoes: [
        {
          posicao: "CENTRO",
          estado: "ok",
          rosto_detetado: true,
          qualidade_captura: { pontuacao: 0.9, fiavel: true, motivos: [] },
        },
      ],
      requer_avaliacao_humana: false,
      variacao_desalinhamento: 1.4,
    });
    registarScreening.mockResolvedValue({ id: "screening-1" });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Scanner />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /Usar Câmara/i }));
    const avancar = () => screen.getByRole("button", { name: /Capturar|Iniciar Captura/i });
    await user.click(await screen.findByRole("button", { name: /Iniciar Captura/i }));
    await user.click(avancar());
    await user.click(avancar());
    await user.click(avancar());

    await waitFor(() => expect(registarScreening).toHaveBeenCalled());

    const payload = registarScreening.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("imagem");
    expect(payload).not.toHaveProperty("imagem_base64");
    expect(payload).not.toHaveProperty("imageBase64");
    expect(JSON.stringify(payload)).not.toContain("base64,AAAA");
    expect(payload.estado).toBe("concluido");
    expect(payload.qualidade_captura).toBe(0.9);
    expect(payload.diagnostico).toBe("normal");

    // As 3 poses (frente, direita, esquerda) chegam ao microserviço como
    // Blobs reais, e o resultado guardado para o ecrã é o que ele devolveu.
    const imagens = submeterRastreioMultiGaze.mock.calls[0][0] as Record<string, unknown>;
    for (const pose of ["centro", "direita", "esquerda"]) {
      expect(imagens[pose]).toBeInstanceOf(Blob);
    }
    await waitFor(() => expect(sessionStorage.getItem("scanResult")).not.toBeNull(), { timeout: 4000 });
    const guardado = JSON.parse(sessionStorage.getItem("scanResult")!) as { apiData: Record<string, unknown> };
    expect(guardado.apiData.variacao_desalinhamento).toBe(1.4);
  });

  it("quando requer avaliação humana, grava diagnostico=requer_avaliacao (Fase 1 do matchmaker)", async () => {
    submeterRastreioMultiGaze.mockResolvedValue({
      estado: "concluido",
      posicoes: [
        {
          posicao: "CENTRO",
          estado: "ok",
          rosto_detetado: true,
          qualidade_captura: { pontuacao: 0.9, fiavel: true, motivos: [] },
        },
      ],
      requer_avaliacao_humana: true,
      variacao_desalinhamento: 4.2,
    });
    registarScreening.mockResolvedValue({ id: "screening-2" });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Scanner />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /Usar Câmara/i }));
    const avancar = () => screen.getByRole("button", { name: /Capturar|Iniciar Captura/i });
    await user.click(await screen.findByRole("button", { name: /Iniciar Captura/i }));
    await user.click(avancar());
    await user.click(avancar());
    await user.click(avancar());

    await waitFor(() => expect(registarScreening).toHaveBeenCalled());
    const payload = registarScreening.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.diagnostico).toBe("requer_avaliacao");
  });

  it("mostra a etiqueta 'Triagem Ocular' e nenhuma menção ao Supabase", () => {
    render(
      <MemoryRouter>
        <Scanner />
      </MemoryRouter>,
    );
    expect(screen.getByText("Triagem Ocular")).toBeInTheDocument();
    expect(screen.queryByText(/Scanner de Estrabismo/i)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/supabase/i);
  });
});
