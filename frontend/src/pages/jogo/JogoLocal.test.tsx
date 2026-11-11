import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const iniciar = vi.fn();
const obterPergunta = vi.fn();
const responder = vi.fn();
const terminar = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  jogoLocalApi: {
    iniciar: (...a: unknown[]) => iniciar(...a),
    obterPergunta: (...a: unknown[]) => obterPergunta(...a),
    responder: (...a: unknown[]) => responder(...a),
    terminar: (...a: unknown[]) => terminar(...a),
  },
}));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/BackButton", () => ({ default: () => null }));

let mockProfile: { id: string } | null = null;
vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: mockProfile, loading: false }),
}));
const definirPerfil = vi.fn();
vi.mock("@/contexts/CarteiraJogoContext", () => ({
  useCarteiraJogo: () => ({ definirPerfil: (...a: unknown[]) => definirPerfil(...a) }),
}));

import JogoLocal from "./JogoLocal";
import { PERGUNTAS_OFFLINE_POR_PATAMAR } from "./perguntasOffline";
import { MAXIMO_DESEMPATES, RONDAS, TEMPO_POR_PERGUNTA_LOCAL } from "@/lib/jogo/partidaLocal";

const PERFIL = { moedas: 50, diamantes: 0, partidas_jogadas: 0, patamar_maximo_alcancado: 0 };

const montar = () =>
  render(
    <MemoryRouter>
      <JogoLocal />
    </MemoryRouter>
  );

/** A pergunta da reserva local que está no ecrã (procurada pelo texto). */
const perguntaLocalNoEcra = () => {
  const todas = Object.values(PERGUNTAS_OFFLINE_POR_PATAMAR).flat();
  const encontrada = todas.find((p) => screen.queryByText(p.texto_pergunta));
  if (!encontrada) throw new Error("nenhuma pergunta da reserva local no ecrã");
  return encontrada;
};

const opcao = (letra: string) => screen.getAllByRole("button").find((b) => b.textContent?.startsWith(letra))!;

const comecar = async (nomes: string[]) => {
  for (const [i, nome] of nomes.entries()) {
    if (nome) await userEvent.type(screen.getByLabelText(`Nome do jogador ${i + 1}`), nome);
  }
  await userEvent.click(screen.getByRole("button", { name: "Começar" }));
};

/** Joga a vez de quem está no ecrã, com a reserva local. */
const jogarVezLocal = async (acerta: boolean) => {
  await userEvent.click(await screen.findByRole("button", { name: "Estou pronto" }));
  await screen.findByRole("timer");
  const certa = perguntaLocalNoEcra().resposta_correta;
  await userEvent.click(opcao(acerta ? certa : certa === "A" ? "B" : "A"));
  await userEvent.click(await screen.findByRole("button", { name: "Continuar" }));
};

/** Joga a vez de quem está no ecrã, com o servidor (a certa é sempre a "B"). */
const jogarVezServidor = async (letra: string) => {
  await userEvent.click(await screen.findByRole("button", { name: "Estou pronto" }));
  await screen.findByRole("timer");
  await userEvent.click(opcao(letra));
  await userEvent.click(await screen.findByRole("button", { name: "Continuar" }));
};

const servidorPronto = () => {
  let n = 0;
  iniciar.mockResolvedValue({ id: "partida-1", numero_jogadores: 2 });
  obterPergunta.mockImplementation(async () => {
    n++;
    return { id: `p${n}`, texto_pergunta: `Pergunta ${n}?`, opcao_a: "a", opcao_b: "b", opcao_c: "c", opcao_d: "d" };
  });
  responder.mockImplementation(async (_partida: string, _pergunta: string, resposta: string | null) => ({
    correta: resposta === "B",
    resposta_correta: "B",
    explicacao: "porque sim",
  }));
};

describe("JogoLocal (Multijogador Local)", () => {
  beforeEach(() => {
    for (const mock of [iniciar, obterPergunta, responder, terminar, definirPerfil]) mock.mockReset();
    mockProfile = null;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("é sempre para 2 jogadores: dois nomes, sem adicionar nem remover", () => {
    montar();

    expect(screen.getAllByLabelText(/Nome do jogador/)).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Adicionar|Remover/ })).not.toBeInTheDocument();
  });

  it("sem sessão, avisa que se joga sem prémio e não fala com o servidor", async () => {
    montar();

    expect(screen.getByText(/joga-se sem prémio/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Iniciar sessão/ })).toHaveAttribute("href", "/auth");

    await comecar(["Ana", ""]);
    expect(await screen.findByRole("heading", { name: "Vez de Ana" })).toBeInTheDocument();
    expect(screen.getByText(`Ronda 1 de ${RONDAS}`)).toBeInTheDocument();
    // Quem não escreveu nome fica "Jogador 2".
    expect(screen.getByText("Jogador 2")).toBeInTheDocument();
    expect(iniciar).not.toHaveBeenCalled();
  });

  it("partida completa sem sessão: todos jogam todas as rondas e ganha quem tem mais pontos", async () => {
    montar();
    await comecar(["Ana", "Rui"]);

    for (let vez = 0; vez < RONDAS * 2; vez++) {
      const eAAna = !!(await screen.findByRole("heading", { name: /Vez de/ })).textContent?.includes("Ana");
      await jogarVezLocal(eAAna);
    }

    expect(await screen.findByRole("heading", { name: "Ana venceu!" })).toBeInTheDocument();
    expect(screen.getByText(`Certas: ${RONDAS}`)).toBeInTheDocument();
    expect(screen.getByText("Certas: 0")).toBeInTheDocument();
    expect(screen.getByText(/joga-se sem prémio/)).toBeInTheDocument();
    expect(iniciar).not.toHaveBeenCalled();
    expect(terminar).not.toHaveBeenCalled();
  }, 30_000);

  it("empate no primeiro lugar abre o desempate, e sem decisão a vitória é partilhada", async () => {
    montar();
    await comecar(["Ana", "Rui"]);

    for (let vez = 0; vez < RONDAS * 2; vez++) await jogarVezLocal(false);
    expect(await screen.findByText("Desempate 1")).toBeInTheDocument();
    expect(screen.getByText(/Estão empatados/)).toBeInTheDocument();

    for (let vez = 0; vez < MAXIMO_DESEMPATES * 2; vez++) await jogarVezLocal(false);
    expect(await screen.findByRole("heading", { name: "Vitória partilhada: Ana, Rui" })).toBeInTheDocument();
  }, 30_000);

  it("com sessão, as perguntas e a validação são do servidor e a partida paga moedas", async () => {
    mockProfile = { id: "u1" };
    servidorPronto();
    terminar.mockResolvedValue({ moedas_ganhas: 50, limite_diario_atingido: false, perfil: { ...PERFIL, moedas: 100 } });
    montar();

    expect(screen.getByText(/Prémio: 10 moedas por cada resposta certa/)).toBeInTheDocument();
    await comecar(["Ana", "Rui"]);
    expect(iniciar).toHaveBeenCalledWith(2);

    for (let vez = 0; vez < RONDAS * 2; vez++) {
      const eAAna = !!(await screen.findByRole("heading", { name: /Vez de/ })).textContent?.includes("Ana");
      await jogarVezServidor(eAAna ? "B" : "C");
    }

    expect(await screen.findByText("+50 moedas na conta deste aparelho")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ana venceu!" })).toBeInTheDocument();
    expect(responder).toHaveBeenCalledTimes(RONDAS * 2);
    expect(responder).toHaveBeenCalledWith("partida-1", "p1", "B");
    expect(terminar).toHaveBeenCalledTimes(1);
    expect(terminar).toHaveBeenCalledWith("partida-1");
    expect(definirPerfil).toHaveBeenCalledWith({ ...PERFIL, moedas: 100 });
  }, 30_000);

  it("se o servidor não abrir a partida, joga-se com a reserva local e o ecrã diz que não há prémio", async () => {
    mockProfile = { id: "u1" };
    iniciar.mockRejectedValue(new Error("sem rede"));
    montar();
    await comecar(["Ana", "Rui"]);

    expect(await screen.findByRole("alert")).toHaveTextContent(/Esta partida joga-se sem prémio/);

    for (let vez = 0; vez < RONDAS * 2; vez++) {
      const eAAna = !!(await screen.findByRole("heading", { name: /Vez de/ })).textContent?.includes("Ana");
      await jogarVezLocal(eAAna);
    }

    expect(await screen.findByRole("heading", { name: "Ana venceu!" })).toBeInTheDocument();
    expect(screen.queryByText(/moedas na conta/)).not.toBeInTheDocument();
    expect(obterPergunta).not.toHaveBeenCalled();
    expect(terminar).not.toHaveBeenCalled();
  }, 30_000);

  it("se guardar o prémio falhar, nunca mostra moedas ganhas; 'Tentar novamente' volta a pedir", async () => {
    mockProfile = { id: "u1" };
    servidorPronto();
    terminar.mockRejectedValueOnce(new Error("falhou"));
    terminar.mockResolvedValueOnce({ moedas_ganhas: 0, limite_diario_atingido: true, perfil: PERFIL });
    montar();
    await comecar(["Ana", "Rui"]);
    for (let vez = 0; vez < RONDAS * 2; vez++) {
      const eAAna = !!(await screen.findByRole("heading", { name: /Vez de/ })).textContent?.includes("Ana");
      await jogarVezServidor(eAAna ? "B" : "C");
    }

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível guardar o prémio.");
    expect(screen.queryByText(/moedas na conta/)).not.toBeInTheDocument();
    expect(definirPerfil).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText(/Já atingiu o limite de moedas de hoje/)).toBeInTheDocument();
    expect(terminar).toHaveBeenCalledTimes(2);
  }, 30_000);

  it("se a pergunta do servidor falhar, mostra 'Tentar novamente' e não avança a vez", async () => {
    mockProfile = { id: "u1" };
    servidorPronto();
    obterPergunta.mockRejectedValueOnce(new Error("503"));
    montar();
    await comecar(["Ana", "Rui"]);
    await userEvent.click(await screen.findByRole("button", { name: "Estou pronto" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar a pergunta.");
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("Pergunta 1?")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
  });

  it("se validar a resposta falhar, não mostra certo nem errado e deixa reenviar a mesma resposta", async () => {
    mockProfile = { id: "u1" };
    servidorPronto();
    responder.mockRejectedValueOnce(new Error("falhou"));
    montar();
    await comecar(["Ana", "Rui"]);
    await userEvent.click(await screen.findByRole("button", { name: "Estou pronto" }));
    await screen.findByRole("timer");
    await userEvent.click(opcao("B"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível validar a resposta.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continuar" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByRole("status")).toHaveTextContent(/^Certo! \+\d+ pontos$/);
    expect(responder).toHaveBeenLastCalledWith("partida-1", "p1", "B");
  });

  it("quando o tempo acaba, conta como resposta errada (enviada sem opção)", async () => {
    mockProfile = { id: "u1" };
    servidorPronto();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const utilizador = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    montar();
    await utilizador.click(screen.getByRole("button", { name: "Começar" }));
    await utilizador.click(await screen.findByRole("button", { name: "Estou pronto" }));
    await screen.findByRole("timer");

    for (let s = 0; s <= TEMPO_POR_PERGUNTA_LOCAL; s++) {
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    }

    await waitFor(() => expect(responder).toHaveBeenCalledWith("partida-1", "p1", null));
    expect(await screen.findByRole("status")).toHaveTextContent("O tempo acabou.");
    expect(responder).toHaveBeenCalledTimes(1);
  });
});
