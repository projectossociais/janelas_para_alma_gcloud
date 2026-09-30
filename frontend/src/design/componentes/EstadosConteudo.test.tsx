import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { EstadoVazio } from "./EstadoVazio";
import { Esqueleto, ZonaACarregar } from "./Esqueleto";
import { violacoesAcessibilidade } from "../testes/acessibilidade";

describe("EstadoVazio", () => {
  it("explica e dá o primeiro passo", () => {
    render(
      <EstadoVazio
        titulo="Ainda não fez nenhum treino"
        descricao="Comece pelo de 3 minutos."
        accao={<a href="/treinos">Começar</a>}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Ainda não fez nenhum treino" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Começar" })).toBeInTheDocument();
  });

  it("a imagem é decorativa", () => {
    const { container } = render(<EstadoVazio titulo="Vazio" imagem={<svg />} />);
    expect(container.querySelector("[aria-hidden='true'] svg")).toBeInTheDocument();
  });
});

describe("ZonaACarregar", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const montar = (aCarregar: boolean) => (
    <ZonaACarregar
      aCarregar={aCarregar}
      rotulo="A carregar os seus treinos"
      esqueleto={<Esqueleto className="h-6" />}
    >
      <p>Treino de Anéis</p>
    </ZonaACarregar>
  );

  it("a carregar: anuncia o estado e marca aria-busy, sem mostrar o esqueleto logo", () => {
    const { container } = render(montar(true));
    expect(screen.getByRole("status")).toHaveTextContent("A carregar os seus treinos");
    expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector(".animate-pulse, .motion-safe\\:animate-pulse")).toBeNull();
  });

  it("o esqueleto só aparece se a espera passar dos 300 ms (esperas curtas não piscam)", () => {
    const { container } = render(montar(true));
    act(() => vi.advanceTimersByTime(299));
    expect(container.querySelector("[aria-hidden='true']")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
  });

  it("quando chega, mostra o conteúdo e deixa de estar ocupada", () => {
    const { container, rerender } = render(montar(true));
    act(() => vi.advanceTimersByTime(500));
    rerender(montar(false));
    expect(screen.getByText("Treino de Anéis")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(container.firstElementChild).not.toHaveAttribute("aria-busy");
  });

  it("sem violações de acessibilidade (a carregar e carregado)", async () => {
    vi.useRealTimers();
    const { container, rerender } = render(montar(true));
    expect(await violacoesAcessibilidade(container)).toEqual([]);
    rerender(montar(false));
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
