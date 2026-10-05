import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ptAO from "@/i18n/locales/pt-AO.json";

const estado = vi.fn();
const dar = vi.fn();
const retirar = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  consentimentoSaudeApi: {
    estado: (...a: unknown[]) => estado(...a),
    dar: (...a: unknown[]) => dar(...a),
    retirar: (...a: unknown[]) => retirar(...a),
  },
  mensagemDeErroApi: (_err: unknown, fallback: string) => fallback,
}));

let mockLogado = true;
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoggedIn: mockLogado, loading: false }),
}));

import { ConsentimentoSaudeProvider, useConsentimentoSaude } from "./ConsentimentoSaudeContext";

const T = ptAO.ConsentimentoSaude;
const ESTADO_SEM = { consentido: false, versao_actual: "2026-09-30", versao_aceite: null, aceite_em: null, representa_menor: false };
const ESTADO_COM = { ...ESTADO_SEM, consentido: true, versao_aceite: "2026-09-30", aceite_em: "2026-09-30T10:00:00Z" };

let ctx: ReturnType<typeof useConsentimentoSaude> | null = null;
const Consumidor = () => {
  ctx = useConsentimentoSaude();
  return <span data-testid="estado">{ctx.carregando ? "a carregar" : ctx.consentido ? "sim" : "não"}</span>;
};

const montar = () =>
  render(
    <MemoryRouter>
      <ConsentimentoSaudeProvider>
        <Consumidor />
      </ConsentimentoSaudeProvider>
    </MemoryRouter>,
  );

/** Chama `garantir()` e devolve a promessa, para o teste decidir o que fazer no diálogo. */
const pedir = () => {
  let p!: Promise<boolean>;
  act(() => {
    p = ctx!.garantir();
  });
  return p;
};

describe("ConsentimentoSaudeContext (Lei 22/11, dados de saúde)", () => {
  beforeEach(() => {
    estado.mockReset();
    dar.mockReset();
    retirar.mockReset();
    mockLogado = true;
    ctx = null;
  });

  it("com consentimento já dado, garantir resolve logo e não abre nada", async () => {
    estado.mockResolvedValue(ESTADO_COM);
    montar();
    await waitFor(() => expect(screen.getByTestId("estado")).toHaveTextContent("sim"));
    await expect(pedir()).resolves.toBe(true);
    expect(screen.queryByText(T.titulo)).not.toBeInTheDocument();
  });

  it("não deixa aceitar sem declarar a maioridade e autorizar", async () => {
    estado.mockResolvedValue(ESTADO_SEM);
    const user = userEvent.setup();
    montar();
    await waitFor(() => expect(screen.getByTestId("estado")).toHaveTextContent("não"));
    void pedir();
    const aceitar = await screen.findByRole("button", { name: T.aceitarEContinuar });
    expect(aceitar).toBeDisabled();
    await user.click(screen.getByText(T.declaroMaioridade));
    expect(aceitar).toBeDisabled();
    await user.click(screen.getByText(T.autorizo));
    expect(aceitar).toBeEnabled();
  });

  it("com sessão, grava na API e só depois resolve true", async () => {
    estado.mockResolvedValue(ESTADO_SEM);
    dar.mockResolvedValue({ ...ESTADO_COM, representa_menor: true });
    const user = userEvent.setup();
    montar();
    await waitFor(() => expect(screen.getByTestId("estado")).toHaveTextContent("não"));
    const resultado = pedir();
    await user.click(await screen.findByText(T.declaroMaioridade));
    await user.click(screen.getByText(T.representaMenor));
    await user.click(screen.getByText(T.autorizo));
    await user.click(screen.getByRole("button", { name: T.aceitarEContinuar }));
    await expect(resultado).resolves.toBe(true);
    expect(dar).toHaveBeenCalledWith({ declara_maioridade: true, aceita_tratamento: true, representa_menor: true });
    expect(screen.getByTestId("estado")).toHaveTextContent("sim");
  });

  describe("que combinações deixam aceitar (pedido do dono do projecto, 2026-10-05)", () => {
    // Regra: (tenho 18 anos OU sou representante legal, que também declara a
    // maioridade) E autorizo. Um adulto sem filhos marca 1 e 3; um pai marca 2 e 3.
    const abrir = async () => {
      estado.mockResolvedValue(ESTADO_SEM);
      const user = userEvent.setup();
      montar();
      await waitFor(() => expect(screen.getByTestId("estado")).toHaveTextContent("não"));
      void pedir();
      await screen.findByText(T.declaroMaioridade);
      return user;
    };
    const aceitar = () => screen.getByRole("button", { name: T.aceitarEContinuar });

    it("representante legal (2) + autorizo (3) deixa aceitar, e grava a maioridade e a representação", async () => {
      dar.mockResolvedValue({ ...ESTADO_COM, representa_menor: true });
      const user = await abrir();
      await user.click(screen.getByText(T.representaMenor));
      await user.click(screen.getByText(T.autorizo));
      expect(aceitar()).toBeEnabled();
      await user.click(aceitar());
      expect(dar).toHaveBeenCalledWith({ declara_maioridade: true, aceita_tratamento: true, representa_menor: true });
    });

    it("adulto (1) + autorizo (3) deixa aceitar, sem representação", async () => {
      dar.mockResolvedValue(ESTADO_COM);
      const user = await abrir();
      await user.click(screen.getByText(T.declaroMaioridade));
      await user.click(screen.getByText(T.autorizo));
      await user.click(aceitar());
      expect(dar).toHaveBeenCalledWith({ declara_maioridade: true, aceita_tratamento: true, representa_menor: false });
    });

    it("sem 'autorizo' (3) nunca deixa aceitar, mesmo com 1 e 2", async () => {
      const user = await abrir();
      await user.click(screen.getByText(T.declaroMaioridade));
      await user.click(screen.getByText(T.representaMenor));
      expect(aceitar()).toBeDisabled();
    });

    it("só 'autorizo' (3), sem dizer quem é, não deixa aceitar", async () => {
      const user = await abrir();
      await user.click(screen.getByText(T.autorizo));
      expect(aceitar()).toBeDisabled();
    });
  });

  it("se a API falhar, mostra o erro, não fecha e nunca resolve true", async () => {
    estado.mockResolvedValue(ESTADO_SEM);
    dar.mockRejectedValue(new Error("rede"));
    const user = userEvent.setup();
    montar();
    await waitFor(() => expect(screen.getByTestId("estado")).toHaveTextContent("não"));
    let resolvido: boolean | null = null;
    void pedir().then((v) => (resolvido = v));
    await user.click(await screen.findByText(T.declaroMaioridade));
    await user.click(screen.getByText(T.autorizo));
    await user.click(screen.getByRole("button", { name: T.aceitarEContinuar }));
    expect(await screen.findByRole("alert")).toHaveTextContent(T.erroAoGravar);
    expect(screen.getByText(T.titulo)).toBeInTheDocument();
    expect(resolvido).toBeNull();
    expect(screen.getByTestId("estado")).toHaveTextContent("não");
  });

  it("'Agora não' resolve false e nada é gravado", async () => {
    estado.mockResolvedValue(ESTADO_SEM);
    const user = userEvent.setup();
    montar();
    await waitFor(() => expect(screen.getByTestId("estado")).toHaveTextContent("não"));
    const resultado = pedir();
    await user.click(await screen.findByRole("button", { name: T.agoraNao }));
    await expect(resultado).resolves.toBe(false);
    expect(dar).not.toHaveBeenCalled();
  });

  it("sem sessão (rastreio anónimo), pede na mesma mas não chama a API", async () => {
    mockLogado = false;
    const user = userEvent.setup();
    montar();
    await waitFor(() => expect(screen.getByTestId("estado")).toHaveTextContent("não"));
    expect(estado).not.toHaveBeenCalled();
    const resultado = pedir();
    await user.click(await screen.findByText(T.declaroMaioridade));
    await user.click(screen.getByText(T.autorizo));
    await user.click(screen.getByRole("button", { name: T.aceitarEContinuar }));
    await expect(resultado).resolves.toBe(true);
    expect(dar).not.toHaveBeenCalled();
  });

  it("se não conseguir ler o estado, conta como não consentido (nunca presume)", async () => {
    estado.mockRejectedValue(new Error("rede"));
    montar();
    await waitFor(() => expect(screen.getByTestId("estado")).toHaveTextContent("não"));
  });
});
