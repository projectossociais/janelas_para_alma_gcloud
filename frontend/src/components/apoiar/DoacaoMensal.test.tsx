import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// Doação mensal: o estatuto só aparece depois de a API confirmar, e um
// comprovativo nunca é "recebido" se algum dos três passos falhar
// (CLAUDE.md, "Nunca mostrar sucesso antes de verificar error/excepção").

const meu = vi.fn();
const aderir = vi.fn();
const enviarComprovativo = vi.fn();
const cancelar = vi.fn();
const preparar = vi.fn();
const enviarParaStorage = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  apoiosMensaisApi: {
    meu: (...a: unknown[]) => meu(...a),
    aderir: (...a: unknown[]) => aderir(...a),
    enviarComprovativo: (...a: unknown[]) => enviarComprovativo(...a),
    cancelar: (...a: unknown[]) => cancelar(...a),
  },
  comprovativosApi: {
    preparar: (...a: unknown[]) => preparar(...a),
    enviarParaStorage: (...a: unknown[]) => enviarParaStorage(...a),
  },
  TIPOS_DE_COMPROVATIVO_ACEITES: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));

const useAuthMock = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => useAuthMock() }));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

import DoacaoMensal from "./DoacaoMensal";

const APOIO = {
  id: "apoio-1",
  valor_mensal_kz: 15000,
  estado: "ativo",
  criado_em: "2026-10-01T10:00:00Z",
  ultimo_comprovativo_em: null,
  meses_com_comprovativo: 0,
  renovacao_em_falta: false,
};

const renderizar = () => render(<DoacaoMensal />, { wrapper: MemoryRouter });

describe("DoacaoMensal", () => {
  beforeEach(() => {
    [meu, aderir, enviarComprovativo, cancelar, preparar, enviarParaStorage, toastSuccess, toastError].forEach((f) =>
      f.mockReset(),
    );
    useAuthMock.mockReturnValue({ isLoggedIn: true, loading: false });
  });

  it("sem sessão mostra os níveis e pede para entrar, voltando depois à doação mensal", () => {
    useAuthMock.mockReturnValue({ isLoggedIn: false, loading: false });
    renderizar();

    expect(screen.getByRole("radio", { name: /^5\.000 Kz/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /30\.000 Kz/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Entrar para continuar/ })).toHaveAttribute(
      "href",
      `/auth?next=${encodeURIComponent("/apoiar?modo=mensal")}`,
    );
    expect(meu).not.toHaveBeenCalled();
  });

  it("adere com o nível escolhido e só depois mostra o estatuto", async () => {
    meu.mockResolvedValue(null);
    aderir.mockResolvedValue({ ...APOIO, valor_mensal_kz: 30000 });
    const user = userEvent.setup();
    renderizar();

    await user.click(await screen.findByRole("radio", { name: /30\.000 Kz/ }));
    await user.click(screen.getByRole("button", { name: /Tornar-me Kamba Mensal com 30\.000 Kz/ }));

    expect(aderir).toHaveBeenCalledWith(30000);
    expect(await screen.findByText("Kamba Mensal · Apoiador Mensal")).toBeInTheDocument();
  });

  it("um valor personalizado abaixo do mínimo não deixa aderir", async () => {
    meu.mockResolvedValue(null);
    const user = userEvent.setup();
    renderizar();

    await user.click(await screen.findByRole("radio", { name: /Outro valor/ }));
    await user.type(screen.getByLabelText(/Valor por mês/), "500");

    expect(screen.getByRole("button", { name: /Escolha um valor/ })).toBeDisabled();
  });

  it("se a adesão falha, não mostra estatuto nenhum", async () => {
    meu.mockResolvedValue(null);
    aderir.mockRejectedValue(Object.assign(new Error("esta conta já tem um apoio mensal activo"), { status: 409 }));
    const user = userEvent.setup();
    renderizar();

    await user.click(await screen.findByRole("button", { name: /Tornar-me Kamba Mensal/ }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("esta conta já tem um apoio mensal activo"));
    expect(screen.queryByText("Kamba Mensal · Apoiador Mensal")).not.toBeInTheDocument();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("com apoio activo mostra o estatuto e o mês em falta", async () => {
    meu.mockResolvedValue({ ...APOIO, renovacao_em_falta: true, meses_com_comprovativo: 3 });
    renderizar();

    expect(await screen.findByText("Kamba Mensal · Apoiador Mensal")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Já passou um mês/);
  });

  it("nunca diz 'recebido' quando o envio ao storage falha", async () => {
    meu.mockResolvedValue(APOIO);
    preparar.mockResolvedValue({ url_de_upload: "https://r2.test/put", chave: "comprovativos/x.pdf" });
    enviarParaStorage.mockRejectedValue(new Error("rede"));
    const user = userEvent.setup();
    const { container } = renderizar();
    await screen.findByText("Kamba Mensal · Apoiador Mensal");

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(["%PDF"], "comprovativo.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: /Enviar comprovativo do mês/ }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(enviarComprovativo).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("com o comprovativo gravado, conta o mês", async () => {
    meu.mockResolvedValue(APOIO);
    preparar.mockResolvedValue({ url_de_upload: "https://r2.test/put", chave: "comprovativos/x.pdf" });
    enviarParaStorage.mockResolvedValue(undefined);
    enviarComprovativo.mockResolvedValue({
      ...APOIO,
      meses_com_comprovativo: 1,
      ultimo_comprovativo_em: "2026-10-26T10:00:00Z",
    });
    const user = userEvent.setup();
    const { container } = renderizar();
    await screen.findByText("Kamba Mensal · Apoiador Mensal");

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(["%PDF"], "comprovativo.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: /Enviar comprovativo do mês/ }));

    expect(enviarComprovativo).toHaveBeenCalledWith("comprovativos/x.pdf");
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(screen.getByText(/Meses com comprovativo enviado: 1/)).toBeInTheDocument();
  });
});
