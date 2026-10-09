import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ADMIN-03: substitui o antigo editor de "site_content" (Supabase, sem
// nenhum consumidor público) por uma gestão real de publicações. O que
// importa testar: nunca mostrar sucesso quando a API falha (criar, publicar,
// apagar, upload de fotos), e o fluxo de upload em três passos.

const listarTodas = vi.fn();
const criar = vi.fn();
const publicar = vi.fn();
const despublicar = vi.fn();
const apagar = vi.fn();
const prepararCapa = vi.fn();
const confirmarCapa = vi.fn();
const enviarParaStorage = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  publicacoesApi: {
    listarTodas: (...a: unknown[]) => listarTodas(...a),
    criar: (...a: unknown[]) => criar(...a),
    publicar: (...a: unknown[]) => publicar(...a),
    despublicar: (...a: unknown[]) => despublicar(...a),
    apagar: (...a: unknown[]) => apagar(...a),
    atualizar: vi.fn(),
    prepararCapa: (...a: unknown[]) => prepararCapa(...a),
    confirmarCapa: (...a: unknown[]) => confirmarCapa(...a),
    prepararMidia: vi.fn(),
    confirmarMidia: vi.fn(),
    removerMidia: vi.fn(),
    enviarParaStorage: (...a: unknown[]) => enviarParaStorage(...a),
  },
  TIPOS_DE_MIDIA_ACEITES: ["image/png", "image/jpeg", "image/webp"],
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

import AdminPublicacoes from "./AdminPublicacoes";
import { violacoesAcessibilidade } from "@/design/testes/acessibilidade";

const publicacaoAdmin = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "pub-1",
  slug: "campanha-gamek",
  titulo: "Campanha Gamek",
  resumo: "resumo",
  corpo: "corpo",
  local: null,
  data_evento: null,
  capa_url: null,
  midias: [],
  estado: "rascunho",
  criado_por: "admin-1",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...over,
});

async function preencherECriar(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Título"), "Rastreio em Luanda");
  await user.type(screen.getByLabelText("Resumo (aparece na listagem)"), "resumo curto");
  await user.type(screen.getByLabelText("Texto completo"), "texto completo do evento");
  await user.click(screen.getByRole("button", { name: /Criar rascunho/i }));
}

describe("AdminPublicacoes", () => {
  beforeEach(() => {
    listarTodas.mockReset().mockResolvedValue([]);
    criar.mockReset();
    publicar.mockReset();
    despublicar.mockReset();
    apagar.mockReset();
    prepararCapa.mockReset();
    confirmarCapa.mockReset();
    enviarParaStorage.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("nunca mostra sucesso quando a API falha ao criar", async () => {
    criar.mockRejectedValue(Object.assign(new Error("sem permissões"), { status: 403 }));
    const user = userEvent.setup();
    render(<AdminPublicacoes />);

    await preencherECriar(user);

    await waitFor(() => expect(criar).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
    // O erro fica no formulário, com o que se escreveu intacto.
    expect(await screen.findByRole("alert")).toHaveTextContent("sem permissões");
    expect(screen.getByLabelText("Título")).toHaveValue("Rastreio em Luanda");
  });

  it("só mostra sucesso depois de a API confirmar a criação, e abre o editor", async () => {
    criar.mockResolvedValue(publicacaoAdmin());
    const user = userEvent.setup();
    render(<AdminPublicacoes />);

    await preencherECriar(user);

    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        expect.stringMatching(/criada em rascunho/i),
      ),
    );
    expect(await screen.findByText("Editar publicação")).toBeInTheDocument();
  });

  it("publicar chama a API e recarrega a lista", async () => {
    listarTodas.mockResolvedValue([publicacaoAdmin()]);
    publicar.mockResolvedValue(publicacaoAdmin({ estado: "publicada" }));
    const user = userEvent.setup();
    render(<AdminPublicacoes />);

    await user.click(await screen.findByRole("button", { name: /Publicar/i }));

    await waitFor(() => expect(publicar).toHaveBeenCalledWith("pub-1"));
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/já está visível/i));
  });

  it("nunca mostra sucesso quando publicar falha", async () => {
    listarTodas.mockResolvedValue([publicacaoAdmin()]);
    publicar.mockRejectedValue(Object.assign(new Error("falhou"), { status: 500 }));
    const user = userEvent.setup();
    render(<AdminPublicacoes />);

    await user.click(await screen.findByRole("button", { name: /Publicar/i }));

    await waitFor(() => expect(publicar).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("falhou");
  });

  it("apagar pede confirmação e só chama a API se confirmado", async () => {
    listarTodas.mockResolvedValue([publicacaoAdmin()]);
    const user = userEvent.setup();
    render(<AdminPublicacoes />);

    await user.click(await screen.findByRole("button", { name: /Apagar publicação/i }));
    const dialogo = await screen.findByRole("dialog");
    await user.click(within(dialogo).getByRole("button", { name: "Cancelar" }));

    expect(apagar).not.toHaveBeenCalled();
  });

  it("apagar confirmado chama a API e recarrega", async () => {
    listarTodas.mockResolvedValue([publicacaoAdmin()]);
    apagar.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AdminPublicacoes />);

    await user.click(await screen.findByRole("button", { name: /Apagar publicação/i }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Apagar" }));

    await waitFor(() => expect(apagar).toHaveBeenCalledWith("pub-1"));
    expect(toastSuccess).toHaveBeenCalledWith("Publicação apagada.");
  });

  describe("upload de capa no editor", () => {
    const ficheiro = () => new File([new Uint8Array([1, 2, 3])], "capa.png", { type: "image/png" });

    beforeEach(() => {
      listarTodas.mockResolvedValue([publicacaoAdmin()]);
    });

    it("nunca mostra sucesso se o envio ao storage falhar", async () => {
      prepararCapa.mockResolvedValue({
        url_de_upload: "https://r2.test/publicacoes/pub-1/x.png?sig=1",
        chave: "publicacoes/pub-1/x.png",
        url_publico: "https://cdn.test/publicacoes/pub-1/x.png",
      });
      enviarParaStorage.mockRejectedValue(
        Object.assign(new Error("Não foi possível enviar a imagem para o storage."), { status: 500 }),
      );
      const user = userEvent.setup();
      render(<AdminPublicacoes />);

      await user.click(await screen.findByRole("button", { name: /Editar/i }));
      await user.upload(screen.getByLabelText("Carregar foto de capa"), ficheiro());

      await waitFor(() => expect(enviarParaStorage).toHaveBeenCalled());
      expect(confirmarCapa).not.toHaveBeenCalled();
      expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent(
        "Não foi possível enviar a imagem para o storage.",
      );
    });

    it("confirma e mostra sucesso só depois dos três passos completarem", async () => {
      prepararCapa.mockResolvedValue({
        url_de_upload: "https://r2.test/publicacoes/pub-1/x.png?sig=1",
        chave: "publicacoes/pub-1/x.png",
        url_publico: "https://cdn.test/publicacoes/pub-1/x.png",
      });
      enviarParaStorage.mockResolvedValue(undefined);
      confirmarCapa.mockResolvedValue({ capa_url: "https://cdn.test/publicacoes/pub-1/x.png" });
      const user = userEvent.setup();
      render(<AdminPublicacoes />);

      await user.click(await screen.findByRole("button", { name: /Editar/i }));
      await user.upload(screen.getByLabelText("Carregar foto de capa"), ficheiro());

      await waitFor(() => expect(confirmarCapa).toHaveBeenCalledWith("pub-1", "publicacoes/pub-1/x.png"));
      expect(toastSuccess).toHaveBeenCalledWith("Capa actualizada.");
    });
  });
});

describe("AdminPublicacoes — datas e acessibilidade", () => {
  // Caso real (2026-10-09): "2026-10-08" lido como meia-noite UTC mostrava
  // o dia anterior num computador a oeste de UTC.
  it("a data do evento mostra o dia escrito, sem passar pelo fuso", async () => {
    listarTodas.mockResolvedValue([{ ...publicacaoAdmin(), data_evento: "2026-10-08" }]);
    render(<AdminPublicacoes />);
    expect(await screen.findByText("08/10/2026")).toBeInTheDocument();
  });

  it("sem violações de acessibilidade", async () => {
    listarTodas.mockResolvedValue([publicacaoAdmin()]);
    const { container } = render(<AdminPublicacoes />);
    await screen.findByRole("button", { name: /Apagar publicação/i });
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
