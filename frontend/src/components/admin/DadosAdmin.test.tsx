import { describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EstadoDadosAdmin } from "./DadosAdmin";
import { useDadosAdmin } from "./useDadosAdmin";

vi.mock("@/lib/apiClient", () => ({
  mensagemDeErroApi: (err: unknown, fallback: string) => (err as { message?: string })?.message || fallback,
}));

describe("useDadosAdmin", () => {
  it("separa 'a carregar', 'erro' e dados -- uma falha nunca vira uma lista vazia", async () => {
    const carregar = vi.fn().mockRejectedValueOnce(new Error("Sem permissões")).mockResolvedValueOnce([1, 2]);
    const { result } = renderHook(() => useDadosAdmin(carregar, "falhou", []));

    expect(result.current.aCarregar).toBe(true);
    await waitFor(() => expect(result.current.erro).toBe("Sem permissões"));
    expect(result.current.dados).toBeNull();

    await act(async () => result.current.recarregar());
    expect(result.current.erro).toBeNull();
    expect(result.current.dados).toEqual([1, 2]);
  });

  it("um pedido antigo que responde depois não substitui o actual", async () => {
    let resolverAntigo: (v: string) => void = () => {};
    const antigo = new Promise<string>((r) => (resolverAntigo = r));
    let chamada = 0;
    const carregar = () => (++chamada === 1 ? antigo : Promise.resolve("novo"));
    const { result, rerender } = renderHook(({ p }) => useDadosAdmin(carregar, "x", [p]), { initialProps: { p: 1 } });

    rerender({ p: 2 });
    await waitFor(() => expect(result.current.dados).toBe("novo"));
    await act(async () => resolverAntigo("antigo"));
    expect(result.current.dados).toBe("novo");
  });
});

describe("EstadoDadosAdmin", () => {
  it("com erro: diz o motivo e deixa tentar de novo, sem mostrar os dados", async () => {
    const tentar = vi.fn();
    render(
      <EstadoDadosAdmin aCarregar={false} erro="Sem permissões" aoTentarDeNovo={tentar} temDados={false}>
        <p>Sem utilizadores.</p>
      </EstadoDadosAdmin>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Sem permissões");
    expect(screen.queryByText("Sem utilizadores.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(tentar).toHaveBeenCalledTimes(1);
  });

  it("a carregar: diz que está a carregar e não mostra nada inventado", () => {
    render(
      <EstadoDadosAdmin aCarregar erro={null} aoTentarDeNovo={() => {}} temDados={false}>
        <p>0</p>
      </EstadoDadosAdmin>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("A carregar");
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
