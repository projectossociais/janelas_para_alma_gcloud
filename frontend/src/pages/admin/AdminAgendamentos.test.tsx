import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const listarAgendamentos = vi.fn();
const confirmar = vi.fn();
const recusar = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  agendamentosApi: {
    listarAgendamentos: (...a: unknown[]) => listarAgendamentos(...a),
    confirmar: (...a: unknown[]) => confirmar(...a),
    recusar: (...a: unknown[]) => recusar(...a),
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

import AdminAgendamentos from "./AdminAgendamentos";

const PEDIDO_PENDENTE = {
  id: "ag-1",
  clinica_id: "clinica-1",
  utilizador_id: null,
  screening_id: null,
  nome: "Ana Silva",
  email: "ana@example.com",
  telefone: "+244900000000",
  modalidade: "presencial",
  data_preferida: null,
  periodo_preferido: null,
  horario_inicio: "2027-01-04T09:00:00.000Z",
  motivo: "Visão turva",
  estado: "pendente",
  decidido_por: null,
  decidido_em: null,
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("AdminAgendamentos", () => {
  beforeEach(() => {
    listarAgendamentos.mockReset();
    confirmar.mockReset();
    recusar.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("lista pedidos pendentes com os dados de contacto", async () => {
    listarAgendamentos.mockResolvedValue([PEDIDO_PENDENTE]);
    render(<AdminAgendamentos />);

    expect(await screen.findByText("Ana Silva")).toBeInTheDocument();
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    expect(screen.getByText("Visão turva")).toBeInTheDocument();
  });

  it("mostra mensagem quando não há pedidos pendentes", async () => {
    listarAgendamentos.mockResolvedValue([]);
    render(<AdminAgendamentos />);

    expect(await screen.findByText("Sem pedidos pendentes.")).toBeInTheDocument();
  });

  it("confirma um pedido e recarrega a lista", async () => {
    listarAgendamentos.mockResolvedValueOnce([PEDIDO_PENDENTE]).mockResolvedValueOnce([
      { ...PEDIDO_PENDENTE, estado: "confirmada" },
    ]);
    confirmar.mockResolvedValue({ ...PEDIDO_PENDENTE, estado: "confirmada" });
    const user = userEvent.setup();
    render(<AdminAgendamentos />);

    await user.click(await screen.findByRole("button", { name: /Confirmar/i }));

    await waitFor(() => expect(confirmar).toHaveBeenCalledWith("ag-1"));
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/confirmada/i));
  });

  it("recusa um pedido", async () => {
    listarAgendamentos.mockResolvedValue([PEDIDO_PENDENTE]);
    recusar.mockResolvedValue({ ...PEDIDO_PENDENTE, estado: "recusada" });
    const user = userEvent.setup();
    render(<AdminAgendamentos />);

    await user.click(await screen.findByRole("button", { name: /Recusar/i }));

    await waitFor(() => expect(recusar).toHaveBeenCalledWith("ag-1"));
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/recusado/i));
  });

  it("uma falha ao decidir nunca mostra sucesso", async () => {
    listarAgendamentos.mockResolvedValue([PEDIDO_PENDENTE]);
    confirmar.mockRejectedValue(Object.assign(new Error("falha"), { status: 409 }));
    const user = userEvent.setup();
    render(<AdminAgendamentos />);

    await user.click(await screen.findByRole("button", { name: /Confirmar/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("falha"));
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
