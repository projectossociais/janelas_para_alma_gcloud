import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Carrossel } from "./Carrossel";
import { violacoesAcessibilidade } from "../testes/acessibilidade";

const TEXTOS = { anterior: "Parceiro anterior", seguinte: "Parceiro seguinte", parar: "Parar a passagem", retomar: "Retomar a passagem" };
const ITENS = ["A", "B", "C", "D", "E"].map((n) => <span key={n}>Parceiro {n}</span>);

/** O jsdom não faz layout: simula uma faixa de 300 px com 5 itens de 160 px. */
function simularLayout({ transborda }: { transborda: boolean }) {
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", { configurable: true, get: () => (transborda ? 880 : 300) });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 300 });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 160 });
}

let scrollTo: ReturnType<typeof vi.fn>;
let reduzir = false;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  reduzir = false;
  scrollTo = vi.fn();
  HTMLElement.prototype.scrollTo = scrollTo as unknown as typeof HTMLElement.prototype.scrollTo;
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q.includes("reduce") ? reduzir : false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => vi.useRealTimers());

const montar = () => render(<Carrossel itens={ITENS} rotulo="Parceiros" textos={TEXTOS} />);

describe("Carrossel", () => {
  it("é uma região com nome e todos os itens", () => {
    simularLayout({ transborda: true });
    montar();
    expect(screen.getByRole("region", { name: "Parceiros" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });

  it("passa sozinho a cada 3 segundos", () => {
    simularLayout({ transborda: true });
    montar();
    act(() => vi.advanceTimersByTime(3000));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(3000));
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it("setas avançam e recuam", async () => {
    simularLayout({ transborda: true });
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    montar();
    await u.click(screen.getByRole("button", { name: TEXTOS.seguinte }));
    await u.click(screen.getByRole("button", { name: TEXTOS.anterior }));
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it("o botão de pausa pára a passagem automática (WCAG 2.2.2) e retoma-a", async () => {
    simularLayout({ transborda: true });
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    montar();
    await u.click(screen.getByRole("button", { name: TEXTOS.parar }));
    scrollTo.mockClear();
    act(() => vi.advanceTimersByTime(9000));
    expect(scrollTo).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: TEXTOS.retomar })).toBeInTheDocument();
  });

  it("pára enquanto a pessoa lhe toca ou passa o rato", () => {
    simularLayout({ transborda: true });
    montar();
    fireEvent.pointerOver(screen.getByRole("region"));
    act(() => vi.advanceTimersByTime(9000));
    expect(scrollTo).not.toHaveBeenCalled();

    fireEvent.pointerOut(screen.getByRole("region"));
    fireEvent.touchStart(screen.getByRole("region"));
    act(() => vi.advanceTimersByTime(9000));
    expect(scrollTo).not.toHaveBeenCalled();

    fireEvent.touchEnd(screen.getByRole("region"));
    act(() => vi.advanceTimersByTime(3000));
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it("com 'reduzir movimento', não passa sozinho nem mostra a pausa", () => {
    reduzir = true;
    simularLayout({ transborda: true });
    montar();
    act(() => vi.advanceTimersByTime(9000));
    expect(scrollTo).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: TEXTOS.parar })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: TEXTOS.seguinte })).toBeInTheDocument();
  });

  it("quando tudo cabe, não há nada para passar: sem setas nem pausa", () => {
    simularLayout({ transborda: false });
    montar();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(9000));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("com comPausa={false}, não há botão de pausa mas continua a passar e a ter setas", () => {
    simularLayout({ transborda: true });
    render(<Carrossel itens={ITENS} rotulo="Parceiros" textos={TEXTOS} comPausa={false} />);
    expect(screen.queryByRole("button", { name: TEXTOS.parar })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: TEXTOS.seguinte })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it("sem violações de acessibilidade", async () => {
    vi.useRealTimers();
    simularLayout({ transborda: true });
    const { container } = montar();
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
