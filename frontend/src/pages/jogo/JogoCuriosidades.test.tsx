import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const obterPerguntaAleatoria = vi.fn();
const validarResposta = vi.fn();
const registarRecompensa = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  jogoApi: {
    obterPerguntaAleatoria: (...a: unknown[]) => obterPerguntaAleatoria(...a),
    validarResposta: (...a: unknown[]) => validarResposta(...a),
    registarRecompensa: (...a: unknown[]) => registarRecompensa(...a),
  },
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/BackButton", () => ({ default: () => null }));

let mockProfile: { id: string } | null = null;
vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: mockProfile }),
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
}));

import JogoCuriosidades from "./JogoCuriosidades";

const PERGUNTA_1 = {
  id: "pergunta-1",
  texto_pergunta: "Qual destas é a opção certa?",
  opcao_a: "Errada A",
  opcao_b: "Certa B",
  opcao_c: "Errada C",
  opcao_d: "Errada D",
};

describe("JogoCuriosidades", () => {
  beforeEach(() => {
    obterPerguntaAleatoria.mockReset();
    validarResposta.mockReset();
    registarRecompensa.mockReset();
    registarRecompensa.mockResolvedValue({ moedas: 0, diamantes: 0, partidas_jogadas: 1, patamar_maximo_alcancado: 0 });
    toastError.mockReset();
    toastSuccess.mockReset();
    mockProfile = null;
  });

  it("busca a pergunta do patamar 1 ao montar e mostra as 4 opções", async () => {
    obterPerguntaAleatoria.mockResolvedValue(PERGUNTA_1);
    render(<JogoCuriosidades />, { wrapper: MemoryRouter });

    expect(await screen.findByText(PERGUNTA_1.texto_pergunta)).toBeInTheDocument();
    expect(obterPerguntaAleatoria).toHaveBeenCalledWith(1);
    expect(screen.getByText("Errada A")).toBeInTheDocument();
    expect(screen.getByText("Certa B")).toBeInTheDocument();
    expect(screen.getByText("Errada C")).toBeInTheDocument();
    expect(screen.getByText("Errada D")).toBeInTheDocument();
  });

  it("mostra um estado de erro amigável quando a API falha, com botão para reconectar", async () => {
    obterPerguntaAleatoria.mockRejectedValue(Object.assign(new Error("servidor em baixo"), { status: 500 }));
    render(<JogoCuriosidades />, { wrapper: MemoryRouter });

    expect(await screen.findByText("Sem ligação ao servidor")).toBeInTheDocument();
    expect(screen.getByText("servidor em baixo")).toBeInTheDocument();

    obterPerguntaAleatoria.mockResolvedValue(PERGUNTA_1);
    await userEvent.click(screen.getByRole("button", { name: /Tentar reconectar/i }));

    expect(await screen.findByText(PERGUNTA_1.texto_pergunta)).toBeInTheDocument();
    expect(obterPerguntaAleatoria).toHaveBeenCalledTimes(2);
  });

  it("ao errar, marca a opção escolhida a vermelho, a certa a verde, e abre o modal com a explicação", async () => {
    obterPerguntaAleatoria.mockResolvedValue(PERGUNTA_1);
    validarResposta.mockResolvedValue({
      correta: false,
      resposta_correta: "B",
      explicacao: "A explicação científica da resposta certa.",
    });
    render(<JogoCuriosidades />, { wrapper: MemoryRouter });
    await screen.findByText(PERGUNTA_1.texto_pergunta);

    await userEvent.click(screen.getByText("Errada A"));

    expect(validarResposta).toHaveBeenCalledWith("pergunta-1", "A");
    expect(await screen.findByText("Essa não era a resposta certa")).toBeInTheDocument();
    expect(screen.getByText("A explicação científica da resposta certa.")).toBeInTheDocument();
    expect(screen.getByText(/B\) Certa B/)).toBeInTheDocument();

    // fecha o modal reiniciando o jogo -- devolve o jogador ao patamar 1.
    obterPerguntaAleatoria.mockClear();
    obterPerguntaAleatoria.mockResolvedValue(PERGUNTA_1);
    await userEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));

    await waitFor(() => expect(obterPerguntaAleatoria).toHaveBeenCalledWith(1));
  });

  it("ao acertar, avança automaticamente para o patamar seguinte", async () => {
    obterPerguntaAleatoria.mockResolvedValue(PERGUNTA_1);
    validarResposta.mockResolvedValue({ correta: true, resposta_correta: "B", explicacao: null });
    render(<JogoCuriosidades />, { wrapper: MemoryRouter });
    await screen.findByText(PERGUNTA_1.texto_pergunta);

    await userEvent.click(screen.getByText("Certa B"));
    expect(validarResposta).toHaveBeenCalledWith("pergunta-1", "B");

    await waitFor(() => expect(obterPerguntaAleatoria).toHaveBeenCalledWith(2), { timeout: 2000 });
  });

  it("a ajuda 50:50 esconde exatamente duas opções erradas e fica desativada", async () => {
    obterPerguntaAleatoria.mockResolvedValue(PERGUNTA_1);
    validarResposta.mockResolvedValue({ correta: false, resposta_correta: "B", explicacao: null });
    render(<JogoCuriosidades />, { wrapper: MemoryRouter });
    await screen.findByText(PERGUNTA_1.texto_pergunta);

    const botao5050 = screen.getByRole("button", { name: "50:50" });
    await userEvent.click(botao5050);

    await waitFor(() => expect(botao5050).toBeDisabled());
    const opcaoA = screen.getByText("Errada A").closest("button");
    const opcaoB = screen.getByText("Certa B").closest("button");
    const opcaoC = screen.getByText("Errada C").closest("button");
    const opcaoD = screen.getByText("Errada D").closest("button");
    const desativadas = [opcaoA, opcaoC, opcaoD].filter((b) => b?.disabled).length;

    expect(opcaoB).not.toBeDisabled();
    expect(desativadas).toBe(2);
  });

  it("a opinião do público mostra 4 percentagens que somam 100, com a certa entre 55% e 75%", async () => {
    obterPerguntaAleatoria.mockResolvedValue(PERGUNTA_1);
    validarResposta.mockResolvedValue({ correta: false, resposta_correta: "B", explicacao: null });
    render(<JogoCuriosidades />, { wrapper: MemoryRouter });
    await screen.findByText(PERGUNTA_1.texto_pergunta);

    const botaoPublico = screen.getByRole("button", { name: /Opinião do público/i });
    await userEvent.click(botaoPublico);

    expect(await screen.findByRole("heading", { name: "Opinião do público" })).toBeInTheDocument();
    // As 4 percentagens (uma por opção, na ordem A/B/C/D) são os únicos
    // textos "NN%" na página.
    const percentagens = screen
      .getAllByText(/^\d+%$/)
      .map((el) => Number(el.textContent!.replace("%", "")));

    expect(percentagens).toHaveLength(4);
    expect(percentagens.reduce((a, b) => a + b, 0)).toBe(100);
    expect(percentagens[1]).toBeGreaterThanOrEqual(55); // opção B é a certa
    expect(percentagens[1]).toBeLessThanOrEqual(75);
    await waitFor(() => expect(botaoPublico).toBeDisabled());
  });

  it("com sessão iniciada, sincroniza a recompensa da derrota com o servidor", async () => {
    mockProfile = { id: "utilizador-1" };
    obterPerguntaAleatoria.mockResolvedValue(PERGUNTA_1);
    validarResposta.mockResolvedValue({ correta: false, resposta_correta: "B", explicacao: null });
    render(<JogoCuriosidades />, { wrapper: MemoryRouter });
    await screen.findByText(PERGUNTA_1.texto_pergunta);

    await userEvent.click(screen.getByText("Errada A"));

    // falhou logo no patamar 1 -- 0 patamares superados.
    await waitFor(() => expect(registarRecompensa).toHaveBeenCalledWith(0));
    expect(await screen.findByText("Prémio ganho")).toBeInTheDocument();
  });

  it("sem sessão, mostra o prémio localmente mas não tenta sincronizar", async () => {
    mockProfile = null;
    obterPerguntaAleatoria.mockResolvedValue(PERGUNTA_1);
    validarResposta.mockResolvedValue({ correta: false, resposta_correta: "B", explicacao: null });
    render(<JogoCuriosidades />, { wrapper: MemoryRouter });
    await screen.findByText(PERGUNTA_1.texto_pergunta);

    await userEvent.click(screen.getByText("Errada A"));

    expect(await screen.findByText("Prémio ganho")).toBeInTheDocument();
    expect(screen.getByText(/Inicie sessão para guardar/i)).toBeInTheDocument();
    expect(registarRecompensa).not.toHaveBeenCalled();
  });
});
