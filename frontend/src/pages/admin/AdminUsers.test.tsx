import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const listarUtilizadores = vi.fn();
const definirPapel = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  adminApi: {
    listarUtilizadores: (...a: unknown[]) => listarUtilizadores(...a),
    definirPapel: (...a: unknown[]) => definirPapel(...a),
  },
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

import AdminUsers from "./AdminUsers";

const UTILIZADOR_COMUM = {
  id: "user-1",
  email: "ana@example.com",
  nome_completo: "Ana Teste",
  papel: "comum",
  premium_ativo: false,
  criado_em: "2026-01-01T00:00:00.000Z",
};

const UTILIZADOR_ADMIN = {
  id: "admin-1",
  email: "chefe@example.com",
  nome_completo: "Chefe",
  papel: "admin",
  premium_ativo: false,
  criado_em: "2026-01-01T00:00:00.000Z",
};

function renderPage() {
  return render(<AdminUsers />, { wrapper: MemoryRouter });
}

describe("AdminUsers", () => {
  beforeEach(() => {
    listarUtilizadores.mockReset().mockResolvedValue([]);
    definirPapel.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("mostra os utilizadores reais vindos da API própria", async () => {
    listarUtilizadores.mockResolvedValue([UTILIZADOR_COMUM]);
    renderPage();

    expect(await screen.findByText("Ana Teste")).toBeInTheDocument();
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
  });

  it("mostra um erro (e não rebenta) quando a listagem falha", async () => {
    listarUtilizadores.mockRejectedValue(Object.assign(new Error("Sem permissões"), { status: 403 }));
    renderPage();

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Sem permissões"));
    expect(screen.getByText("Sem utilizadores.")).toBeInTheDocument();
  });

  it("muda o papel de um utilizador comum", async () => {
    listarUtilizadores
      .mockResolvedValueOnce([UTILIZADOR_COMUM])
      .mockResolvedValueOnce([{ ...UTILIZADOR_COMUM, papel: "estrabico" }]);
    definirPapel.mockResolvedValue({ ...UTILIZADOR_COMUM, papel: "estrabico" });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Ana Teste");
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Pessoa com Estrabismo" }));

    await waitFor(() => expect(definirPapel).toHaveBeenCalledWith("user-1", "estrabico"));
    expect(toastSuccess).toHaveBeenCalledWith("Perfil actualizado.");
  });

  it("nunca mostra sucesso se mudar o papel falhar", async () => {
    listarUtilizadores.mockResolvedValue([UTILIZADOR_COMUM]);
    definirPapel.mockRejectedValue(Object.assign(new Error("falhou"), { status: 500 }));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Ana Teste");
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Profissional de Saúde" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("falhou"));
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("não mostra selector de papel para quem já é admin -- aponta para Administradores", async () => {
    listarUtilizadores.mockResolvedValue([UTILIZADOR_ADMIN]);
    renderPage();

    await screen.findByText("Chefe");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Administradores" })).toHaveAttribute(
      "href",
      "/admin/administradores"
    );
  });
});
