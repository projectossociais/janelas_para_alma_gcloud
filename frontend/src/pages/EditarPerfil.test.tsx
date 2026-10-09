import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// O que importa testar aqui é o upload de avatar em três passos (assinar →
// enviar ao storage → confirmar): nunca mostrar "sucesso" se qualquer
// passo falhar (CLAUDE.md, "Nunca mostrar sucesso antes de verificar
// error/excepção").

const prepararAvatar = vi.fn();
const enviarParaStorage = vi.fn();
const confirmarAvatar = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  perfilApi: { atualizar: vi.fn() },
  uploadsApi: {
    prepararAvatar: (...a: unknown[]) => prepararAvatar(...a),
    enviarParaStorage: (...a: unknown[]) => enviarParaStorage(...a),
    confirmarAvatar: (...a: unknown[]) => confirmarAvatar(...a),
  },
  TIPOS_DE_AVATAR_ACEITES: ["image/png", "image/jpeg", "image/webp"],
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));

vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

const mockProfile = {
  id: "user-1",
  nome_completo: "Ana Teste",
  email: "ana@example.com",
  biografia: null,
  data_nascimento: null,
  genero: null,
  telefone: null,
  provincia: null,
  avatar_url: null,
  papel: "comum",
  notificacoes_projetos: false,
  notificacoes_lembretes: false,
  notificacoes_comunidade: false,
  created_at: "2026-01-01T00:00:00.000Z",
};

const setProfile = vi.fn();
vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: mockProfile, loading: false, setProfile }),
}));

const updateUserProfile = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoggedIn: true, user: { id: "user-1" }, updateUserProfile }),
  PROVINCES: ["Luanda", "Benguela"],
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
    info: vi.fn(),
  },
}));

import EditarPerfil from "./EditarPerfil";

const ficheiro = () => new File([new Uint8Array([1, 2, 3])], "foto.png", { type: "image/png" });

function inputDeFicheiro(): HTMLInputElement {
  return screen.getByLabelText("Carregar foto de perfil") as HTMLInputElement;
}

describe("EditarPerfil — foto de perfil", () => {
  beforeEach(() => {
    prepararAvatar.mockReset();
    enviarParaStorage.mockReset();
    confirmarAvatar.mockReset();
    setProfile.mockReset();
    updateUserProfile.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("nunca mostra sucesso se o envio para o storage falhar", async () => {
    prepararAvatar.mockResolvedValue({
      url_de_upload: "https://r2.test/avatares/user-1/x.png?sig=1",
      chave: "avatares/user-1/x.png",
      url_publico: "https://cdn.test/avatares/user-1/x.png",
    });
    enviarParaStorage.mockRejectedValue(
      Object.assign(new Error("Não foi possível enviar a imagem para o storage."), { status: 500 }),
    );

    const user = userEvent.setup();
    render(<EditarPerfil />, { wrapper: MemoryRouter });
    await user.upload(inputDeFicheiro(), ficheiro());

    await waitFor(() => expect(enviarParaStorage).toHaveBeenCalled());
    expect(confirmarAvatar).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(setProfile).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Não foi possível enviar a imagem para o storage.");
  });

  it("nunca mostra sucesso se a confirmação na API falhar", async () => {
    prepararAvatar.mockResolvedValue({
      url_de_upload: "https://r2.test/avatares/user-1/x.png?sig=1",
      chave: "avatares/user-1/x.png",
      url_publico: "https://cdn.test/avatares/user-1/x.png",
    });
    enviarParaStorage.mockResolvedValue(undefined);
    confirmarAvatar.mockRejectedValue(
      Object.assign(new Error("essa chave não pertence a este utilizador"), { status: 403 }),
    );

    const user = userEvent.setup();
    render(<EditarPerfil />, { wrapper: MemoryRouter });
    await user.upload(inputDeFicheiro(), ficheiro());

    await waitFor(() => expect(confirmarAvatar).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(setProfile).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("essa chave não pertence a este utilizador");
  });

  it("só grava e mostra sucesso depois de os três passos correrem", async () => {
    prepararAvatar.mockResolvedValue({
      url_de_upload: "https://r2.test/avatares/user-1/x.png?sig=1",
      chave: "avatares/user-1/x.png",
      url_publico: "https://cdn.test/avatares/user-1/x.png",
    });
    enviarParaStorage.mockResolvedValue(undefined);
    confirmarAvatar.mockResolvedValue({ avatar_url: "https://cdn.test/avatares/user-1/x.png" });

    const user = userEvent.setup();
    render(<EditarPerfil />, { wrapper: MemoryRouter });
    await user.upload(inputDeFicheiro(), ficheiro());

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Foto de perfil actualizada!"));
    expect(confirmarAvatar).toHaveBeenCalledWith("avatares/user-1/x.png");
    expect(setProfile).toHaveBeenCalledWith(
      expect.objectContaining({ avatar_url: "https://cdn.test/avatares/user-1/x.png" }),
    );
    expect(updateUserProfile).toHaveBeenCalledWith({
      avatarUrl: "https://cdn.test/avatares/user-1/x.png",
    });
    expect(toastError).not.toHaveBeenCalled();
  });
});
