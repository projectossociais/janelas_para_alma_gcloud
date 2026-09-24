import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const obterPerguntaAleatoria = vi.fn();
const validarResposta = vi.fn();
const registarRecompensa = vi.fn();
const cinquentaCinquenta = vi.fn();
const opiniaoPublico = vi.fn();
const tempoEsgotado = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  jogoApi: {
    obterPerguntaAleatoria: (...a: unknown[]) => obterPerguntaAleatoria(...a),
    validarResposta: (...a: unknown[]) => validarResposta(...a),
    registarRecompensa: (...a: unknown[]) => registarRecompensa(...a),
    cinquentaCinquenta: (...a: unknown[]) => cinquentaCinquenta(...a),
    opiniaoPublico: (...a: unknown[]) => opiniaoPublico(...a),
    tempoEsgotado: (...a: unknown[]) => tempoEsgotado(...a),
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
vi.mock("@/components/jogo/CarteiraJogo", () => ({ default: () => null }));

// O modal real é testado em MercadoModal.test.tsx -- aqui só interessa o que
// o jogo faz com uma ajuda comprada.
const mercadoProps = vi.fn();
vi.mock("@/components/jogo/MercadoModal", () => ({
  default: (props: { open: boolean; onAjudaComprada: (a: unknown) => void }) => {
    mercadoProps(props);
    return props.open ? (
      <button
        type="button"
        onClick={() =>
          props.onAjudaComprada({
            vendedor_id: "kota-beto",
            resposta_sugerida: "B",
            disponivel_em: "2026-09-24T16:00:00Z",
            perfil: { moedas: 0, diamantes: 5, partidas_jogadas: 0, patamar_maximo_alcancado: 0 },
          })
        }
      >
        simular compra
      </button>
    ) : null;
  },
}));

const definirPerfil = vi.fn();
vi.mock("@/contexts/CarteiraJogoContext", () => ({
  useCarteiraJogo: () => ({ definirPerfil: (...a: unknown[]) => definirPerfil(...a) }),
}));

let mockProfile: { id: string } | null = null;
vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: mockProfile }),
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
const toastInfo = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
    info: (...a: unknown[]) => toastInfo(...a),
  },
}));

import JogoCuriosidades from "./JogoCuriosidades";
import i18n from "@/i18n";

const PERGUNTA_1 = {
  id: "pergunta-1",
  texto_pergunta: "Qual destas é a opção certa?",
  opcao_a: "Errada A",
  opcao_b: "Certa B",
  opcao_c: "Errada C",
  opcao_d: "Errada D",
};

// O ecrã de apresentação (splash) mostra-se sempre primeiro -- todos os
// testes de jogabilidade passam por ele clicando em "Começar".
const comecarJogo = async () => {
  await userEvent.click(await screen.findByRole("button", { name: "Começar" }));
};

describe("JogoCuriosidades", () => {
  beforeEach(() => {
    obterPerguntaAleatoria.mockReset();
    validarResposta.mockReset();
    cinquentaCinquenta.mockReset();
    opiniaoPublico.mockReset();
    tempoEsgotado.mockReset();
    mercadoProps.mockReset();
    registarRecompensa.mockReset();
    definirPerfil.mockReset();
    registarRecompensa.mockResolvedValue({ moedas: 0, diamantes: 0, partidas_jogadas: 1, patamar_maximo_alcancado: 0 });
    toastError.mockReset();
    toastSuccess.mockReset();
    toastInfo.mockReset();
    mockProfile = null;
    // A reserva offline tem 5 perguntas por patamar, escolhidas ao acaso --
    // fixamos `Math.random` para os testes de modo offline serem
    // determinísticos (index 0 = a primeira pergunta ainda não vista).
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mostra o ecrã de apresentação com a escada antes da primeira pergunta", async () => {
    obterPerguntaAleatoria.mockResolvedValue(PERGUNTA_1);
    render(<JogoCuriosidades />, { wrapper: MemoryRouter });

    expect(await screen.findByText("Prepare-se para subir a escada")).toBeInTheDocument();
    expect(screen.queryByText(PERGUNTA_1.texto_pergunta)).not.toBeInTheDocument();

    await comecarJogo();
    expect(await screen.findByText(PERGUNTA_1.texto_pergunta)).toBeInTheDocument();
  });

  it("busca a pergunta do patamar 1 ao montar e mostra as 4 opções", async () => {
    obterPerguntaAleatoria.mockResolvedValue(PERGUNTA_1);
    render(<JogoCuriosidades />, { wrapper: MemoryRouter });
    await comecarJogo();

    expect(await screen.findByText(PERGUNTA_1.texto_pergunta)).toBeInTheDocument();
    expect(obterPerguntaAleatoria).toHaveBeenCalledWith(1);
    expect(screen.getByText("Errada A")).toBeInTheDocument();
    expect(screen.getByText("Certa B")).toBeInTheDocument();
    expect(screen.getByText("Errada C")).toBeInTheDocument();
    expect(screen.getByText("Errada D")).toBeInTheDocument();
  });

  it("a escada de prémios mostra só os valores em Kz, nunca o número do patamar", async () => {
    obterPerguntaAleatoria.mockResolvedValue(PERGUNTA_1);
    render(<JogoCuriosidades />, { wrapper: MemoryRouter });

    expect(await screen.findByText("Kz 500")).toBeInTheDocument();
    expect(screen.getByText("Kz 1.000.000")).toBeInTheDocument();
    // Nenhum índice de patamar (1 a 15) deve sobrar como texto isolado na escada.
    expect(screen.queryByText("15")).not.toBeInTheDocument();
    expect(screen.queryByText("1", { exact: true })).not.toBeInTheDocument();
  });

  it("ao errar, marca a opção escolhida a vermelho, a certa a verde, e abre o modal com a explicação", async () => {
    obterPerguntaAleatoria.mockResolvedValue(PERGUNTA_1);
    validarResposta.mockResolvedValue({
      correta: false,
      resposta_correta: "B",
      explicacao: "A explicação científica da resposta certa.",
    });
    render(<JogoCuriosidades />, { wrapper: MemoryRouter });
    await comecarJogo();
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
    await comecarJogo();
    await screen.findByText(PERGUNTA_1.texto_pergunta);

    await userEvent.click(screen.getByText("Certa B"));
    expect(validarResposta).toHaveBeenCalledWith("pergunta-1", "B");

    await waitFor(() => expect(obterPerguntaAleatoria).toHaveBeenCalledWith(2), { timeout: 2000 });
  });

  it("a ajuda 50:50 esconde exactamente duas opções erradas e fica desactivada", async () => {
    obterPerguntaAleatoria.mockResolvedValue(PERGUNTA_1);
    cinquentaCinquenta.mockResolvedValue({ opcoes_eliminadas: ["A", "D"] });
    render(<JogoCuriosidades />, { wrapper: MemoryRouter });
    await comecarJogo();
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
    expect(cinquentaCinquenta).toHaveBeenCalledWith("pergunta-1");
    // O bug corrigido: as ajudas já não "respondem" à pergunta às escondidas
    // (isso zerava o progresso no servidor sempre que "A" estava errada).
    expect(validarResposta).not.toHaveBeenCalled();
  });

  it("a opinião do público mostra as 4 percentagens vindas do servidor", async () => {
    obterPerguntaAleatoria.mockResolvedValue(PERGUNTA_1);
    opiniaoPublico.mockResolvedValue({ percentagens: { A: 10, B: 62, C: 20, D: 8 } });
    render(<JogoCuriosidades />, { wrapper: MemoryRouter });
    await comecarJogo();
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
    expect(percentagens).toEqual([10, 62, 20, 8]);
    await waitFor(() => expect(botaoPublico).toBeDisabled());
    expect(validarResposta).not.toHaveBeenCalled();
  });

  it("ao esgotar o tempo, usa o endpoint próprio -- nunca 'responde' com uma letra ao acaso", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      obterPerguntaAleatoria.mockResolvedValue(PERGUNTA_1);
      tempoEsgotado.mockResolvedValue({ correta: false, resposta_correta: "B", explicacao: "Explicação." });
      render(<JogoCuriosidades />, { wrapper: MemoryRouter });
      await comecarJogo();
      await screen.findByText(PERGUNTA_1.texto_pergunta);

      for (let i = 0; i < 46; i++) {
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });
      }

      await waitFor(() => expect(tempoEsgotado).toHaveBeenCalledWith("pergunta-1"));
      expect(validarResposta).not.toHaveBeenCalled();
      expect(await screen.findByText("Explicação.")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("uma ajuda que falha mostra erro e volta a ficar disponível", async () => {
    obterPerguntaAleatoria.mockResolvedValue(PERGUNTA_1);
    cinquentaCinquenta.mockRejectedValue(new Error("rede"));
    render(<JogoCuriosidades />, { wrapper: MemoryRouter });
    await comecarJogo();
    await screen.findByText(PERGUNTA_1.texto_pergunta);

    const botao5050 = screen.getByRole("button", { name: "50:50" });
    await userEvent.click(botao5050);

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(botao5050).toBeEnabled();
  });

  it("uma sugestão comprada no Mercado aparece junto da opção, com o nome do vendedor", async () => {
    obterPerguntaAleatoria.mockResolvedValue(PERGUNTA_1);
    cinquentaCinquenta.mockResolvedValue({ opcoes_eliminadas: ["A", "D"] });
    render(<JogoCuriosidades />, { wrapper: MemoryRouter });
    await comecarJogo();
    await screen.findByText(PERGUNTA_1.texto_pergunta);

    await userEvent.click(screen.getByRole("button", { name: "50:50" }));
    await userEvent.click(screen.getByRole("button", { name: /Mercado/ }));
    // O Mercado recebe as opções já escondidas, para não sugerir uma delas.
    await waitFor(() =>
      expect(mercadoProps).toHaveBeenLastCalledWith(
        expect.objectContaining({ open: true, perguntaId: "pergunta-1", opcoesExcluidas: ["A", "D"] })
      )
    );
    await userEvent.click(screen.getByRole("button", { name: "simular compra" }));

    expect(screen.getByText("Certa B").closest("button")).toHaveTextContent("Kota Beto");
  });

  it("com sessão iniciada, sincroniza a recompensa da derrota com o servidor", async () => {
    mockProfile = { id: "utilizador-1" };
    obterPerguntaAleatoria.mockResolvedValue(PERGUNTA_1);
    validarResposta.mockResolvedValue({ correta: false, resposta_correta: "B", explicacao: null });
    render(<JogoCuriosidades />, { wrapper: MemoryRouter });
    await comecarJogo();
    await screen.findByText(PERGUNTA_1.texto_pergunta);

    await userEvent.click(screen.getByText("Errada A"));

    // Sem argumento -- o servidor é que decide quanto vale, a partir do
    // progresso que rastreou (ver JogoService), nunca de um patamar
    // mandado pelo cliente.
    await waitFor(() => expect(registarRecompensa).toHaveBeenCalledWith());
    // O saldo devolvido pelo servidor actualiza logo a barra da carteira.
    await waitFor(() =>
      expect(definirPerfil).toHaveBeenCalledWith(expect.objectContaining({ partidas_jogadas: 1 }))
    );
    expect(await screen.findByText("Prémio ganho")).toBeInTheDocument();
  });

  it("sem sessão, mostra o prémio localmente mas não tenta sincronizar", async () => {
    mockProfile = null;
    obterPerguntaAleatoria.mockResolvedValue(PERGUNTA_1);
    validarResposta.mockResolvedValue({ correta: false, resposta_correta: "B", explicacao: null });
    render(<JogoCuriosidades />, { wrapper: MemoryRouter });
    await comecarJogo();
    await screen.findByText(PERGUNTA_1.texto_pergunta);

    await userEvent.click(screen.getByText("Errada A"));

    expect(await screen.findByText("Prémio ganho")).toBeInTheDocument();
    expect(screen.getByText(/Inicie sessão para guardar/i)).toBeInTheDocument();
    expect(registarRecompensa).not.toHaveBeenCalled();
  });

  describe("Modo de Contingência (offline)", () => {
    const falhaDeRede = () => Object.assign(new Error("sem ligação"), { status: 0 });

    it("se a API falhar, serve silenciosamente a pergunta estática do patamar e assinala 'Modo offline'", async () => {
      obterPerguntaAleatoria.mockRejectedValue(falhaDeRede());
      render(<JogoCuriosidades />, { wrapper: MemoryRouter });
      await comecarJogo();

      expect(await screen.findByText("O que é o estrabismo, em termos simples?")).toBeInTheDocument();
      expect(screen.getByText("Modo offline")).toBeInTheDocument();
      expect(toastError).not.toHaveBeenCalled();
    });

    it("em modo offline, valida a resposta localmente sem chamar o servidor", async () => {
      obterPerguntaAleatoria.mockRejectedValue(falhaDeRede());
      render(<JogoCuriosidades />, { wrapper: MemoryRouter });
      await comecarJogo();
      await screen.findByText("O que é o estrabismo, em termos simples?");

      await userEvent.click(screen.getByText("Uma alteração na cor natural da íris")); // opção errada

      expect(await screen.findByText("Essa não era a resposta certa")).toBeInTheDocument();
      expect(screen.getByText(/desalinhamento dos eixos visuais dos dois olhos/i)).toBeInTheDocument();
      expect(validarResposta).not.toHaveBeenCalled();
    });

    it("a ajuda 50:50 funciona em modo offline sem chamar o servidor", async () => {
      obterPerguntaAleatoria.mockRejectedValue(falhaDeRede());
      render(<JogoCuriosidades />, { wrapper: MemoryRouter });
      await comecarJogo();
      await screen.findByText("O que é o estrabismo, em termos simples?");

      await userEvent.click(screen.getByRole("button", { name: "50:50" }));

      const opcaoCerta = screen.getByText("Um desalinhamento dos eixos visuais dos olhos").closest("button");
      await waitFor(() => expect(opcaoCerta).not.toBeDisabled());
      const desativadas = [
        "Uma alteração na cor natural da íris",
        "Uma alergia crónica à luz solar directa",
        "Um tipo particular de miopia elevada",
      ]
        .map((texto) => screen.getByText(texto).closest("button"))
        .filter((botao) => botao?.disabled).length;
      expect(desativadas).toBe(2);
      expect(validarResposta).not.toHaveBeenCalled();
    });

    it("'trocar pergunta' em modo offline substitui por outra pergunta do mesmo patamar, sem voltar a tentar o servidor", async () => {
      obterPerguntaAleatoria.mockRejectedValue(falhaDeRede());
      render(<JogoCuriosidades />, { wrapper: MemoryRouter });
      await comecarJogo();
      await screen.findByText("O que é o estrabismo, em termos simples?");

      const botaoTrocar = screen.getByRole("button", { name: /Trocar pergunta/i });
      await userEvent.click(botaoTrocar);

      // a reserva do patamar 1 tem 5 perguntas -- trocar mostra a próxima
      // ainda não vista, nunca repetindo a que já apareceu.
      expect(await screen.findByText("Quantos músculos controlam os movimentos de cada olho?")).toBeInTheDocument();
      expect(screen.queryByText("O que é o estrabismo, em termos simples?")).not.toBeInTheDocument();
      expect(obterPerguntaAleatoria).toHaveBeenCalledTimes(1); // só a tentativa inicial (que falhou)
      expect(toastError).not.toHaveBeenCalled();
      expect(botaoTrocar).toBeDisabled(); // ajuda de uso único por partida, mesmo offline
    });

  });

  describe("no site inglês (/en/trivia-game/play)", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_ENABLE_EN", "true");
      void i18n.changeLanguage("en-US");
    });
    afterEach(() => {
      vi.unstubAllEnvs();
      void i18n.changeLanguage("pt-AO");
    });

    const abrirEmIngles = () =>
      render(
        <MemoryRouter initialEntries={["/en/trivia-game/play"]}>
          <JogoCuriosidades />
        </MemoryRouter>,
      );

    it("usa a reserva traduzida -- nunca as perguntas da API, que só existem em português", async () => {
      obterPerguntaAleatoria.mockResolvedValue(PERGUNTA_1);
      abrirEmIngles();
      await userEvent.click(await screen.findByRole("button", { name: "Start" }));

      expect(await screen.findByText("What is strabismus, in simple terms?")).toBeInTheDocument();
      expect(obterPerguntaAleatoria).not.toHaveBeenCalled();
      expect(screen.queryByText(PERGUNTA_1.texto_pergunta)).not.toBeInTheDocument();
      // não é uma falha de rede: o aviso de modo offline não aparece
      expect(screen.queryByText("Offline mode")).not.toBeInTheDocument();
    });

    it("valida a resposta localmente e mostra a explicação em inglês ao errar", async () => {
      abrirEmIngles();
      await userEvent.click(await screen.findByRole("button", { name: "Start" }));
      await userEvent.click(await screen.findByText("A change in the natural color of the iris"));

      expect(await screen.findByText("Strabismus is a misalignment of the visual axes of the two eyes.")).toBeInTheDocument();
      expect(validarResposta).not.toHaveBeenCalled();
    });
  });
});
