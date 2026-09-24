import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// O diálogo fabricava um "recibo" de marcação inteiramente no browser
// (OPT-${Date.now()...}) e nunca saía dali -- nem a clínica nem a equipa
// ficavam a saber. Corrigido para chamar a API própria; o que importa
// testar é que o "recibo" nunca aparece antes da API confirmar a gravação
// (CLAUDE.md, "nunca mostrar sucesso antes de verificar erro").

const listarClinicas = vi.fn();
const pedir = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  agendamentosApi: {
    listarClinicas: (...a: unknown[]) => listarClinicas(...a),
    pedir: (...a: unknown[]) => pedir(...a),
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

import OptioptikaBookingDialog from "./OptioptikaBookingDialog";

async function preencherFormulario(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText(/Nome completo/i), "Ana Silva");
  await user.type(screen.getByLabelText(/^Email$/i), "ana@example.com");
  await user.type(screen.getByLabelText(/Telefone/i), "+244900000000");
  await user.type(screen.getByLabelText(/Data preferida/i), "2026-10-01");
  await user.click(screen.getByRole("combobox"));
  await user.click(await screen.findByRole("option", { name: /Manhã/i }));
  await user.click(screen.getByRole("button", { name: /Solicitar Consulta/i }));
}

describe("OptioptikaBookingDialog", () => {
  beforeEach(() => {
    listarClinicas.mockReset();
    pedir.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    listarClinicas.mockResolvedValue([{ id: "clinica-1", nome: "Óptica Optioptika" }]);
  });

  it("nunca mostra o recibo antes de a API confirmar a gravação", async () => {
    let resolver: (value: unknown) => void;
    pedir.mockReturnValue(new Promise((r) => { resolver = r; }));
    const user = userEvent.setup();
    render(<OptioptikaBookingDialog open onOpenChange={() => {}} />);

    await preencherFormulario(user);

    expect(screen.queryByText("Pedido de Consulta Confirmado")).not.toBeInTheDocument();

    resolver!({
      id: "11111111-2222-3333-4444-555555555555",
      clinica_id: "clinica-1",
      nome: "Ana Silva",
      email: "ana@example.com",
      telefone: "+244900000000",
      modalidade: "presencial",
      data_preferida: "2026-10-01",
      periodo_preferido: "manha",
      motivo: null,
      estado: "pendente",
      created_at: "2026-01-01T00:00:00.000Z",
    });

    expect(await screen.findByText("Pedido de Consulta Confirmado")).toBeInTheDocument();
    expect(pedir).toHaveBeenCalledWith(
      expect.objectContaining({ clinica_id: "clinica-1", nome: "Ana Silva", modalidade: "presencial" }),
    );
  });

  it("uma falha da API nunca mostra o recibo nem sucesso", async () => {
    pedir.mockRejectedValue(Object.assign(new Error("Serviço indisponível"), { status: 500 }));
    const user = userEvent.setup();
    render(<OptioptikaBookingDialog open onOpenChange={() => {}} />);

    await preencherFormulario(user);

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Serviço indisponível"));
    expect(screen.queryByText("Pedido de Consulta Confirmado")).not.toBeInTheDocument();
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
