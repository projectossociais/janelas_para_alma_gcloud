import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const listarAdmin = vi.fn();
const listarEquipa = vi.fn();
const atualizarPerfil = vi.fn();
const adicionarEquipa = vi.fn();
const removerEquipa = vi.fn();
const criar = vi.fn();
const remover = vi.fn();
const reativar = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  clinicasApi: {
    listarAdmin: (...a: unknown[]) => listarAdmin(...a),
    listarEquipa: (...a: unknown[]) => listarEquipa(...a),
    atualizarPerfil: (...a: unknown[]) => atualizarPerfil(...a),
    adicionarEquipa: (...a: unknown[]) => adicionarEquipa(...a),
    removerEquipa: (...a: unknown[]) => removerEquipa(...a),
    criar: (...a: unknown[]) => criar(...a),
    remover: (...a: unknown[]) => remover(...a),
    reativar: (...a: unknown[]) => reativar(...a),
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
    criar.mockReset();
    remover.mockReset();
    reativar.mockReset();
    vi.spyOn(window, "confirm").mockReturnValue(true);
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

    const inputCidade = await screen.findByLabelText(/Cidade/i, { selector: "#cidade-clinica-1" });
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

  it("adiciona uma clínica nova", async () => {
    criar.mockResolvedValue({ ...CLINICA, id: "clinica-2", nome: "Clínica Visão Huíla" });
    const user = userEvent.setup();
    render(<AdminClinicas />);

    await screen.findByText("Óptica Optioptika");
    await user.type(screen.getByLabelText("Nome"), "Clínica Visão Huíla");
    await user.type(screen.getByLabelText("Email de contacto"), "geral@visaohuila.ao");
    await user.type(screen.getByLabelText("Telefone de contacto"), "+244923000000");
    await user.click(screen.getByRole("button", { name: /Adicionar clínica/i }));

    await waitFor(() =>
      expect(criar).toHaveBeenCalledWith(
        expect.objectContaining({
          nome: "Clínica Visão Huíla",
          email_contacto: "geral@visaohuila.ao",
          telefone_contacto: "+244923000000",
        }),
      ),
    );
    expect(toastSuccess).toHaveBeenCalledWith("Clínica adicionada.");
  });

  it("nunca mostra sucesso se criar a clínica falhar", async () => {
    criar.mockRejectedValue(Object.assign(new Error("email inválido"), { status: 422 }));
    const user = userEvent.setup();
    render(<AdminClinicas />);

    await screen.findByText("Óptica Optioptika");
    await user.type(screen.getByLabelText("Nome"), "Clínica X");
    await user.type(screen.getByLabelText("Email de contacto"), "x@x.ao");
    await user.type(screen.getByLabelText("Telefone de contacto"), "+244900000000");
    await user.click(screen.getByRole("button", { name: /Adicionar clínica/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("email inválido"));
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("remove uma clínica sem pedidos de consulta", async () => {
    remover.mockResolvedValue({ resultado: "apagada" });
    const user = userEvent.setup();
    render(<AdminClinicas />);

    await user.click(await screen.findByRole("button", { name: "Remover a clínica Óptica Optioptika" }));

    await waitFor(() => expect(remover).toHaveBeenCalledWith("clinica-1"));
    expect(toastSuccess).toHaveBeenCalledWith("Clínica removida.");
  });

  it("avisa quando a clínica fica só desactivada", async () => {
    remover.mockResolvedValue({ resultado: "desativada" });
    const user = userEvent.setup();
    render(<AdminClinicas />);

    await user.click(await screen.findByRole("button", { name: "Remover a clínica Óptica Optioptika" }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/desactivada/)));
  });

  it("não remove nada se o admin cancelar a confirmação", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    render(<AdminClinicas />);

    await user.click(await screen.findByRole("button", { name: "Remover a clínica Óptica Optioptika" }));

    expect(remover).not.toHaveBeenCalled();
  });

  it("reactiva uma clínica inactiva", async () => {
    listarAdmin.mockResolvedValue([{ ...CLINICA, ativa: false }]);
    reativar.mockResolvedValue({ ...CLINICA, ativa: true });
    const user = userEvent.setup();
    render(<AdminClinicas />);

    await user.click(await screen.findByRole("button", { name: /Reactivar/i }));

    await waitFor(() => expect(reativar).toHaveBeenCalledWith("clinica-1"));
  });
});
