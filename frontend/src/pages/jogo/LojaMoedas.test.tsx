import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const obterPerfil = vi.fn();
const obterLojaMoedas = vi.fn();
const comprarPacoteMoedas = vi.fn();
const pedirComKwanzas = vi.fn();
const listarMeusPedidosLoja = vi.fn();
const prepararComprovativo = vi.fn();
const enviarParaStorage = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  jogoApi: {
    obterPerfil: (...a: unknown[]) => obterPerfil(...a),
    obterLojaMoedas: (...a: unknown[]) => obterLojaMoedas(...a),
    comprarPacoteMoedas: (...a: unknown[]) => comprarPacoteMoedas(...a),
    pedirComKwanzas: (...a: unknown[]) => pedirComKwanzas(...a),
    listarMeusPedidosLoja: (...a: unknown[]) => listarMeusPedidosLoja(...a),
  },
  comprovativosApi: {
    preparar: (...a: unknown[]) => prepararComprovativo(...a),
    enviarParaStorage: (...a: unknown[]) => enviarParaStorage(...a),
  },
  TIPOS_DE_COMPROVATIVO_ACEITES: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/BackButton", () => ({ default: () => null }));

let mockProfile: { id: string; nome_completo: string; email: string; avatar_url: string | null } | null = null;
vi.mock("@/contexts/ProfileContext", () => ({ useProfile: () => ({ profile: mockProfile }) }));

const toastError = vi.fn();
const toastSuccess = vi.fn();
const toastInfo = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
    info: (...a: unknown[]) => toastInfo(...a),
  },
}));

import LojaMoedas from "./LojaMoedas";
import { CarteiraJogoProvider } from "@/contexts/CarteiraJogoContext";

const Envoltorio = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>
    <CarteiraJogoProvider>{children}</CarteiraJogoProvider>
  </MemoryRouter>
);

const PACOTES = [
  { id: "pilha", moedas: 1000, bonus: 0, total_moedas: 1000, preco_kz: 350 },
  { id: "saco", moedas: 3000, bonus: 300, total_moedas: 3300, preco_kz: 1000 },
  { id: "bau", moedas: 8000, bonus: 1000, total_moedas: 9000, preco_kz: 2500 },
];
const PERFIL = { moedas: 100, diamantes: 10, partidas_jogadas: 2, patamar_maximo_alcancado: 3 };
const saldoMoedas = () => screen.getByRole("link", { name: /^Moedas/, hidden: true });

const abrirCheckout = async (nome: RegExp) => {
  await userEvent.click(await screen.findByRole("button", { name: nome }));
  return screen.findByRole("dialog");
};

describe("LojaMoedas", () => {
  beforeEach(() => {
    obterPerfil.mockReset().mockResolvedValue(PERFIL);
    obterLojaMoedas.mockReset().mockResolvedValue({ pacotes: PACOTES, pagamento_simulado: false });
    comprarPacoteMoedas.mockReset();
    pedirComKwanzas.mockReset();
    listarMeusPedidosLoja.mockReset().mockResolvedValue([]);
    prepararComprovativo
      .mockReset()
      .mockResolvedValue({ url_de_upload: "https://r2/put", chave: "comprovativos/m.png", url_publico: "https://r2/m.png" });
    enviarParaStorage.mockReset().mockResolvedValue(undefined);
    toastError.mockReset();
    toastSuccess.mockReset();
    toastInfo.mockReset();
    mockProfile = { id: "u1", nome_completo: "Ana", email: "ana@example.com", avatar_url: null };
  });

  it("mostra a Pilha, o Saco e o Baú de Moedas vindos da API, com preço em Kz e bónus", async () => {
    render(<LojaMoedas />, { wrapper: Envoltorio });

    expect(await screen.findByRole("heading", { name: "Loja de Moedas" })).toBeInTheDocument();
    const pilha = screen.getByTestId("pacote-pilha");
    expect(within(pilha).getByText("Pilha de Moedas")).toBeInTheDocument();
    expect(within(pilha).getByText("1.000")).toBeInTheDocument();
    const saco = screen.getByTestId("pacote-saco");
    expect(within(saco).getByText("Saco de Moedas")).toBeInTheDocument();
    expect(within(saco).getByText("3.300")).toBeInTheDocument();
    expect(within(saco).getByText(/\+300/)).toBeInTheDocument();
    expect(within(saco).getByText("Mais popular")).toBeInTheDocument();
    const bau = screen.getByTestId("pacote-bau");
    expect(within(bau).getByText("Baú de Moedas")).toBeInTheDocument();
    expect(within(bau).getByText("Melhor valor")).toBeInTheDocument();
    expect(within(bau).getByRole("button", { name: /Comprar 9\.000 moedas por Kz 2\.500/ })).toBeEnabled();
    // Sem pagamento simulado: explica a transferência e liga à Loja de Diamantes.
    expect(screen.getByText(/as moedas chegam depois de confirmarmos o pagamento/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Trocar moedas por diamantes/ })).toHaveAttribute(
      "href",
      "/jogo-curiosidades/loja"
    );
  });

  it("transferência: dados bancários + comprovativo; cria o pedido de moedas e não credita nada no ecrã", async () => {
    pedirComKwanzas.mockResolvedValue({
      id: "m1", tipo_item: "moedas", pacote_id: "saco", quantidade: 3300, preco_kz: 1000, estado: "pendente",
      created_at: "2026-09-24T12:00:00Z", decidido_em: null,
    });
    render(<LojaMoedas />, { wrapper: Envoltorio });
    await waitFor(() => expect(saldoMoedas()).toHaveTextContent("100"));

    const dialogo = await abrirCheckout(/Comprar 3\.300 moedas por Kz 1\.000/);
    expect(within(dialogo).getByText("Pagar por transferência")).toBeInTheDocument();
    expect(within(dialogo).getByText("Vai receber 3.300 moedas por Kz 1.000.")).toBeInTheDocument();
    expect(within(dialogo).getByText(/IBAN BAI/)).toBeInTheDocument();
    const enviar = within(dialogo).getByRole("button", { name: "Enviar comprovativo" });
    expect(enviar).toBeDisabled();

    const ficheiro = new File(["x"], "comprovativo.pdf", { type: "application/pdf" });
    await userEvent.upload(dialogo.querySelector('input[type="file"]') as HTMLInputElement, ficheiro);
    await userEvent.click(enviar);

    await waitFor(() => expect(pedirComKwanzas).toHaveBeenCalledWith("saco", "comprovativos/m.png", "moedas"));
    expect(prepararComprovativo).toHaveBeenCalledWith("application/pdf");
    expect(enviarParaStorage).toHaveBeenCalledWith("https://r2/put", ficheiro);
    expect(comprarPacoteMoedas).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        "Pedido enviado! As 3.300 moedas chegam assim que confirmarmos o pagamento."
      )
    );
    // O saldo não muda -- as moedas só chegam quando o admin confirmar.
    expect(saldoMoedas()).toHaveTextContent("100");
    await waitFor(() => expect(listarMeusPedidosLoja).toHaveBeenCalledTimes(2)); // recarrega "Os meus pedidos"
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("se o upload do comprovativo falhar: erro, nunca sucesso, nenhum pedido criado, diálogo aberto", async () => {
    enviarParaStorage.mockRejectedValue(new Error("rede"));
    render(<LojaMoedas />, { wrapper: Envoltorio });

    const dialogo = await abrirCheckout(/Comprar 1\.000 moedas/);
    await userEvent.upload(
      dialogo.querySelector('input[type="file"]') as HTMLInputElement,
      new File(["x"], "c.png", { type: "image/png" })
    );
    await userEvent.click(within(dialogo).getByRole("button", { name: "Enviar comprovativo" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Não foi possível concluir a compra. Nenhum valor foi cobrado.")
    );
    expect(pedirComKwanzas).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("se a API recusar o pedido (ex.: 403 comprovativo inválido), mostra o motivo e nunca sucesso", async () => {
    pedirComKwanzas.mockRejectedValue(
      Object.assign(new Error("essa chave não é um comprovativo válido"), { status: 403 })
    );
    render(<LojaMoedas />, { wrapper: Envoltorio });

    const dialogo = await abrirCheckout(/Comprar 9\.000 moedas/);
    await userEvent.upload(
      dialogo.querySelector('input[type="file"]') as HTMLInputElement,
      new File(["x"], "c.png", { type: "image/png" })
    );
    await userEvent.click(within(dialogo).getByRole("button", { name: "Enviar comprovativo" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("essa chave não é um comprovativo válido"));
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("cancelar fecha o diálogo sem pedir nada", async () => {
    render(<LojaMoedas />, { wrapper: Envoltorio });
    const dialogo = await abrirCheckout(/Comprar 1\.000 moedas/);
    await userEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(pedirComKwanzas).not.toHaveBeenCalled();
    expect(comprarPacoteMoedas).not.toHaveBeenCalled();
  });

  it("modo simulado (desenvolvimento): credita logo pela resposta da API e actualiza a barra", async () => {
    obterLojaMoedas.mockResolvedValue({ pacotes: PACOTES, pagamento_simulado: true });
    comprarPacoteMoedas.mockResolvedValue({ ...PERFIL, moedas: 1100 });
    render(<LojaMoedas />, { wrapper: Envoltorio });
    await waitFor(() => expect(saldoMoedas()).toHaveTextContent("100"));

    const dialogo = await abrirCheckout(/Comprar 1\.000 moedas/);
    expect(within(dialogo).queryByText(/IBAN/)).not.toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole("button", { name: "Pagar (simulado)" }));

    await waitFor(() => expect(comprarPacoteMoedas).toHaveBeenCalledWith("pilha"));
    expect(pedirComKwanzas).not.toHaveBeenCalled();
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Compra concluída! +1.000 moedas."));
    expect(saldoMoedas()).toHaveTextContent("1.100");
  });

  it("um 501 inesperado mostra 'em breve', nunca erro nem sucesso", async () => {
    obterLojaMoedas.mockResolvedValue({ pacotes: PACOTES, pagamento_simulado: true });
    comprarPacoteMoedas.mockRejectedValue(Object.assign(new Error("em breve"), { status: 501 }));
    render(<LojaMoedas />, { wrapper: Envoltorio });

    const dialogo = await abrirCheckout(/Comprar 1\.000 moedas/);
    await userEvent.click(within(dialogo).getByRole("button", { name: "Pagar (simulado)" }));

    await waitFor(() => expect(toastInfo).toHaveBeenCalledWith("Pagamentos reais disponíveis em breve."));
    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("mostra os meus pedidos de moedas com o estado", async () => {
    listarMeusPedidosLoja.mockResolvedValue([
      { id: "m1", tipo_item: "moedas", pacote_id: "bau", quantidade: 9000, preco_kz: 2500, estado: "pendente", created_at: "2026-09-24T12:00:00Z", decidido_em: null },
      { id: "m2", tipo_item: "moedas", pacote_id: "pilha", quantidade: 1000, preco_kz: 350, estado: "rejeitado", created_at: "2026-09-23T12:00:00Z", decidido_em: "2026-09-23T13:00:00Z" },
    ]);
    render(<LojaMoedas />, { wrapper: Envoltorio });

    expect(await screen.findByRole("heading", { name: "Os meus pedidos" })).toBeInTheDocument();
    expect(screen.getByTestId("pedido-m1")).toHaveTextContent("9.000 moedas");
    expect(screen.getByTestId("pedido-m1")).toHaveTextContent("A confirmar");
    expect(screen.getByTestId("pedido-m2")).toHaveTextContent("Rejeitado");
  });

  it("sem sessão, mostra os preços e pede para entrar, sem pedir pedidos à API", async () => {
    mockProfile = null;
    render(<LojaMoedas />, { wrapper: Envoltorio });

    expect(await screen.findAllByRole("link", { name: "Entrar para comprar" })).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /Comprar .* moedas/ })).not.toBeInTheDocument();
    expect(listarMeusPedidosLoja).not.toHaveBeenCalled();
  });

  it("se a loja não carregar, mostra erro com opção de tentar outra vez", async () => {
    obterLojaMoedas.mockReset().mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({
      pacotes: PACOTES,
      pagamento_simulado: false,
    });
    render(<LojaMoedas />, { wrapper: Envoltorio });

    await userEvent.click(await screen.findByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByTestId("pacote-bau")).toBeInTheDocument();
  });
});
