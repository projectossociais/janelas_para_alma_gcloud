import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// O que importa aqui é o caminho do erro: criar um banner é um fluxo que
// grava dados, por isso nunca pode mostrar sucesso quando a API falha
// (CLAUDE.md, "Nunca mostrar sucesso antes de verificar error/excepção").

const listar = vi.fn();
const criar = vi.fn();
const atualizar = vi.fn();
const listarHomepage = vi.fn();
const criarHomepage = vi.fn();
const atualizarHomepage = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  bannersApi: {
    listar: (...a: unknown[]) => listar(...a),
    criar: (...a: unknown[]) => criar(...a),
    atualizar: (...a: unknown[]) => atualizar(...a),
    remover: vi.fn(),
  },
  bannerHomepageApi: {
    listar: (...a: unknown[]) => listarHomepage(...a),
    criar: (...a: unknown[]) => criarHomepage(...a),
    atualizar: (...a: unknown[]) => atualizarHomepage(...a),
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
      expect(toastSuccess).toHaveBeenCalledWith("Banner criado. Agora adicione uma foto para poder activá-lo.")
    );
    expect(toastError).not.toHaveBeenCalled();
    expect(criarHomepage).toHaveBeenCalledWith({
      titulo: "Campanha de Natal",
      descricao: null,
      link: null,
    });
  });
});

describe("AdminBanners — editar (não só ativar/desativar/eliminar)", () => {
  const FAIXA_EXISTENTE = {
    id: "banner-1",
    titulo: "Aviso",
    mensagem: "Estamos em manutenção",
    link: null,
    ativo: true,
    created_at: "2026-01-01T00:00:00.000Z",
  };

  const HOMEPAGE_EXISTENTE = {
    id: "bh-1",
    titulo: "Campanha de Natal",
    descricao: "Doações em dobro",
    link: null,
    imagem_url: "https://cdn.test/x.png",
    ativo: true,
    created_at: "2026-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    listar.mockReset().mockResolvedValue([FAIXA_EXISTENTE]);
    atualizar.mockReset();
    listarHomepage.mockReset().mockResolvedValue([HOMEPAGE_EXISTENTE]);
    atualizarHomepage.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("faixa de aviso: abre com os valores actuais e nunca mostra sucesso se a API falhar", async () => {
    atualizar.mockRejectedValue(Object.assign(new Error("sem permissões"), { status: 403 }));
    const user = userEvent.setup();
    render(<AdminBanners />);

    await user.click(await screen.findByRole("button", { name: "Editar Aviso" }));
    const dialogo = within(screen.getByRole("dialog"));
    expect(dialogo.getByLabelText("Título")).toHaveValue("Aviso");
    expect(dialogo.getByLabelText("Mensagem")).toHaveValue("Estamos em manutenção");

    await user.clear(dialogo.getByLabelText("Mensagem"));
    await user.type(dialogo.getByLabelText("Mensagem"), "Voltámos!");
    await user.click(dialogo.getByRole("button", { name: "Guardar alterações" }));

    await waitFor(() => expect(atualizar).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("sem permissões");
  });

  it("faixa de aviso: só mostra sucesso depois de a API confirmar a edição", async () => {
    atualizar.mockResolvedValue({ ...FAIXA_EXISTENTE, mensagem: "Voltámos!" });
    const user = userEvent.setup();
    render(<AdminBanners />);

    await user.click(await screen.findByRole("button", { name: "Editar Aviso" }));
    const dialogo = within(screen.getByRole("dialog"));
    await user.clear(dialogo.getByLabelText("Mensagem"));
    await user.type(dialogo.getByLabelText("Mensagem"), "Voltámos!");
    await user.click(dialogo.getByRole("button", { name: "Guardar alterações" }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Banner actualizado."));
    expect(toastError).not.toHaveBeenCalled();
    expect(atualizar).toHaveBeenCalledWith("banner-1", {
      titulo: "Aviso",
      mensagem: "Voltámos!",
      link: null,
    });
  });

  it("banner da homepage: abre com os valores actuais e nunca mostra sucesso se a API falhar", async () => {
    atualizarHomepage.mockRejectedValue(Object.assign(new Error("sem permissões"), { status: 403 }));
    const user = userEvent.setup();
    render(<AdminBanners />);

    await user.click(screen.getByRole("tab", { name: "Banner da homepage" }));
    await user.click(await screen.findByRole("button", { name: "Editar Campanha de Natal" }));
    const dialogo = within(screen.getByRole("dialog"));
    expect(dialogo.getByLabelText("Título")).toHaveValue("Campanha de Natal");
    expect(dialogo.getByLabelText("Descrição (opcional)")).toHaveValue("Doações em dobro");

    await user.click(dialogo.getByRole("button", { name: "Guardar alterações" }));

    await waitFor(() => expect(atualizarHomepage).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("sem permissões");
  });

  it("banner da homepage: só mostra sucesso depois de a API confirmar a edição", async () => {
    atualizarHomepage.mockResolvedValue({ ...HOMEPAGE_EXISTENTE, titulo: "Campanha de Ano Novo" });
    const user = userEvent.setup();
    render(<AdminBanners />);

    await user.click(screen.getByRole("tab", { name: "Banner da homepage" }));
    await user.click(await screen.findByRole("button", { name: "Editar Campanha de Natal" }));
    const dialogo = within(screen.getByRole("dialog"));
    await user.clear(dialogo.getByLabelText("Título"));
    await user.type(dialogo.getByLabelText("Título"), "Campanha de Ano Novo");
    await user.click(dialogo.getByRole("button", { name: "Guardar alterações" }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Banner actualizado."));
    expect(toastError).not.toHaveBeenCalled();
    expect(atualizarHomepage).toHaveBeenCalledWith("bh-1", {
      titulo: "Campanha de Ano Novo",
      descricao: "Doações em dobro",
      link: null,
    });
  });
});
