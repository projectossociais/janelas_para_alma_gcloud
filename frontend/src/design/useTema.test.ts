import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { lerPreferencia, useTema } from "./useTema";

const simularSistema = (escuro: boolean) => {
  const ouvintes: (() => void)[] = [];
  const consulta = {
    matches: escuro,
    addEventListener: (_: string, f: () => void) => ouvintes.push(f),
    removeEventListener: vi.fn(),
  };
  window.matchMedia = vi.fn(() => consulta) as unknown as typeof window.matchMedia;
  return {
    mudar(novo: boolean) {
      consulta.matches = novo;
      ouvintes.forEach((f) => f());
    },
  };
};

describe("useTema", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.tema;
  });
  afterEach(() => vi.restoreAllMocks());

  it("por omissão segue o sistema e não marca o <html>", () => {
    simularSistema(true);
    const { result } = renderHook(() => useTema());
    expect(result.current.preferencia).toBe("sistema");
    expect(result.current.efectivo).toBe("escuro");
    expect(document.documentElement.dataset.tema).toBeUndefined();
  });

  it("escolher escuro marca o <html> e fica guardado para a próxima visita", () => {
    simularSistema(false);
    const { result } = renderHook(() => useTema());
    act(() => result.current.definir("escuro"));
    expect(document.documentElement.dataset.tema).toBe("escuro");
    expect(result.current.efectivo).toBe("escuro");
    expect(lerPreferencia()).toBe("escuro");
  });

  it("voltar a 'sistema' limpa a escolha guardada e o atributo", () => {
    simularSistema(false);
    const { result } = renderHook(() => useTema());
    act(() => result.current.definir("claro"));
    act(() => result.current.definir("sistema"));
    expect(document.documentElement.dataset.tema).toBeUndefined();
    expect(lerPreferencia()).toBe("sistema");
  });

  it("em 'sistema', acompanha a mudança do sistema operativo", () => {
    const sistema = simularSistema(false);
    const { result } = renderHook(() => useTema());
    expect(result.current.efectivo).toBe("claro");
    act(() => sistema.mudar(true));
    expect(result.current.efectivo).toBe("escuro");
  });

  it("sem acesso ao armazenamento (modo privado), funciona só nesta visita, sem rebentar", () => {
    simularSistema(false);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    const { result } = renderHook(() => useTema());
    expect(result.current.preferencia).toBe("sistema");
    act(() => result.current.definir("escuro"));
    expect(result.current.efectivo).toBe("escuro");
  });
});
