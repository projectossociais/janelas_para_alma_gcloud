import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

// Validação instantânea do comprovativo: nunca mostrar sucesso a partir de
// um `catch` (CLAUDE.md §6) -- só quando a API responde "aprovado". Cada
// passo (assinar, enviar ao R2, validar) tem o caminho do erro testado.

const prepararComprovativo = vi.fn();
const enviarParaStorage = vi.fn();
const validarComprovativo = vi.fn();
const recarregarAcesso = vi.fn();
const recarregarPerfil = vi.fn();
let sessao = true;

vi.mock("@/lib/apiClient", () => ({
  pagamentosApi: {
    prepararComprovativo: (...a: unknown[]) => prepararComprovativo(...a),
    enviarParaStorage: (...a: unknown[]) => enviarParaStorage(...a),
    validarComprovativo: (...a: unknown[]) => validarComprovativo(...a),
  },
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isLoggedIn: sessao }) }));
vi.mock("@/contexts/ProfileContext", () => ({ useProfile: () => ({ refetch: () => recarregarPerfil() }) }));
vi.mock("@/contexts/AcessoExerciciosContext", () => ({
  useAcessoExercicios: () => ({ refetch: () => recarregarAcesso() }),
}));

import CheckoutInstantaneo from "./CheckoutInstantaneo";

const OndeEstou = () => <p data-testid="onde">{useLocation().pathname}</p>;

const montar = () =>
  render(
    <MemoryRouter initialEntries={["/registo-premium"]}>
      <Routes>
        <Route path="/registo-premium" element={<CheckoutInstantaneo onVoltar={() => {}} />} />
        <Route path="*" element={<OndeEstou />} />
      </Routes>
    </MemoryRouter>,
  );

const pdf = () => new File(["%PDF-1.4"], "comprovativo.pdf", { type: "application/pdf" });

async function enviar(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(screen.getByTestId("file-input"), pdf());
  await user.click(screen.getByRole("button", { name: /Validar Comprovativo e Liberar Acesso/i }));
}

const APROVADO = {
  id: "c-1",
  estado: "aprovado",
  motivo_codigo: null,
  motivo: null,
  referencia_transacao: "202610140001234",
  montante_kz: "15000.00",
  premium_expira_em: "2026-11-13T08:30:00Z",
};

describe("CheckoutInstantaneo", () => {
  beforeEach(() => {
    sessao = true;
    for (const f of [prepararComprovativo, enviarParaStorage, validarComprovativo, recarregarAcesso, recarregarPerfil]) {
      f.mockReset();
    }
    prepararComprovativo.mockResolvedValue({ url_de_upload: "https://r2.test/put", chave: "comprovativos-pagamento/u/x.pdf" });
    enviarParaStorage.mockResolvedValue(undefined);
  });

  it("mostra o valor, os dados bancários com botão de copiar e as instruções", () => {
    montar();
    expect(screen.getByText("15.000,00 Kz / mês")).toBeInTheDocument();
    expect(screen.getByText("AO06 0040 0000 9103 4094 1018 9")).toBeInTheDocument();
    expect(screen.getByText("+244 946 538 507")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Copiar/i })).toHaveLength(3);
    expect(screen.getByText(/de qualquer banco \(BAI, BFA, BIC, Atlântico/)).toBeInTheDocument();
  });

  it("aprovado: mostra a operação e a validade, recarrega o acesso e abre os exercícios em 2 segundos", async () => {
    validarComprovativo.mockResolvedValue(APROVADO);
    const user = userEvent.setup();
    montar();
    await enviar(user);

    expect(await screen.findByText("Pagamento confirmado!")).toBeInTheDocument();
    expect(screen.getByText("202610140001234")).toBeInTheDocument();
    expect(screen.getByText("13/11/2026")).toBeInTheDocument();
    expect(prepararComprovativo).toHaveBeenCalledWith("application/pdf");
    expect(enviarParaStorage).toHaveBeenCalledWith("https://r2.test/put", expect.any(File));
    expect(validarComprovativo).toHaveBeenCalledWith("comprovativos-pagamento/u/x.pdf");
    expect(recarregarAcesso).toHaveBeenCalled();
    expect(recarregarPerfil).toHaveBeenCalled();

    await waitFor(() => expect(screen.getByTestId("onde")).toHaveTextContent("/exercicios"), { timeout: 3000 });
  });

  it("revisão manual: diz que a equipa vai confirmar, sem ecrã de sucesso", async () => {
    validarComprovativo.mockResolvedValue({ ...APROVADO, estado: "revisao_manual", premium_expira_em: null });
    const user = userEvent.setup();
    montar();
    await enviar(user);

    expect(await screen.findByText("Comprovativo recebido")).toBeInTheDocument();
    expect(screen.queryByText("Pagamento confirmado!")).not.toBeInTheDocument();
    expect(recarregarAcesso).not.toHaveBeenCalled();
  });

  it("rejeitado: mostra o motivo exacto da API e deixa tentar outra vez", async () => {
    validarComprovativo.mockRejectedValue(
      Object.assign(new Error("Valor inferior ao da subscrição: o comprovativo mostra 5.000,00 Kz e são precisos 15.000,00 Kz."), { status: 422 }),
    );
    const user = userEvent.setup();
    montar();
    await enviar(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("5.000,00 Kz");
    expect(screen.queryByText("Pagamento confirmado!")).not.toBeInTheDocument();
    expect(recarregarAcesso).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Validar Comprovativo e Liberar Acesso/i })).toBeEnabled();
  });

  it("se o envio ao storage falhar, nem chega a pedir a validação", async () => {
    enviarParaStorage.mockRejectedValue(Object.assign(new Error("storage em baixo"), { status: 500 }));
    const user = userEvent.setup();
    montar();
    await enviar(user);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(validarComprovativo).not.toHaveBeenCalled();
    expect(screen.queryByText("Pagamento confirmado!")).not.toBeInTheDocument();
  });

  it("sem resposta da API, mostra uma mensagem genérica (nunca sucesso)", async () => {
    prepararComprovativo.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    montar();
    await enviar(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível validar o comprovativo");
  });

  it("aceita uma captura de ecrã e pede o upload com o tipo da imagem", async () => {
    validarComprovativo.mockResolvedValue(APROVADO);
    const user = userEvent.setup();
    montar();
    expect(screen.getByTestId("file-input").getAttribute("accept")).toContain("image/png");
    expect(screen.getByText(/captura de ecrã \(screenshot\) do pagamento/)).toBeInTheDocument();

    await user.upload(screen.getByTestId("file-input"), new File(["png"], "ecra.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: /Validar Comprovativo e Liberar Acesso/i }));

    expect(await screen.findByText("Pagamento confirmado!")).toBeInTheDocument();
    expect(prepararComprovativo).toHaveBeenCalledWith("image/png");
  });

  it("recusa ficheiros que não são PDF nem imagem", async () => {
    const user = userEvent.setup({ applyAccept: false });
    montar();
    await user.upload(screen.getByTestId("file-input"), new File(["x"], "doc.zip", { type: "application/zip" }));
    expect(screen.getByRole("button", { name: /Validar Comprovativo e Liberar Acesso/i })).toBeDisabled();
  });

  it("sem sessão: pede para entrar na conta e não deixa validar", () => {
    sessao = false;
    montar();
    expect(screen.getByRole("link", { name: "Entrar na conta" })).toHaveAttribute("href", "/auth?next=/registo-premium");
    expect(screen.queryByTestId("file-input")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Validar Comprovativo e Liberar Acesso/i })).toBeDisabled();
  });
});
