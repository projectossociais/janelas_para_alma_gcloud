import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// CROSS-02: o comprovativo do pagamento Premium passa a ir directo ao R2 em
// 3 passos (mesmo padrão do avatar), em vez de uma Edge Function do
// Supabase. O que importa testar é o caminho do erro em cada passo -- nunca
// mostrar sucesso (avançar para o passo 5) sem os três terem corrido bem.

const prepararComprovativo = vi.fn();
const enviarParaStorage = vi.fn();
const pedirPremium = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  comprovativosApi: {
    preparar: (...a: unknown[]) => prepararComprovativo(...a),
    enviarParaStorage: (...a: unknown[]) => enviarParaStorage(...a),
  },
  premiumApi: { pedir: (...a: unknown[]) => pedirPremium(...a) },
  TIPOS_DE_COMPROVATIVO_ACEITES: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));

const toastFn = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ toast: (...a: unknown[]) => toastFn(...a) }));

import RegistoPremium from "./RegistoPremium";

async function chegarAoPassoDePagamento(user: ReturnType<typeof userEvent.setup>) {
  render(<RegistoPremium />, { wrapper: MemoryRouter });

  await user.type(screen.getByLabelText("Nome Completo"), "Ana Silva");
  await user.type(screen.getByLabelText("Email"), "ana@example.com");
  await user.type(screen.getByLabelText("Telefone (WhatsApp)"), "+244 900 000 000");
  await user.click(screen.getByRole("button", { name: /^Continuar$/i }));

  await user.click(await screen.findByRole("combobox", { name: /subscrição é para quem/i }));
  await user.click(await screen.findByRole("option", { name: "Para mim" }));
  await user.click(screen.getByLabelText("Sim"));
  await user.click(screen.getByRole("button", { name: /^Continuar$/i }));

  await user.click(await screen.findByRole("button", { name: /^Plano Mensal/i }));
  await user.click(screen.getByRole("button", { name: /Continuar para Pagamento/i }));

  return screen.findByTestId("file-input");
}

describe("RegistoPremium — comprovativo via R2 (CROSS-02)", () => {
  beforeEach(() => {
    prepararComprovativo.mockReset();
    enviarParaStorage.mockReset();
    pedirPremium.mockReset();
    toastFn.mockReset();
  });

  // Fluxo em várias etapas com muitos userEvent -- o timeout por omissão
  // (5s) pode apertar sob carga da suite inteira em paralelo, daí o 3º
  // argumento em cada teste abaixo.
  it("nunca avança para o passo de conclusão se o envio ao storage falhar", async () => {
    prepararComprovativo.mockResolvedValue({
      url_de_upload: "https://r2.exemplo.test/comprovativos/x.pdf?sig=1",
      chave: "comprovativos/x.pdf",
      url_publico: "https://cdn.exemplo.test/comprovativos/x.pdf",
    });
    enviarParaStorage.mockRejectedValue(
      Object.assign(new Error("Não foi possível enviar a imagem para o storage."), { status: 500 }),
    );
    const user = userEvent.setup();
    const inputFicheiro = await chegarAoPassoDePagamento(user);

    await user.upload(inputFicheiro, new File(["x"], "comprovativo.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: /Concluir Assinatura/i }));

    await waitFor(() => expect(enviarParaStorage).toHaveBeenCalled());
    expect(pedirPremium).not.toHaveBeenCalled();
    expect(
      screen.queryByText("Pedido Recebido com Sucesso!"),
    ).not.toBeInTheDocument();
    expect(toastFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Não foi possível concluir",
        description: "Não foi possível enviar a imagem para o storage.",
      }),
    );
  }, 15000);

  it("nunca avança para o passo de conclusão se o pedido Premium falhar", async () => {
    prepararComprovativo.mockResolvedValue({
      url_de_upload: "https://r2.exemplo.test/comprovativos/x.pdf?sig=1",
      chave: "comprovativos/x.pdf",
      url_publico: "https://cdn.exemplo.test/comprovativos/x.pdf",
    });
    enviarParaStorage.mockResolvedValue(undefined);
    pedirPremium.mockRejectedValue(
      Object.assign(new Error("essa chave não é um comprovativo válido"), { status: 403 }),
    );
    const user = userEvent.setup();
    const inputFicheiro = await chegarAoPassoDePagamento(user);

    await user.upload(inputFicheiro, new File(["x"], "comprovativo.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: /Concluir Assinatura/i }));

    await waitFor(() => expect(pedirPremium).toHaveBeenCalled());
    expect(screen.queryByText("Pedido Recebido com Sucesso!")).not.toBeInTheDocument();
  }, 15000);

  it("só avança para a conclusão depois dos três passos completarem", async () => {
    prepararComprovativo.mockResolvedValue({
      url_de_upload: "https://r2.exemplo.test/comprovativos/x.pdf?sig=1",
      chave: "comprovativos/x.pdf",
      url_publico: "https://cdn.exemplo.test/comprovativos/x.pdf",
    });
    enviarParaStorage.mockResolvedValue(undefined);
    pedirPremium.mockResolvedValue({
      id: "ped-1",
      nome: "Ana Silva",
      email: "ana@example.com",
      telefone: "+244 900 000 000",
      plano: "mensal",
      status: "pendente",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    const user = userEvent.setup();
    const inputFicheiro = await chegarAoPassoDePagamento(user);

    await user.upload(inputFicheiro, new File(["x"], "comprovativo.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: /Concluir Assinatura/i }));

    expect(await screen.findByText("Pedido Recebido com Sucesso!")).toBeInTheDocument();
    expect(pedirPremium).toHaveBeenCalledWith({
      nome: "Ana Silva",
      email: "ana@example.com",
      telefone: "+244 900 000 000",
      plano: "mensal",
      comprovativo_chave: "comprovativos/x.pdf",
    });
  }, 15000);
});
