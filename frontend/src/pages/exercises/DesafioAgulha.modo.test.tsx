import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DesafioAgulha from "./DesafioAgulha";
import ptAO from "@/i18n/locales/pt-AO.json";

// Com ou sem óculos 3D (2026-11-11): a pergunta só aparece enquanto não há
// escolha guardada neste aparelho; depois abre directo, e troca-se por um link.

const V = ptAO.Visao;

vi.mock("@/components/visao/PaginaExercicio", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/exercises/BaseExercise", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("./TesteEstereopsia", () => ({
  default: ({ aoTrocarModo }: { aoTrocarModo: () => void }) => <button onClick={aoTrocarModo}>TESTE 3D</button>,
}));

const CHAVE = "jpa.visao.estereopsia.oculos";
beforeEach(() => window.localStorage.clear());

describe("Desafio da Agulha: com ou sem óculos 3D", () => {
  it("na primeira vez pergunta, com 'sem óculos' marcado, e guarda a escolha", () => {
    render(<DesafioAgulha />);
    expect(screen.getAllByRole("radio")[0]).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("button", { name: V.continuar }));
    expect(screen.getByText(V.agulhaComoTitulo)).toBeInTheDocument();
    expect(window.localStorage.getItem(CHAVE)).toBe("sem");
  });

  it("com a escolha guardada, abre directo nesse modo, sem voltar a perguntar", () => {
    window.localStorage.setItem(CHAVE, "sem");
    render(<DesafioAgulha />);
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByText(V.agulhaComoTitulo)).toBeInTheDocument();
  });

  it("o link troca de modo nos dois sentidos e a troca fica guardada", () => {
    window.localStorage.setItem(CHAVE, "sem");
    render(<DesafioAgulha />);
    fireEvent.click(screen.getByRole("button", { name: V.trocarParaOculos3D }));
    expect(window.localStorage.getItem(CHAVE)).toBe("com");
    fireEvent.click(screen.getByRole("button", { name: "TESTE 3D" }));
    expect(screen.getByText(V.agulhaComoTitulo)).toBeInTheDocument();
    expect(window.localStorage.getItem(CHAVE)).toBe("sem");
  });
});
