import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import PremiumRequestBanner from "./PremiumRequestBanner";

let perfilMock: { premium_ativo: boolean } | null = null;
let perfilCarregandoMock = false;
let meuPedidoMock = vi.fn();

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: perfilMock, loading: perfilCarregandoMock }),
}));

vi.mock("@/lib/apiClient", () => ({
  premiumApi: { meuPedido: (...args: unknown[]) => meuPedidoMock(...args) },
}));

const render_ = () => render(<MemoryRouter><PremiumRequestBanner /></MemoryRouter>);

describe("PremiumRequestBanner", () => {
  beforeEach(() => {
    perfilMock = null;
    perfilCarregandoMock = false;
    meuPedidoMock = vi.fn();
  });

  it("nada renderiza enquanto o perfil ainda carrega", () => {
    perfilCarregandoMock = true;
    render_();
    expect(meuPedidoMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("nada renderiza para quem já tem Premium activo -- nunca chama a API", () => {
    perfilMock = { premium_ativo: true };
    render_();
    expect(meuPedidoMock).not.toHaveBeenCalled();
  });

  it("nada renderiza quando nunca houve pedido nenhum", async () => {
    perfilMock = { premium_ativo: false };
    meuPedidoMock.mockResolvedValue(null);
    render_();
    await waitFor(() => expect(meuPedidoMock).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("mostra o aviso de pendente", async () => {
    perfilMock = { premium_ativo: false };
    meuPedidoMock.mockResolvedValue({ status: "pendente" });
    render_();
    await screen.findByText("O seu pagamento Premium está a aguardar aprovação");
  });

  it("mostra o aviso de revogado, com atalho para um novo pedido", async () => {
    perfilMock = { premium_ativo: false };
    meuPedidoMock.mockResolvedValue({ status: "revogado" });
    render_();
    await screen.findByText("O seu acesso Premium foi revogado");
    expect(screen.getByText("Submeter novo pedido")).toBeInTheDocument();
  });

  it("nada renderiza quando o último pedido já foi aprovado (o perfil é que manda)", async () => {
    perfilMock = { premium_ativo: false };
    meuPedidoMock.mockResolvedValue({ status: "aprovado" });
    render_();
    await waitFor(() => expect(meuPedidoMock).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
