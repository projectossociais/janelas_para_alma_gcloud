import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";

const obterPerfil = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  jogoApi: { obterPerfil: (...a: unknown[]) => obterPerfil(...a) },
}));

let mockProfile: { id: string } | null = null;
vi.mock("@/contexts/ProfileContext", () => ({ useProfile: () => ({ profile: mockProfile }) }));

import { CarteiraJogoProvider, useCarteiraJogo } from "./CarteiraJogoContext";

let ctxAtual: ReturnType<typeof useCarteiraJogo> | null = null;
const Consumidor = () => {
  ctxAtual = useCarteiraJogo();
  return <span data-testid="diamantes">{ctxAtual.perfil?.diamantes ?? "-"}</span>;
};

const PERFIL = { moedas: 10, diamantes: 3, partidas_jogadas: 1, patamar_maximo_alcancado: 1 };

describe("CarteiraJogoContext", () => {
  beforeEach(() => {
    obterPerfil.mockReset();
    mockProfile = { id: "u1" };
    ctxAtual = null;
  });

  it("não pede o perfil de jogo enquanto nenhuma página do jogo o usa", async () => {
    render(
      <CarteiraJogoProvider>
        <p>página qualquer</p>
      </CarteiraJogoProvider>
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(obterPerfil).not.toHaveBeenCalled();
  });

  it("carrega o perfil quando um consumidor aparece", async () => {
    obterPerfil.mockResolvedValue(PERFIL);
    render(
      <CarteiraJogoProvider>
        <Consumidor />
      </CarteiraJogoProvider>
    );
    await waitFor(() => expect(screen.getByTestId("diamantes")).toHaveTextContent("3"));
    expect(obterPerfil).toHaveBeenCalledTimes(1);
  });

  it("sem sessão não pede nada e o saldo fica vazio", async () => {
    mockProfile = null;
    render(
      <CarteiraJogoProvider>
        <Consumidor />
      </CarteiraJogoProvider>
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(obterPerfil).not.toHaveBeenCalled();
    expect(screen.getByTestId("diamantes")).toHaveTextContent("-");
  });

  it("definirPerfil substitui o saldo e ganha a uma resposta antiga que chegue depois", async () => {
    let resolverAntigo: (p: typeof PERFIL) => void = () => {};
    obterPerfil.mockReturnValue(new Promise((r) => (resolverAntigo = r)));
    render(
      <CarteiraJogoProvider>
        <Consumidor />
      </CarteiraJogoProvider>
    );
    await waitFor(() => expect(obterPerfil).toHaveBeenCalled());

    act(() => ctxAtual!.definirPerfil({ ...PERFIL, diamantes: 99 }));
    expect(screen.getByTestId("diamantes")).toHaveTextContent("99");

    await act(async () => resolverAntigo(PERFIL));
    expect(screen.getByTestId("diamantes")).toHaveTextContent("99");
  });

  it("uma falha da API marca erro sem rebentar", async () => {
    obterPerfil.mockRejectedValue(new Error("rede"));
    const erroConsola = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <CarteiraJogoProvider>
        <Consumidor />
      </CarteiraJogoProvider>
    );
    await waitFor(() => expect(ctxAtual!.erro).toBe(true));
    expect(screen.getByTestId("diamantes")).toHaveTextContent("-");
    erroConsola.mockRestore();
  });
});
