import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const listar = vi.fn();
const aprovar = vi.fn();
const revogar = vi.fn();
const toastErro = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  pagamentosApi: {
    listar: (...a: unknown[]) => listar(...a),
    aprovar: (...a: unknown[]) => aprovar(...a),
    revogar: (...a: unknown[]) => revogar(...a),
    rejeitar: vi.fn(),
    obter: vi.fn(),
    urlDoFicheiro: vi.fn(),
  },
  mensagemDeErroApi: (_err: unknown, fallback: string) => fallback,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: (...a: unknown[]) => toastErro(...a) } }));

import AdminComprovativos from "./AdminComprovativos";

const base = {
  utilizador_id: "u-1",
  utilizador_email: "ana@example.com",
  utilizador_nome: "Ana",
  referencia_transacao: "202610140001234",
  montante_kz: "15000.00",
  origem: "bai_directo",
  destinatario_detectado: "AO06...",
  data_transacao: "2026-10-14T08:25:00Z",
  motivo_codigo: null,
  motivo: null,
  premium_expira_em: null,
  decidido_por: null,
  decidido_em: null,
  criado_em: "2026-10-14T08:30:00Z",
};

describe("AdminComprovativos", () => {
  beforeEach(() => {
    listar.mockReset();
    aprovar.mockReset();
    revogar.mockReset();
    toastErro.mockReset();
  });

  it("abre nos que estão por confirmar e confirma o pagamento", async () => {
    listar.mockResolvedValue([{ ...base, id: "c-1", estado: "revisao_manual", motivo: "não foi possível ler o número da operação" }]);
    aprovar.mockResolvedValue({});
    const user = userEvent.setup();
    render(<AdminComprovativos />);

    expect(await screen.findByText(/não foi possível ler o número da operação/)).toBeInTheDocument();
    expect(listar).toHaveBeenCalledWith("revisao_manual");
    await user.click(screen.getByRole("button", { name: /Confirmar pagamento/i }));
    await waitFor(() => expect(aprovar).toHaveBeenCalledWith("c-1"));
  });

  it("marca os aprovados automaticamente para conferir no extracto e revogar exige motivo", async () => {
    listar.mockResolvedValue([{ ...base, id: "c-2", estado: "aprovado", premium_expira_em: "2026-11-13T08:30:00Z" }]);
    revogar.mockResolvedValue({});
    const user = userEvent.setup();
    render(<AdminComprovativos />);
    await user.click(await screen.findByRole("tab", { name: "Aprovados" }));

    expect(await screen.findByText("Automático — conferir no extracto")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Revogar/i }));
    const confirmar = screen.getByRole("button", { name: "Confirmar" });
    expect(confirmar).toBeDisabled();
    await user.type(screen.getByLabelText("Motivo"), "não está no extracto");
    await user.click(confirmar);
    await waitFor(() => expect(revogar).toHaveBeenCalledWith("c-2", "não está no extracto"));
  });

  it("um erro a carregar aparece, não uma lista vazia em silêncio", async () => {
    listar.mockRejectedValue(new Error("x"));
    render(<AdminComprovativos />);
    await waitFor(() => expect(toastErro).toHaveBeenCalledWith("Não foi possível carregar os comprovativos."));
  });
});
