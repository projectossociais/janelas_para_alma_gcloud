import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// --- mocks ---
// Este é o fluxo com o histórico mais grave do projecto (ver CLAUDE.md,
// "Nunca mostrar sucesso antes de verificar error/excepção") — o que importa
// aqui é especificamente o caminho do erro, não só o do sucesso. Voltou a
// falar com a API própria (DoacaoService, via Resend para a confirmação)
// depois de ter passado por um retrocesso temporário para o Supabase
// enquanto a infra de email em Python não estava pronta — ver docs/BACKLOG.md.

class ApiErrorFalso extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const registarMateriais = vi.fn();
const registarFinanceira = vi.fn();
const prepararComprovativo = vi.fn();
const enviarParaStorage = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  doacoesApi: {
    registarMateriais: (...a: unknown[]) => registarMateriais(...a),
    registarFinanceira: (...a: unknown[]) => registarFinanceira(...a),
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

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoggedIn: false, user: null, logout: vi.fn(), isAdmin: false }),
}));

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: null, loading: false, refetch: vi.fn(), setProfile: vi.fn() }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

import Apoiar from "./Apoiar";

async function abrirDialogoDeMateriais(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Armações/i }));
  await user.click(screen.getByRole("button", { name: /^Confirmar Doação de Materiais$/ }));
  const email = await screen.findByLabelText(/O seu email para contacto/i);
  await user.type(email, "doador@example.com");
  return screen.getByRole("button", { name: /Confirmar Doação|A enviar/ });
}

describe("Apoiar — doação de materiais", () => {
  beforeEach(() => {
    registarMateriais.mockReset();
    registarFinanceira.mockReset();
    prepararComprovativo.mockReset();
    enviarParaStorage.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("nunca mostra sucesso quando a API falha ao registar a doação", async () => {
    registarMateriais.mockRejectedValue(new ApiErrorFalso(500, "falha ao gravar"));
    const user = userEvent.setup();
    render(<Apoiar />, { wrapper: MemoryRouter });

    const confirmar = await abrirDialogoDeMateriais(user);
    await user.click(confirmar);

    await waitFor(() => expect(registarMateriais).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("falha ao gravar");
    // o dialogo continua no passo de formulário -- nunca avançou para o
    // ecrã de "recolha" (que só devia aparecer com uma doação confirmada)
    expect(screen.getByLabelText(/O seu email para contacto/i)).toBeInTheDocument();
  });

  it("nunca mostra sucesso quando a gravação passa mas o envio do email de confirmação falha", async () => {
    // DoacaoService trata as duas coisas como um pedido só -- se o Resend
    // falhar, a API devolve erro mesmo que a doação já esteja gravada.
    registarMateriais.mockRejectedValue(new ApiErrorFalso(500, "falha ao enviar email"));
    const user = userEvent.setup();
    render(<Apoiar />, { wrapper: MemoryRouter });

    const confirmar = await abrirDialogoDeMateriais(user);
    await user.click(confirmar);

    await waitFor(() => expect(registarMateriais).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("falha ao enviar email");
    expect(screen.getByLabelText(/O seu email para contacto/i)).toBeInTheDocument();
  });

  it("só mostra sucesso depois de a API confirmar o registo, com o recibo do servidor", async () => {
    registarMateriais.mockResolvedValue({
      id: "doacao-1",
      recibo_id: "JPA-ABC123",
      tipo: "materiais",
      email: "doador@example.com",
      materiais: ["armacoes"],
      detalhes: null,
      status: "pendente",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    const user = userEvent.setup();
    render(<Apoiar />, { wrapper: MemoryRouter });

    const confirmar = await abrirDialogoDeMateriais(user);
    await user.click(confirmar);

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(toastError).not.toHaveBeenCalled();
    expect(registarMateriais).toHaveBeenCalledWith("doador@example.com", ["armacoes"], null);
  });
});

describe("Apoiar — doação financeira (comprovativo via R2, CROSS-02)", () => {
  beforeEach(() => {
    registarMateriais.mockReset();
    registarFinanceira.mockReset();
    prepararComprovativo.mockReset();
    enviarParaStorage.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  async function chegarAoPassoDeUpload(user: ReturnType<typeof userEvent.setup>) {
    render(<Apoiar />, { wrapper: MemoryRouter });
    await user.click(screen.getByRole("tab", { name: /Apoio Financeiro/i }));
    await user.click(screen.getByRole("button", { name: /Aliado/i }));
    await user.click(screen.getByRole("button", { name: /^Apoiar como Aliado$/i }));
    const email = await screen.findByLabelText(/receber o comprovativo/i);
    await user.type(email, "doador@example.com");
    await user.click(screen.getByRole("button", { name: /Continuar/i }));
    return screen.findByTestId("file-input");
  }

  it("nunca mostra sucesso quando o envio ao storage falha", async () => {
    prepararComprovativo.mockResolvedValue({
      url_de_upload: "https://r2.exemplo.test/comprovativos/x.pdf?sig=1",
      chave: "comprovativos/x.pdf",
      url_publico: "https://cdn.exemplo.test/comprovativos/x.pdf",
    });
    enviarParaStorage.mockRejectedValue(
      Object.assign(new Error("Não foi possível enviar a imagem para o storage."), { status: 500 }),
    );
    const user = userEvent.setup();
    const inputFicheiro = await chegarAoPassoDeUpload(user);

    await user.upload(inputFicheiro, new File(["x"], "comprovativo.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: /Concluir Doação/i }));

    await waitFor(() => expect(enviarParaStorage).toHaveBeenCalled());
    expect(registarFinanceira).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Não foi possível enviar a imagem para o storage.");
  });

  it("nunca mostra sucesso quando registar a doação falha", async () => {
    prepararComprovativo.mockResolvedValue({
      url_de_upload: "https://r2.exemplo.test/comprovativos/x.pdf?sig=1",
      chave: "comprovativos/x.pdf",
      url_publico: "https://cdn.exemplo.test/comprovativos/x.pdf",
    });
    enviarParaStorage.mockResolvedValue(undefined);
    registarFinanceira.mockRejectedValue(
      Object.assign(new Error("essa chave não é um comprovativo válido"), { status: 403 }),
    );
    const user = userEvent.setup();
    const inputFicheiro = await chegarAoPassoDeUpload(user);

    await user.upload(inputFicheiro, new File(["x"], "comprovativo.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: /Concluir Doação/i }));

    await waitFor(() => expect(registarFinanceira).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("essa chave não é um comprovativo válido");
  });

  it("só mostra sucesso depois dos três passos (assinar, enviar, registar) completarem", async () => {
    prepararComprovativo.mockResolvedValue({
      url_de_upload: "https://r2.exemplo.test/comprovativos/x.pdf?sig=1",
      chave: "comprovativos/x.pdf",
      url_publico: "https://cdn.exemplo.test/comprovativos/x.pdf",
    });
    enviarParaStorage.mockResolvedValue(undefined);
    registarFinanceira.mockResolvedValue({
      id: "doacao-2",
      recibo_id: "FIN-ABC123",
      tipo: "financeiro",
      email: "doador@example.com",
      materiais: null,
      detalhes: "Aliado (R$ 10-30)",
      status: "comprovativo_enviado",
      comprovativo_url: "https://cdn.exemplo.test/comprovativos/x.pdf",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    const user = userEvent.setup();
    const inputFicheiro = await chegarAoPassoDeUpload(user);

    await user.upload(inputFicheiro, new File(["x"], "comprovativo.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: /Concluir Doação/i }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(toastError).not.toHaveBeenCalled();
    expect(enviarParaStorage).toHaveBeenCalledWith(
      "https://r2.exemplo.test/comprovativos/x.pdf?sig=1",
      expect.any(File),
    );
    expect(registarFinanceira).toHaveBeenCalledWith(
      "doador@example.com",
      expect.any(String),
      "comprovativos/x.pdf",
    );
  });
});

describe("Apoiar -- em inglês, o que vai para a API continua em português", () => {
  beforeEach(() => {
    registarFinanceira.mockReset();
    prepararComprovativo.mockReset();
    enviarParaStorage.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });
  afterEach(async () => {
    const { default: i18n } = await import("@/i18n");
    await i18n.changeLanguage("pt-AO");
  });

  it("os detalhes do donativo usam o nome e o intervalo do nível em português, com a página em inglês", async () => {
    const { default: i18n } = await import("@/i18n");
    await i18n.changeLanguage("en-US");
    prepararComprovativo.mockResolvedValue({
      url_de_upload: "https://r2.exemplo.test/comprovativos/x.pdf?sig=1",
      chave: "comprovativos/x.pdf",
      url_publico: "https://cdn.exemplo.test/comprovativos/x.pdf",
    });
    enviarParaStorage.mockResolvedValue(undefined);
    registarFinanceira.mockResolvedValue({ id: "doacao-3", recibo_id: "FIN-EN", tipo: "financeiro" });

    const user = userEvent.setup();
    render(<Apoiar />, { wrapper: MemoryRouter });
    await user.click(screen.getByRole("tab", { name: /Financial Support/i }));
    await user.click(screen.getByRole("button", { name: /Ally/i }));
    await user.click(screen.getByRole("button", { name: /^Give as Ally$/i }));
    await user.type(await screen.findByLabelText(/receive your receipt/i), "doador@example.com");
    await user.click(screen.getByRole("button", { name: /Continue/i }));
    await user.upload(await screen.findByTestId("file-input"), new File(["x"], "c.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: /Complete Donation/i }));

    await waitFor(() => expect(registarFinanceira).toHaveBeenCalled());
    expect(registarFinanceira).toHaveBeenCalledWith("doador@example.com", "Aliado (10.000 a 250.000 Kz)", "comprovativos/x.pdf");
  });
});
