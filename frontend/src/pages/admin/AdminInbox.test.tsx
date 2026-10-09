import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const listar = vi.fn();
const marcarLida = vi.fn();
const premiumListar = vi.fn();
const premiumAprovar = vi.fn();
const premiumRevogar = vi.fn();
const diamantesListar = vi.fn();
const diamantesAprovar = vi.fn();
const diamantesRejeitar = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  contactMessagesApi: {
    listar: (...a: unknown[]) => listar(...a),
    marcarLida: (...a: unknown[]) => marcarLida(...a),
  },
  jogoApi: {
    listarPedidosLoja: (...a: unknown[]) => diamantesListar(...a),
    aprovarPedidoLoja: (...a: unknown[]) => diamantesAprovar(...a),
    rejeitarPedidoLoja: (...a: unknown[]) => diamantesRejeitar(...a),
  },
  premiumApi: {
    listar: (...a: unknown[]) => premiumListar(...a),
    aprovar: (...a: unknown[]) => premiumAprovar(...a),
    revogar: (...a: unknown[]) => premiumRevogar(...a),
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

import AdminInbox from "./AdminInbox";
import { violacoesAcessibilidade } from "@/design/testes/acessibilidade";

/** As decisões pedem confirmação num diálogo: carrega no botão e depois em `confirmar`. */
async function decidir(user: ReturnType<typeof userEvent.setup>, botao: RegExp, confirmar: string) {
  await user.click(await screen.findByRole("button", { name: botao }));
  const dialogo = await screen.findByRole("dialog");
  await user.click(within(dialogo).getByRole("button", { name: confirmar }));
}

async function abrirSeparadorPremium(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("radio", { name: /Pedidos Premium/i }));
}

const umaMensagem = {
  id: "msg-1",
  nome: "Ana Silva",
  email: "ana@example.com",
  assunto: null,
  mensagem: "Tenho uma dúvida.",
  lida: false,
  created_at: "2026-01-01T10:00:00.000Z",
};

const umPedido = {
  id: "ped-1",
  nome: "Rui Premium",
  email: "rui@example.com",
  telefone: null,
  plano: "mensal",
  status: "pendente",
  created_at: "2026-01-02T10:00:00.000Z",
  user_id: "user-9",
  aprovado_por: null,
  aprovado_em: null,
};

describe("AdminInbox — mensagens de contacto", () => {
  beforeEach(() => {
    listar.mockReset().mockResolvedValue([]);
    marcarLida.mockReset();
    premiumListar.mockReset().mockResolvedValue([]);
    premiumAprovar.mockReset();
    premiumRevogar.mockReset();
    diamantesListar.mockReset().mockResolvedValue([]);
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("mostra um erro (e não rebenta) quando a listagem falha", async () => {
    listar.mockRejectedValue(Object.assign(new Error("Sem permissões"), { status: 403 }));
    render(<AdminInbox />, { wrapper: MemoryRouter });

    // Antes: uma falha mostrava "Sem mensagens." -- falso.
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem permissões");
    expect(screen.queryByText("Sem mensagens.")).not.toBeInTheDocument();
  });

  it("marca uma mensagem como tratada e recarrega a lista", async () => {
    listar.mockResolvedValueOnce([umaMensagem]).mockResolvedValueOnce([{ ...umaMensagem, lida: true }]);
    marcarLida.mockResolvedValue({ ...umaMensagem, lida: true });
    const user = userEvent.setup();
    render(<AdminInbox />, { wrapper: MemoryRouter });

    const botao = await screen.findByRole("button", { name: /Marcar tratada/i });
    await user.click(botao);

    await waitFor(() => expect(marcarLida).toHaveBeenCalledWith("msg-1"));
    expect(toastSuccess).toHaveBeenCalledWith("Marcada como tratada.");
    await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));
  });

  it("nunca mostra sucesso se marcar como tratada falhar", async () => {
    listar.mockResolvedValue([umaMensagem]);
    marcarLida.mockRejectedValue(Object.assign(new Error("Falhou"), { status: 500 }));
    const user = userEvent.setup();
    render(<AdminInbox />, { wrapper: MemoryRouter });

    await user.click(await screen.findByRole("button", { name: /Marcar tratada/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Falhou"));
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("aprova um pagamento Premium e recarrega os pedidos", async () => {
    premiumListar
      .mockResolvedValueOnce([umPedido])
      .mockResolvedValueOnce([{ ...umPedido, status: "aprovado" }]);
    premiumAprovar.mockResolvedValue({ ...umPedido, status: "aprovado" });
    const user = userEvent.setup();
    render(<AdminInbox />, { wrapper: MemoryRouter });

    await abrirSeparadorPremium(user);
    await decidir(user, /Aprovar pagamento/i, "Aprovar");

    await waitFor(() => expect(premiumAprovar).toHaveBeenCalledWith("ped-1"));
    expect(toastSuccess).toHaveBeenCalledWith("Pagamento aprovado. Premium activo por 30 dias.");
    await waitFor(() => expect(premiumListar).toHaveBeenCalledTimes(2));
  });

  it("nunca mostra sucesso se aprovar o pagamento falhar", async () => {
    premiumListar.mockResolvedValue([umPedido]);
    premiumAprovar.mockRejectedValue(Object.assign(new Error("já aprovado"), { status: 409 }));
    const user = userEvent.setup();
    render(<AdminInbox />, { wrapper: MemoryRouter });

    await abrirSeparadorPremium(user);
    await decidir(user, /Aprovar pagamento/i, "Aprovar");

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("já aprovado"));
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("desactiva o botão de aprovar quando o pedido não tem conta ligada", async () => {
    premiumListar.mockResolvedValue([{ ...umPedido, user_id: null }]);
    const user = userEvent.setup();
    render(<AdminInbox />, { wrapper: MemoryRouter });

    await abrirSeparadorPremium(user);
    const botao = await screen.findByRole("button", { name: /Aprovar pagamento/i });
    expect(botao).toBeDisabled();
  });

  it("mostra um link para o comprovativo quando o pedido tem um (CROSS-02)", async () => {
    premiumListar.mockResolvedValue([
      { ...umPedido, comprovativo_url: "https://cdn.exemplo.test/comprovativos/x.pdf" },
    ]);
    const user = userEvent.setup();
    render(<AdminInbox />, { wrapper: MemoryRouter });

    await abrirSeparadorPremium(user);
    const link = await screen.findByRole("link", { name: /Ver comprovativo/i });
    expect(link).toHaveAttribute("href", "https://cdn.exemplo.test/comprovativos/x.pdf");
  });

  it("não mostra o link de comprovativo quando o pedido não tem um", async () => {
    premiumListar.mockResolvedValue([umPedido]);
    const user = userEvent.setup();
    render(<AdminInbox />, { wrapper: MemoryRouter });

    await abrirSeparadorPremium(user);
    await screen.findByText(umPedido.nome);
    expect(screen.queryByRole("link", { name: /Ver comprovativo/i })).not.toBeInTheDocument();
  });
});

const umPedidoDiamantes = {
  id: "dia-1",
  utilizador_id: "user-7",
  tipo_item: "diamantes",
  pacote_id: "medio",
  quantidade: 165,
  preco_kz: 1250,
  comprovativo_url: "https://r2.example/comprovativos/x.png",
  estado: "pendente",
  decidido_por: null,
  decidido_em: null,
  created_at: "2026-09-24T10:00:00.000Z",
};

describe("AdminInbox — pedidos da loja do jogo (Kwanzas por transferência)", () => {
  beforeEach(() => {
    listar.mockReset().mockResolvedValue([]);
    premiumListar.mockReset().mockResolvedValue([]);
    diamantesListar.mockReset().mockResolvedValue([umPedidoDiamantes]);
    diamantesAprovar.mockReset();
    diamantesRejeitar.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  async function abrir(user: ReturnType<typeof userEvent.setup>) {
    render(<AdminInbox />, { wrapper: MemoryRouter });
    await user.click(await screen.findByRole("radio", { name: /Loja do jogo \(1\)/ }));
  }

  it("mostra o comprovativo e confirma o pagamento pela API, recarregando a lista", async () => {
    const user = userEvent.setup();
    diamantesAprovar.mockResolvedValue({ ...umPedidoDiamantes, estado: "aprovado" });
    await abrir(user);

    expect(await screen.findByRole("link", { name: /Ver comprovativo/ })).toHaveAttribute(
      "href",
      umPedidoDiamantes.comprovativo_url
    );
    await decidir(user, /Confirmar pagamento/, "Confirmar e creditar");

    await waitFor(() => expect(diamantesAprovar).toHaveBeenCalledWith("dia-1"));
    expect(toastSuccess).toHaveBeenCalledWith("Pagamento confirmado. 165 diamantes creditados.");
    expect(diamantesListar).toHaveBeenCalledTimes(2);
  });

  it("se a confirmação falhar (ex.: 409 já decidido), mostra erro e nunca sucesso", async () => {
    const user = userEvent.setup();
    diamantesAprovar.mockRejectedValue(Object.assign(new Error("este pedido já foi decidido"), { status: 409 }));
    await abrir(user);

    await decidir(user, /Confirmar pagamento/, "Confirmar e creditar");

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("este pedido já foi decidido"));
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("rejeitar não credita e avisa", async () => {
    const user = userEvent.setup();
    diamantesRejeitar.mockResolvedValue({ ...umPedidoDiamantes, estado: "rejeitado" });
    await abrir(user);

    await decidir(user, /^Rejeitar$/, "Rejeitar");

    await waitFor(() => expect(diamantesRejeitar).toHaveBeenCalledWith("dia-1"));
    expect(diamantesAprovar).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith("Pedido rejeitado. Nada foi creditado.");
  });

  it("pedido de moedas: mostra o tipo e a quantidade, e confirmar credita moedas", async () => {
    const user = userEvent.setup();
    const pedidoMoedas = { ...umPedidoDiamantes, id: "moe-1", tipo_item: "moedas", pacote_id: "bau", quantidade: 9000, preco_kz: 2500 };
    diamantesListar.mockResolvedValue([pedidoMoedas]);
    diamantesAprovar.mockResolvedValue({ ...pedidoMoedas, estado: "aprovado" });
    await abrir(user);

    const cartao = await screen.findByTestId("pedido-loja-moe-1");
    // O mesmo formato que o jogador viu na loja ("9.000 moedas", "Kz 2.500").
    expect(cartao).toHaveTextContent("9.000 moedas");
    expect(cartao).toHaveTextContent("Kz 2.500");
    await decidir(user, /Confirmar pagamento/, "Confirmar e creditar");

    await waitFor(() => expect(diamantesAprovar).toHaveBeenCalledWith("moe-1"));
    expect(toastSuccess).toHaveBeenCalledWith("Pagamento confirmado. 9.000 moedas creditadas.");
  });

  it("o link antigo ?tab=diamantes abre o separador da loja do jogo", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/mensagens?tab=diamantes"]}>
        <AdminInbox />
      </MemoryRouter>
    );
    expect(await screen.findByTestId("pedido-loja-dia-1")).toBeInTheDocument();
  });

  it("pedido já decidido não tem botões de decisão", async () => {
    const user = userEvent.setup();
    diamantesListar.mockResolvedValue([{ ...umPedidoDiamantes, estado: "aprovado" }]);
    render(<AdminInbox />, { wrapper: MemoryRouter });
    await user.click(await screen.findByRole("radio", { name: /Loja do jogo \(0\)/ }));

    expect(await screen.findByText("Creditado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirmar pagamento/ })).not.toBeInTheDocument();
  });
});

describe("AdminInbox — decisões pedem confirmação", () => {
  beforeEach(() => {
    listar.mockReset().mockResolvedValue([]);
    premiumListar.mockReset().mockResolvedValue([]);
    diamantesListar.mockReset().mockResolvedValue([umPedidoDiamantes]);
    diamantesAprovar.mockReset();
    toastSuccess.mockReset();
  });

  // Confirmar um pagamento da loja credita a conta uma única vez: um clique
  // por engano não se desfaz.
  it("'Confirmar pagamento' só credita depois de confirmar no diálogo; 'Cancelar' não faz nada", async () => {
    const user = userEvent.setup();
    render(<AdminInbox />, { wrapper: MemoryRouter });
    await user.click(await screen.findByRole("radio", { name: /Loja do jogo/ }));

    await user.click(await screen.findByRole("button", { name: /Confirmar pagamento/ }));
    const dialogo = await screen.findByRole("dialog", { name: "Confirmar o pagamento?" });
    expect(dialogo).toHaveTextContent("Kz 1.250");
    expect(dialogo).toHaveTextContent("165 diamantes");
    await user.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    expect(diamantesAprovar).not.toHaveBeenCalled();
  });

  it("sem violações de acessibilidade", async () => {
    const { container } = render(<AdminInbox />, { wrapper: MemoryRouter });
    await screen.findByText("Sem mensagens.");
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
