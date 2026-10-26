import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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
  PROVINCES: ["Luanda", "Benguela"],
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

/** Cartão -> marcar itens no painel -> "Quero Doar Isto" (fecha o painel). */
async function escolherItens(
  user: ReturnType<typeof userEvent.setup>,
  categoria: RegExp,
  itens: (string | RegExp)[],
) {
  await user.click(screen.getByRole("button", { name: categoria }));
  const painel = await screen.findByRole("dialog");
  for (const item of itens) await user.click(within(painel).getByRole("checkbox", { name: item }));
  await user.click(within(painel).getByRole("button", { name: /Quero Doar Isto/i }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
}

async function abrirDialogoDeMateriais(user: ReturnType<typeof userEvent.setup>) {
  await escolherItens(user, /Armações/i, ["Óculos graduados usados"]);
  await user.click(screen.getByRole("button", { name: /^Confirmar Doação de Materiais$/ }));
  await user.click(await screen.findByRole("combobox"));
  await user.click(await screen.findByRole("option", { name: "Luanda" }));
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
      materiais: ["Armações: Óculos graduados usados"],
      detalhes: null,
      provincia: "Luanda",
      status: "pendente",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    const user = userEvent.setup();
    render(<Apoiar />, { wrapper: MemoryRouter });

    const confirmar = await abrirDialogoDeMateriais(user);
    await user.click(confirmar);

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(toastError).not.toHaveBeenCalled();
    expect(registarMateriais).toHaveBeenCalledWith(
      "doador@example.com",
      ["Armações: Óculos graduados usados"],
      "Luanda",
      null,
    );
  });

  it("sem escolher a província, não regista nem chama a API (UX-03)", async () => {
    const user = userEvent.setup();
    render(<Apoiar />, { wrapper: MemoryRouter });

    await escolherItens(user, /Armações/i, ["Lentes soltas"]);
    await user.click(screen.getByRole("button", { name: /^Confirmar Doação de Materiais$/ }));
    const email = await screen.findByLabelText(/O seu email para contacto/i);
    await user.type(email, "doador@example.com");
    await user.click(screen.getByRole("button", { name: /Confirmar Doação|A enviar/ }));

    expect(registarMateriais).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Seleccione a sua província");
  });
});

/** Separador financeiro: valor -> resumo (método + email) -> passo do comprovativo. */
async function passosFinanceiros(
  user: ReturnType<typeof userEvent.setup>,
  opcoes: {
    valor?: string;
    outroValor?: string;
    mensal?: boolean;
    metodo: string;
    nota?: string;
    nomes?: { tab: RegExp; mensal: RegExp; continuar: RegExp; nota: RegExp; email: RegExp; avancar: RegExp };
    antesDeContinuar?: () => void;
  },
) {
  const nomes = opcoes.nomes ?? {
    tab: /Apoio Financeiro/i,
    mensal: /^Mensalmente$/,
    continuar: /^Continuar$/,
    nota: /Adicionar nota/i,
    email: /receber o comprovativo/i,
    avancar: /Já transferi/i,
  };
  await user.click(screen.getByRole("tab", { name: nomes.tab }));
  if (opcoes.mensal) await user.click(screen.getByRole("button", { name: nomes.mensal }));
  if (opcoes.valor) await user.click(screen.getByRole("button", { name: opcoes.valor }));
  if (opcoes.outroValor) await user.type(screen.getByRole("textbox", { name: /Outro valor|Other amount/ }), opcoes.outroValor);
  if (opcoes.nota) {
    await user.click(screen.getByRole("checkbox", { name: nomes.nota }));
    await user.type(screen.getByRole("textbox", { name: nomes.nota }), opcoes.nota);
  }
  await user.click(screen.getByRole("button", { name: nomes.continuar }));
  await user.click(await screen.findByRole("radio", { name: new RegExp(opcoes.metodo.replace(/[()]/g, "\\$&")) }));
  opcoes.antesDeContinuar?.();
  await user.type(screen.getByLabelText(nomes.email), "doador@example.com");
  await user.click(screen.getByRole("button", { name: nomes.avancar }));
  return screen.findByTestId("file-input");
}

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
    return passosFinanceiros(user, { valor: "25.000 Kz", metodo: "Multicaixa Express" });
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
      "Uma única vez · 25.000 Kz · Multicaixa Express",
      "comprovativos/x.pdf",
      "unica",
    );
    expect(await screen.findByText("Obrigado!")).toBeInTheDocument();
    expect(screen.getByText("FIN-ABC123")).toBeInTheDocument();
  });

  it("mensal: explica a transferência permanente e envia a frequência e a nota", async () => {
    prepararComprovativo.mockResolvedValue({ url_de_upload: "https://r2.exemplo.test/u", chave: "comprovativos/m.pdf" });
    enviarParaStorage.mockResolvedValue(undefined);
    registarFinanceira.mockResolvedValue({ id: "d", recibo_id: "FIN-MES", tipo: "financeiro" });
    const user = userEvent.setup();
    render(<Apoiar />, { wrapper: MemoryRouter });

    const input = await passosFinanceiros(user, {
      mensal: true,
      outroValor: "12.500",
      metodo: "Transferência bancária (BAI)",
      nota: "para as crianças",
      antesDeContinuar: () =>
        expect(screen.getByText(/transferência permanente \(mensal\) com o mesmo valor/)).toBeInTheDocument(),
    });
    await user.upload(input, new File(["x"], "c.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: /Concluir Doação/i }));

    await waitFor(() =>
      expect(registarFinanceira).toHaveBeenCalledWith(
        "doador@example.com",
        "Mensal · 12.500 Kz · Transferência bancária (BAI) · para as crianças",
        "comprovativos/m.pdf",
        "mensal",
      ),
    );
    expect(await screen.findByText(/Não se esqueça de criar no seu banco/)).toBeInTheDocument();
  });

  it("não avança sem valor, nem com um valor abaixo do mínimo", async () => {
    const user = userEvent.setup();
    render(<Apoiar />, { wrapper: MemoryRouter });
    await user.click(screen.getByRole("tab", { name: /Apoio Financeiro/i }));

    const continuar = screen.getByRole("button", { name: /^Continuar$/ });
    expect(continuar).toBeDisabled();

    await user.type(screen.getByRole("textbox", { name: "Outro valor" }), "500");
    expect(continuar).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Outro valor" })).toHaveAttribute("aria-invalid", "true");

    await user.type(screen.getByRole("textbox", { name: "Outro valor" }), "0");
    expect(continuar).toBeEnabled();
  });

  it("no resumo, só avança com a forma de pagar escolhida e um email válido", async () => {
    const user = userEvent.setup();
    render(<Apoiar />, { wrapper: MemoryRouter });
    await user.click(screen.getByRole("tab", { name: /Apoio Financeiro/i }));
    await user.click(screen.getByRole("button", { name: "5.000 Kz" }));
    await user.click(screen.getByRole("button", { name: /^Continuar$/ }));

    const avancar = await screen.findByRole("button", { name: /Já transferi/i });
    await user.type(screen.getByLabelText(/receber o comprovativo/i), "doador@example.com");
    expect(avancar).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: /Multicaixa Express/i }));
    expect(avancar).toBeEnabled();

    await user.clear(screen.getByLabelText(/receber o comprovativo/i));
    await user.type(screen.getByLabelText(/receber o comprovativo/i), "sem-arroba");
    expect(avancar).toBeDisabled();
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

  it("os detalhes do donativo vão em português, com a página em inglês", async () => {
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
    const input = await passosFinanceiros(user, {
      mensal: true,
      valor: "50.000 Kz",
      metodo: "Bank transfer (BAI)",
      nomes: {
        tab: /Financial Support/i,
        mensal: /^Monthly$/,
        continuar: /^Continue$/,
        nota: /Add note/i,
        email: /receive your receipt/i,
        avancar: /I've transferred/i,
      },
    });
    await user.upload(input, new File(["x"], "c.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: /Complete Donation/i }));

    await waitFor(() =>
      expect(registarFinanceira).toHaveBeenCalledWith(
        "doador@example.com",
        "Mensal · 50.000 Kz · Transferência bancária (BAI)",
        "comprovativos/x.pdf",
        "mensal",
      ),
    );
  });
});

describe("Apoiar -- cartões com detalhe (materiais)", () => {
  beforeEach(() => {
    registarMateriais.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("o detalhe de uma categoria mostra os materiais aceites e como são reaproveitados", async () => {
    const user = userEvent.setup();
    render(<Apoiar />, { wrapper: MemoryRouter });

    // O cartão já não mostra a descrição longa; está no painel.
    expect(screen.queryByText(/redistribuição/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Armações/i }));

    const painel = await screen.findByRole("dialog");
    expect(within(painel).getByText(/Armações novas ou usadas em bom estado/i)).toBeInTheDocument();
    expect(within(painel).getByText("Óculos graduados usados")).toBeInTheDocument();
    expect(within(painel).getByText(/limpeza, reparação e validação técnica/i)).toBeInTheDocument();

    await user.click(within(painel).getByRole("button", { name: /^Fechar$/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("marcar e desmarcar itens: o cartão mostra quantos, e volta ao normal sem nenhum", async () => {
    const user = userEvent.setup();
    render(<Apoiar />, { wrapper: MemoryRouter });

    await escolherItens(user, /Armações/i, ["Óculos graduados usados", "Lentes soltas"]);
    expect(screen.getByRole("button", { name: /Armações/i })).toHaveTextContent("2 itens");

    // Desmarcar um, confirmar: 1 item.
    await escolherItens(user, /Armações/i, ["Lentes soltas"]);
    expect(screen.getByRole("button", { name: /Armações/i })).toHaveTextContent("1 item");

    // Desmarcar o último: o cartão deixa de estar seleccionado.
    await escolherItens(user, /Armações/i, ["Óculos graduados usados"]);
    expect(screen.getByRole("button", { name: /Armações/i })).not.toHaveTextContent(/item/);
  });

  it("fechar o painel sem \"Quero Doar Isto\" não guarda o que foi marcado", async () => {
    const user = userEvent.setup();
    render(<Apoiar />, { wrapper: MemoryRouter });

    await user.click(screen.getByRole("button", { name: /Tampões/i }));
    const painel = await screen.findByRole("dialog");
    await user.click(within(painel).getByRole("checkbox", { name: /Oclusores de tecido/i }));
    await user.click(within(painel).getByRole("button", { name: /^Fechar$/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    expect(screen.getByRole("button", { name: /Tampões/i })).not.toHaveTextContent(/item/);
    await user.click(screen.getByRole("button", { name: /^Confirmar Doação de Materiais$/ }));
    expect(toastError).toHaveBeenCalledWith("Seleccione pelo menos um tipo de material.");
  });

  it("envia categoria e itens de várias categorias, em português, com as notas", async () => {
    registarMateriais.mockResolvedValue({ id: "d-1", recibo_id: "JPA-1", tipo: "materiais" });
    const user = userEvent.setup();
    render(<Apoiar />, { wrapper: MemoryRouter });

    await escolherItens(user, /Armações/i, ["Armações partidas"]);
    await escolherItens(user, /Outros/i, ["Fita adesiva", "Película colorida transparente"]);
    await user.type(screen.getByLabelText(/Detalhes adicionais/i), "duas caixas");
    await user.click(screen.getByRole("button", { name: /^Confirmar Doação de Materiais$/ }));

    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText(/Película colorida transparente, Fita adesiva/)).toBeInTheDocument();
    await user.click(within(dialogo).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Benguela" }));
    await user.type(within(dialogo).getByLabelText(/O seu email para contacto/i), "doador@example.com");
    await user.click(within(dialogo).getByRole("button", { name: /Confirmar Doação|A enviar/ }));

    await waitFor(() =>
      expect(registarMateriais).toHaveBeenCalledWith(
        "doador@example.com",
        ["Armações: Armações partidas", "Outros: Película colorida transparente", "Outros: Fita adesiva"],
        "Benguela",
        "duas caixas",
      ),
    );
  });

  it("\"Outro material\" exige uma descrição no campo de detalhes", async () => {
    const user = userEvent.setup();
    render(<Apoiar />, { wrapper: MemoryRouter });

    await escolherItens(user, /Outros/i, [/Outro material/i]);
    await user.click(screen.getByRole("button", { name: /^Confirmar Doação de Materiais$/ }));

    expect(toastError).toHaveBeenCalledWith("Descreva o outro material no campo de detalhes adicionais.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("o separador de materiais não fala de óculos 3D", async () => {
    const user = userEvent.setup();
    render(<Apoiar />, { wrapper: MemoryRouter });

    expect(screen.queryByText(/3D/)).not.toBeInTheDocument();
    for (const categoria of [/Armações/i, /Tampões/i, /Outros/i]) {
      await user.click(screen.getByRole("button", { name: categoria }));
      const painel = await screen.findByRole("dialog");
      expect(within(painel).queryByText(/3D/)).not.toBeInTheDocument();
      await user.click(within(painel).getByRole("button", { name: /^Fechar$/ }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    }
  });
});
