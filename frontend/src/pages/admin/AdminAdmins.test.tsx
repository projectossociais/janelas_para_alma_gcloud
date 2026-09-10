import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const listarUtilizadores = vi.fn();
const promover = vi.fn();
const removerAdmin = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  adminApi: {
    listarUtilizadores: (...a: unknown[]) => listarUtilizadores(...a),
    promover: (...a: unknown[]) => promover(...a),
    removerAdmin: (...a: unknown[]) => removerAdmin(...a),
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
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

import AdminAdmins from "./AdminAdmins";

const umAdmin = {
  id: "u1",
  email: "chefe@example.com",
  nome_completo: "Chefe",
  papel: "admin",
  premium_ativo: false,
  criado_em: "2026-01-01T00:00:00.000Z",
};

describe("AdminAdmins", () => {
  beforeEach(() => {
    listarUtilizadores.mockReset().mockResolvedValue([umAdmin]);
    promover.mockReset();
    removerAdmin.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("promove por email e recarrega a lista", async () => {
    promover.mockResolvedValue({ ...umAdmin, id: "u2", email: "novo@example.com" });
    const user = userEvent.setup();
    render(<AdminAdmins />);

    await user.type(screen.getByPlaceholderText("email@exemplo.com"), "novo@example.com");
    await user.click(screen.getByRole("button", { name: "Adicionar" }));

    await waitFor(() => expect(promover).toHaveBeenCalledWith("novo@example.com"));
    expect(toastSuccess).toHaveBeenCalledWith("Admin adicionado.");
    await waitFor(() => expect(listarUtilizadores).toHaveBeenCalledTimes(2));
  });

  it("nunca mostra sucesso quando a promoção falha (ex.: email desconhecido)", async () => {
    promover.mockRejectedValue(
      Object.assign(new Error("não há nenhuma conta com esse email"), { status: 404 }),
    );
    const user = userEvent.setup();
    render(<AdminAdmins />);

    await user.type(screen.getByPlaceholderText("email@exemplo.com"), "ninguem@example.com");
    await user.click(screen.getByRole("button", { name: "Adicionar" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("não há nenhuma conta com esse email"),
    );
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
