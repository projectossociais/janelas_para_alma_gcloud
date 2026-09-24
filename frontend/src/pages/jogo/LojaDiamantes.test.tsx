import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const obterPerfil = vi.fn();
const obterLojaDiamantes = vi.fn();
const comprarPacoteDiamantes = vi.fn();
const pedirDiamantesKwanzas = vi.fn();
const listarMeusPedidosDiamantes = vi.fn();
const prepararComprovativo = vi.fn();
const enviarParaStorage = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  jogoApi: {
    obterPerfil: (...a: unknown[]) => obterPerfil(...a),
    obterLojaDiamantes: (...a: unknown[]) => obterLojaDiamantes(...a),
    comprarPacoteDiamantes: (...a: unknown[]) => comprarPacoteDiamantes(...a),
    pedirDiamantesKwanzas: (...a: unknown[]) => pedirDiamantesKwanzas(...a),
    listarMeusPedidosDiamantes: (...a: unknown[]) => listarMeusPedidosDiamantes(...a),
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

import LojaDiamantes from "./LojaDiamantes";
import { CarteiraJogoProvider } from "@/contexts/CarteiraJogoContext";

const Envoltorio = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>
    <CarteiraJogoProvider>{children}</CarteiraJogoProvider>
  </MemoryRouter>
);

const PACOTES = [
  { id: "pequeno", diamantes: 50, bonus: 0, total_diamantes: 50, preco_kz: 500, preco_moedas: 2000 },
  { id: "medio", diamantes: 150, bonus: 15, total_diamantes: 165, preco_kz: 1250, preco_moedas: 5500 },
  { id: "grande", diamantes: 400, bonus: 80, total_diamantes: 480, preco_kz: 3000, preco_moedas: 14000 },
];

const PERFIL = { moedas: 100, diamantes: 10, partidas_jogadas: 2, patamar_maximo_alcancado: 3 };

describe("LojaDiamantes", () => {
  beforeEach(() => {
    obterPerfil.mockReset();
    obterLojaDiamantes.mockReset();
    comprarPacoteDiamantes.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    toastInfo.mockReset();
    mockProfile = { id: "u1", nome_completo: "Ana", email: "ana@example.com", avatar_url: null };
    obterPerfil.mockResolvedValue(PERFIL);
    pedirDiamantesKwanzas.mockReset();
    listarMeusPedidosDiamantes.mockReset().mockResolvedValue([]);
    prepararComprovativo.mockReset().mockResolvedValue({ url_de_upload: "https://r2/put", chave: "comprovativos/x.png", url_publico: "https://r2/x.png" });
    enviarParaStorage.mockReset().mockResolvedValue(undefined);
  });

  it("mostra os pacotes vindos da API, com preço em Kz e bónus", async () => {
    obterLojaDiamantes.mockResolvedValue({ pacotes: PACOTES, pagamento_simulado: true });
    render(<LojaDiamantes />, { wrapper: Envoltorio });

    const medio = await screen.findByTestId("pacote-medio");
    expect(within(medio).getByText("165")).toBeInTheDocument();
    expect(within(medio).getByText(/\+15/)).toBeInTheDocument();
    expect(within(medio).getByRole("button", { name: /165 diamantes por Kz 1\.250/ })).toBeEnabled();
    expect(screen.getByTestId("pacote-grande")).toHaveTextContent("Melhor valor");
  });

  it("comprar (simulado) confirma, credita pela resposta da API e actualiza a barra", async () => {
    obterLojaDiamantes.mockResolvedValue({ pacotes: PACOTES, pagamento_simulado: true });
    comprarPacoteDiamantes.mockResolvedValue({ ...PERFIL, diamantes: 60 });
    render(<LojaDiamantes />, { wrapper: Envoltorio });

    await waitFor(() => expect(screen.getByRole("link", { name: /^Diamantes/ })).toHaveTextContent("10"));
    await userEvent.click(await screen.findByRole("button", { name: /50 diamantes por Kz 500/ }));
    await userEvent.click(await screen.findByRole("button", { name: /Pagar \(simulado\)/ }));

    await waitFor(() => expect(comprarPacoteDiamantes).toHaveBeenCalledWith("pequeno", "kwanzas"));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(screen.getByRole("link", { name: /^Diamantes/ })).toHaveTextContent("60");
  });

  it("se a compra falhar, mostra erro e nunca sucesso, sem mexer no saldo", async () => {
    obterLojaDiamantes.mockResolvedValue({ pacotes: PACOTES, pagamento_simulado: true });
    comprarPacoteDiamantes.mockRejectedValue(Object.assign(new Error("indisponível"), { status: 503 }));
    render(<LojaDiamantes />, { wrapper: Envoltorio });

    await waitFor(() => expect(screen.getByRole("link", { name: /^Diamantes/ })).toHaveTextContent("10"));
    await userEvent.click(await screen.findByRole("button", { name: /480 diamantes por Kz/ }));
    await userEvent.click(await screen.findByRole("button", { name: /Pagar \(simulado\)/ }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("indisponível"));
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /^Diamantes/, hidden: true })).toHaveTextContent("10");
  });

  it("cada pacote tem duas opções: Kwanzas e moedas", async () => {
    obterLojaDiamantes.mockResolvedValue({ pacotes: PACOTES, pagamento_simulado: false });
    obterPerfil.mockResolvedValue({ ...PERFIL, moedas: 6000 });
    render(<LojaDiamantes />, { wrapper: Envoltorio });

    const pequeno = await screen.findByTestId("pacote-pequeno");
    expect(within(pequeno).getByRole("button", { name: /50 diamantes por Kz 500/ })).toBeEnabled();
    await waitFor(() =>
      expect(within(pequeno).getByRole("button", { name: "Trocar 2.000 moedas por 50 diamantes" })).toBeEnabled()
    );
    // 14.000 moedas > 6.000: desactivado, e diz quanto falta.
    const grande = screen.getByTestId("pacote-grande");
    expect(within(grande).getByRole("button", { name: /Trocar 14\.000 moedas/ })).toBeDisabled();
    expect(within(grande).getByText("Faltam 8.000 moedas")).toBeInTheDocument();
  });

  it("comprar com moedas: confirma, envia o método 'moedas' e actualiza a barra pela resposta da API", async () => {
    obterLojaDiamantes.mockResolvedValue({ pacotes: PACOTES, pagamento_simulado: false });
    obterPerfil.mockResolvedValue({ ...PERFIL, moedas: 2500 });
    comprarPacoteDiamantes.mockResolvedValue({ ...PERFIL, moedas: 500, diamantes: 60 });
    render(<LojaDiamantes />, { wrapper: Envoltorio });

    const botao = await screen.findByRole("button", { name: "Trocar 2.000 moedas por 50 diamantes" });
    await waitFor(() => expect(botao).toBeEnabled());
    await userEvent.click(botao);
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText("Vai trocar 2.000 moedas por 50 diamantes.")).toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole("button", { name: "Trocar moedas" }));

    await waitFor(() => expect(comprarPacoteDiamantes).toHaveBeenCalledWith("pequeno", "moedas"));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(screen.getByRole("link", { name: /^Diamantes/ })).toHaveTextContent("60");
  });

  it("moedas insuficientes (402): erro claro, nunca sucesso, saldo intacto", async () => {
    obterLojaDiamantes.mockResolvedValue({ pacotes: PACOTES, pagamento_simulado: false });
    obterPerfil.mockResolvedValue({ ...PERFIL, moedas: 2500 });
    comprarPacoteDiamantes.mockRejectedValue(Object.assign(new Error("moedas insuficientes"), { status: 402 }));
    render(<LojaDiamantes />, { wrapper: Envoltorio });

    const botao = await screen.findByRole("button", { name: "Trocar 2.000 moedas por 50 diamantes" });
    await waitFor(() => expect(botao).toBeEnabled());
    await userEvent.click(botao);
    await userEvent.click(await screen.findByRole("button", { name: "Trocar moedas" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Não tem moedas suficientes para este pacote."));
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /^Diamantes/, hidden: true })).toHaveTextContent("10");
  });

  it("Kwanzas em produção: dados bancários + comprovativo; envia o pedido e não credita nada no ecrã", async () => {
    obterLojaDiamantes.mockResolvedValue({ pacotes: PACOTES, pagamento_simulado: false });
    pedirDiamantesKwanzas.mockResolvedValue({
      id: "p1", pacote_id: "medio", diamantes: 165, preco_kz: 1250, estado: "pendente",
      created_at: "2026-09-24T12:00:00Z", decidido_em: null,
    });
    render(<LojaDiamantes />, { wrapper: Envoltorio });

    await userEvent.click(await screen.findByRole("button", { name: /165 diamantes por Kz 1\.250/ }));
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText("Pagar por transferência")).toBeInTheDocument();
    expect(within(dialogo).getByText(/IBAN BAI/)).toBeInTheDocument();
    const enviar = within(dialogo).getByRole("button", { name: "Enviar comprovativo" });
    expect(enviar).toBeDisabled(); // sem comprovativo não se envia

    const ficheiro = new File(["x"], "comprovativo.png", { type: "image/png" });
    await userEvent.upload(dialogo.querySelector('input[type="file"]') as HTMLInputElement, ficheiro);
    await userEvent.click(enviar);

    await waitFor(() => expect(pedirDiamantesKwanzas).toHaveBeenCalledWith("medio", "comprovativos/x.png"));
    expect(prepararComprovativo).toHaveBeenCalledWith("image/png");
    expect(enviarParaStorage).toHaveBeenCalledWith("https://r2/put", ficheiro);
    expect(comprarPacoteDiamantes).not.toHaveBeenCalled();
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/Pedido enviado/)));
    // O saldo não muda -- os diamantes só chegam quando o admin confirmar.
    expect(screen.getByRole("link", { name: /^Diamantes/, hidden: true })).toHaveTextContent("10");
  });

  it("se o envio do comprovativo falhar, mostra erro e nunca sucesso nem pedido", async () => {
    obterLojaDiamantes.mockResolvedValue({ pacotes: PACOTES, pagamento_simulado: false });
    enviarParaStorage.mockRejectedValue(new Error("rede"));
    render(<LojaDiamantes />, { wrapper: Envoltorio });

    await userEvent.click(await screen.findByRole("button", { name: /50 diamantes por Kz 500/ }));
    const dialogo = await screen.findByRole("dialog");
    await userEvent.upload(
      dialogo.querySelector('input[type="file"]') as HTMLInputElement,
      new File(["x"], "c.pdf", { type: "application/pdf" })
    );
    await userEvent.click(within(dialogo).getByRole("button", { name: "Enviar comprovativo" }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(pedirDiamantesKwanzas).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("mostra os meus pedidos com o estado", async () => {
    obterLojaDiamantes.mockResolvedValue({ pacotes: PACOTES, pagamento_simulado: false });
    listarMeusPedidosDiamantes.mockResolvedValue([
      { id: "p1", pacote_id: "medio", diamantes: 165, preco_kz: 1250, estado: "pendente", created_at: "2026-09-24T12:00:00Z", decidido_em: null },
      { id: "p2", pacote_id: "pequeno", diamantes: 50, preco_kz: 500, estado: "aprovado", created_at: "2026-09-23T12:00:00Z", decidido_em: "2026-09-23T13:00:00Z" },
    ]);
    render(<LojaDiamantes />, { wrapper: Envoltorio });

    expect(await screen.findByRole("heading", { name: "Os meus pedidos" })).toBeInTheDocument();
    expect(screen.getByText("A confirmar")).toBeInTheDocument();
    expect(screen.getByText("Creditado")).toBeInTheDocument();
  });

  it("um 501 inesperado mostra 'em breve', nunca erro nem sucesso", async () => {
    obterLojaDiamantes.mockResolvedValue({ pacotes: PACOTES, pagamento_simulado: true });
    comprarPacoteDiamantes.mockRejectedValue(Object.assign(new Error("em breve"), { status: 501 }));
    render(<LojaDiamantes />, { wrapper: Envoltorio });

    await userEvent.click(await screen.findByRole("button", { name: /50 diamantes por Kz 500/ }));
    await userEvent.click(await screen.findByRole("button", { name: /Pagar \(simulado\)/ }));

    await waitFor(() => expect(toastInfo).toHaveBeenCalledWith("Pagamentos reais disponíveis em breve."));
    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("sem sessão, pede para entrar em vez de comprar", async () => {
    mockProfile = null;
    obterLojaDiamantes.mockResolvedValue({ pacotes: PACOTES, pagamento_simulado: true });
    render(<LojaDiamantes />, { wrapper: Envoltorio });

    expect(await screen.findAllByRole("link", { name: "Entrar para comprar" })).toHaveLength(3);
    expect(obterPerfil).not.toHaveBeenCalled();
  });

  it("se a loja não carregar, mostra erro com opção de tentar outra vez", async () => {
    obterLojaDiamantes.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({ pacotes: PACOTES, pagamento_simulado: true });
    render(<LojaDiamantes />, { wrapper: Envoltorio });

    await userEvent.click(await screen.findByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByTestId("pacote-pequeno")).toBeInTheDocument();
  });
});
