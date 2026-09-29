import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PartilharComMedico from "./PartilharComMedico";
import RelatorioPartilhado from "@/pages/exercises/RelatorioPartilhado";

// Relatório para o médico por link temporário (Fase B, docs/ANALISE_EXERCICIOS.md).

const criarPartilha = vi.fn();
const listarPartilhas = vi.fn();
const revogarPartilha = vi.fn();
const lerPartilhado = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  relatoriosApi: {
    criarPartilha: (...a: unknown[]) => criarPartilha(...a),
    listarPartilhas: (...a: unknown[]) => listarPartilhas(...a),
    revogarPartilha: (...a: unknown[]) => revogarPartilha(...a),
    lerPartilhado: (...a: unknown[]) => lerPartilhado(...a),
  },
  mensagemDeErroApi: (e: unknown, fallback: string) => {
    const m = (e as { status?: number; message?: string } | null) ?? null;
    return m && typeof m.status === "number" && m.message ? m.message : fallback;
  },
}));

const partilha = (id: string, activa = true) => ({
  id,
  criado_em: "2026-09-29T10:00:00Z",
  expira_em: "2026-10-29T10:00:00Z",
  revogado_em: activa ? null : "2026-09-30T10:00:00Z",
  activa,
});

describe("PartilharComMedico", () => {
  beforeEach(() => {
    criarPartilha.mockReset();
    listarPartilhas.mockReset().mockResolvedValue([]);
    revogarPartilha.mockReset();
  });

  it("só mostra o link depois de a API o criar, com o token no caminho certo", async () => {
    let resolver: (v: unknown) => void = () => undefined;
    criarPartilha.mockReturnValue(new Promise((r) => (resolver = r)));
    render(<PartilharComMedico />);

    fireEvent.click(screen.getByRole("button", { name: "Criar link para o médico" }));
    expect(screen.queryByText(/Link criado/)).not.toBeInTheDocument();

    listarPartilhas.mockResolvedValue([partilha("p1")]);
    resolver({ ...partilha("p1"), token: "tok-abc" });
    expect(await screen.findByText(/Link criado/)).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/relatorio-partilhado/tok-abc`)).toBeInTheDocument();
    await screen.findByRole("button", { name: "Revogar" });
  });

  it("com erro da API mostra a mensagem e nunca um link", async () => {
    criarPartilha.mockRejectedValue(Object.assign(new Error("já tem 5 links activos"), { status: 409 }));
    render(<PartilharComMedico />);
    fireEvent.click(screen.getByRole("button", { name: "Criar link para o médico" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("já tem 5 links activos");
    expect(screen.queryByText(/Link criado/)).not.toBeInTheDocument();
  });

  it("lista só os links activos e revoga-os", async () => {
    listarPartilhas.mockResolvedValue([partilha("p1"), partilha("p2", false)]);
    revogarPartilha.mockResolvedValue(undefined);
    render(<PartilharComMedico />);
    const botoes = await screen.findAllByRole("button", { name: "Revogar" });
    expect(botoes).toHaveLength(1);
    fireEvent.click(botoes[0]);
    await waitFor(() => expect(revogarPartilha).toHaveBeenCalledWith("p1"));
    await waitFor(() => expect(screen.getByText("Nenhum link activo.")).toBeInTheDocument());
  });
});

describe("RelatorioPartilhado (o que o médico abre)", () => {
  const abrir = (token: string) =>
    render(
      <MemoryRouter initialEntries={[`/relatorio-partilhado/${token}`]}>
        <Routes>
          <Route path="/relatorio-partilhado/:token" element={<RelatorioPartilhado />} />
        </Routes>
      </MemoryRouter>,
    );

  beforeEach(() => {
    lerPartilhado.mockReset();
  });

  it("mostra o relatório com o primeiro nome e o olho, sem pedir sessão", async () => {
    lerPartilhado.mockResolvedValue({
      nome: "Ana",
      olho_mais_fraco: "esquerdo",
      usa_oculos: true,
      expira_em: "2026-10-29T10:00:00Z",
      gerado_em: "2026-09-29T10:00:00Z",
      sessoes: [
        {
          exercicio_id: "figure8", created_at: "2026-09-29T09:00:00Z", olho: "esquerdo", segundos_activos: 60,
          limiar: 0.3, unidade: "logmar", calibrado: true, sinais: null,
        },
      ],
    });
    abrir("tok-abc");
    expect(await screen.findByText(/Ana · Olho mais fraco: Olho esquerdo/)).toBeInTheDocument();
    expect(lerPartilhado).toHaveBeenCalledWith("tok-abc");
    expect(screen.getByText(/partilhado pela família/)).toBeInTheDocument();
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  });

  it("link inválido, expirado ou revogado: mensagem clara, sem dados", async () => {
    lerPartilhado.mockRejectedValue(Object.assign(new Error("link inválido ou expirado"), { status: 404 }));
    abrir("inventado");
    expect(await screen.findByText("Este link já não é válido")).toBeInTheDocument();
  });
});
