import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// O que importa aqui é o caminho do erro: criar um banner é um fluxo que
// grava dados, por isso nunca pode mostrar sucesso quando a API falha
// (CLAUDE.md, "Nunca mostrar sucesso antes de verificar error/excepção").

const listar = vi.fn();
const criar = vi.fn();
const listarHomepage = vi.fn();
const criarHomepage = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  bannersApi: {
    listar: (...a: unknown[]) => listar(...a),
    criar: (...a: unknown[]) => criar(...a),
    atualizar: vi.fn(),
    remover: vi.fn(),
  },
  bannerHomepageApi: {
    listar: (...a: unknown[]) => listarHomepage(...a),
    criar: (...a: unknown[]) => criarHomepage(...a),
    atualizar: vi.fn(),
    remover: vi.fn(),
    prepararImagem: vi.fn(),
    confirmarImagem: vi.fn(),
    enviarParaStorage: vi.fn(),
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

import AdminBanners from "./AdminBanners";

async function preencherECriar(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Título"), "Campanha");
  await user.type(screen.getByLabelText("Mensagem"), "Doe já");
  await user.click(screen.getByRole("button", { name: /Criar banner/i }));
}

describe("AdminBanners", () => {
  beforeEach(() => {
    listar.mockReset().mockResolvedValue([]);
    criar.mockReset();
    listarHomepage.mockReset().mockResolvedValue([]);
    criarHomepage.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("nunca mostra sucesso quando a API falha ao criar o banner", async () => {
    criar.mockRejectedValue(Object.assign(new Error("sem permissões"), { status: 403 }));
    const user = userEvent.setup();
    render(<AdminBanners />);

    await preencherECriar(user);

    await waitFor(() => expect(criar).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("sem permissões");
  });

  it("só mostra sucesso depois de a API confirmar a criação", async () => {
    criar.mockResolvedValue({
      id: "banner-1",
      titulo: "Campanha",
      mensagem: "Doe já",
      link: null,
      ativo: true,
      created_at: "2026-01-01T00:00:00.000Z",
    });
    const user = userEvent.setup();
    render(<AdminBanners />);

    await preencherECriar(user);

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Banner criado."));
    expect(toastError).not.toHaveBeenCalled();
    expect(criar).toHaveBeenCalledWith({
      titulo: "Campanha",
      mensagem: "Doe já",
      link: null,
      ativo: true,
    });
  });
});

describe("AdminBanners — separador Banner da homepage", () => {
  beforeEach(() => {
    listar.mockReset().mockResolvedValue([]);
    listarHomepage.mockReset().mockResolvedValue([]);
    criarHomepage.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  async function irParaSeparadorHomepageECriar(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("tab", { name: "Banner da homepage" }));
    await user.type(screen.getByLabelText("Título"), "Campanha de Natal");
    await user.click(screen.getByRole("button", { name: /Criar banner/i }));
  }

  it("nunca mostra sucesso quando a API falha ao criar o banner da homepage", async () => {
    criarHomepage.mockRejectedValue(Object.assign(new Error("sem permissões"), { status: 403 }));
    const user = userEvent.setup();
    render(<AdminBanners />);

    await irParaSeparadorHomepageECriar(user);

    await waitFor(() => expect(criarHomepage).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("sem permissões");
  });

  it("só mostra sucesso depois de a API confirmar a criação, e nasce sem imagem", async () => {
    criarHomepage.mockResolvedValue({
      id: "bh-1",
      titulo: "Campanha de Natal",
      descricao: null,
      link: null,
      imagem_url: null,
      ativo: false,
      created_at: "2026-01-01T00:00:00.000Z",
    });
    const user = userEvent.setup();
    render(<AdminBanners />);

    await irParaSeparadorHomepageECriar(user);

    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Banner criado — agora adicione uma foto para poder ativá-lo.")
    );
    expect(toastError).not.toHaveBeenCalled();
    expect(criarHomepage).toHaveBeenCalledWith({
      titulo: "Campanha de Natal",
      descricao: null,
      link: null,
    });
  });
});
