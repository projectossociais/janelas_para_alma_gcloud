import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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
import { violacoesAcessibilidade } from "@/design/testes/acessibilidade";

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

  // Antes: um ícone de lixo sem nome, e o confirm() do navegador.
  it("remover tem nome acessível e pede confirmação; só 'Remover' remove", async () => {
    removerAdmin.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AdminAdmins />);

    const botao = await screen.findByRole("button", { name: `Remover ${umAdmin.email} dos administradores` });
    await user.click(botao);
    const dialogo = await screen.findByRole("dialog", { name: "Remover administrador?" });
    await user.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    expect(removerAdmin).not.toHaveBeenCalled();

    await user.click(botao);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Remover" }));
    await waitFor(() => expect(removerAdmin).toHaveBeenCalledWith(umAdmin.id));
    expect(toastSuccess).toHaveBeenCalledWith("Admin removido.");
  });

  it("se a lista falhar: diz porquê, nunca 'Sem administradores.'", async () => {
    listarUtilizadores.mockReset().mockRejectedValue(Object.assign(new Error("Sem permissões"), { status: 403 }));
    render(<AdminAdmins />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem permissões");
    expect(screen.queryByText("Sem administradores.")).not.toBeInTheDocument();
  });

  it("sem violações de acessibilidade", async () => {
    const { container } = render(<AdminAdmins />);
    await screen.findByText(umAdmin.email);
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
