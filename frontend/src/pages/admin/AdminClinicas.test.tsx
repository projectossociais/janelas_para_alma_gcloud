import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const listarAdmin = vi.fn();
const listarEquipa = vi.fn();
const atualizarPerfil = vi.fn();
const adicionarEquipa = vi.fn();
const removerEquipa = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  clinicasApi: {
    listarAdmin: (...a: unknown[]) => listarAdmin(...a),
    listarEquipa: (...a: unknown[]) => listarEquipa(...a),
    atualizarPerfil: (...a: unknown[]) => atualizarPerfil(...a),
    adicionarEquipa: (...a: unknown[]) => adicionarEquipa(...a),
    removerEquipa: (...a: unknown[]) => removerEquipa(...a),
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

import AdminClinicas from "./AdminClinicas";

const CLINICA = {
  id: "clinica-1",
  nome: "Óptica Optioptika",
  email_contacto: "geral@optioptika.com",
  telefone_contacto: "+244931240304",
  ativa: true,
  especialidades: ["oftalmologia pediátrica"],
  cidade: "Luanda",
  modalidades_suportadas: ["presencial", "online"],
  preco_indicativo: null,
  created_at: "2026-01-01T00:00:00.000Z",
};

const MEMBRO = {
  id: "membro-1",
  utilizador_id: "u-1",
  utilizador_email: "dr.ana@optioptika.com",
  utilizador_nome: "Dr.ª Ana",
  clinica_id: "clinica-1",
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("AdminClinicas", () => {
  beforeEach(() => {
    listarAdmin.mockReset();
    listarEquipa.mockReset();
    atualizarPerfil.mockReset();
    adicionarEquipa.mockReset();
    removerEquipa.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    listarAdmin.mockResolvedValue([CLINICA]);
    listarEquipa.mockResolvedValue([MEMBRO]);
  });

  it("lista a clínica com o perfil e a equipa actuais", async () => {
    render(<AdminClinicas />);

    expect(await screen.findByText("Óptica Optioptika")).toBeInTheDocument();
    expect(screen.getByDisplayValue("oftalmologia pediátrica")).toBeInTheDocument();
    expect(screen.getByText("Dr.ª Ana")).toBeInTheDocument();
  });

  it("guarda o perfil actualizado", async () => {
    atualizarPerfil.mockResolvedValue({ ...CLINICA, cidade: "Benguela" });
    const user = userEvent.setup();
    render(<AdminClinicas />);

    const inputCidade = await screen.findByLabelText(/Cidade/i);
    await user.clear(inputCidade);
    await user.type(inputCidade, "Benguela");
    await user.click(screen.getByRole("button", { name: /Guardar perfil/i }));

    await waitFor(() =>
      expect(atualizarPerfil).toHaveBeenCalledWith(
        "clinica-1",
        expect.objectContaining({ cidade: "Benguela" }),
      ),
    );
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("liga uma conta existente à clínica pelo email", async () => {
    adicionarEquipa.mockResolvedValue({ ...MEMBRO, id: "membro-2" });
    const user = userEvent.setup();
    render(<AdminClinicas />);

    await screen.findByText("Óptica Optioptika");
    await user.type(screen.getByPlaceholderText("email@daclinica.com"), "novo@optioptika.com");
    await user.click(screen.getByRole("button", { name: /Ligar conta/i }));

    await waitFor(() => expect(adicionarEquipa).toHaveBeenCalledWith("clinica-1", "novo@optioptika.com"));
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("uma falha ao ligar a conta nunca mostra sucesso", async () => {
    adicionarEquipa.mockRejectedValue(Object.assign(new Error("não existe nenhuma conta com este email"), { status: 404 }));
    const user = userEvent.setup();
    render(<AdminClinicas />);

    await screen.findByText("Óptica Optioptika");
    await user.type(screen.getByPlaceholderText("email@daclinica.com"), "ninguem@example.com");
    await user.click(screen.getByRole("button", { name: /Ligar conta/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("não existe nenhuma conta com este email"));
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("remove uma ligação existente", async () => {
    removerEquipa.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AdminClinicas />);

    const nomeMembro = await screen.findByText("Dr.ª Ana");
    const linha = nomeMembro.closest("div.flex")!.parentElement!;
    await user.click(within(linha).getByRole("button"));

    await waitFor(() => expect(removerEquipa).toHaveBeenCalledWith("clinica-1", "u-1"));
  });
});
