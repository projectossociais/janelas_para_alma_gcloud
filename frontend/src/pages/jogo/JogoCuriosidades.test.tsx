import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const obterPerguntaDaPartida = vi.fn();
const validarResposta = vi.fn();
const iniciarPartida = vi.fn();
const terminarPartida = vi.fn();
const cinquentaCinquenta = vi.fn();
const opiniaoPublico = vi.fn();
const tempoEsgotado = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  jogoApi: {
    obterPerguntaDaPartida: (...a: unknown[]) => obterPerguntaDaPartida(...a),
    validarResposta: (...a: unknown[]) => validarResposta(...a),
    iniciarPartida: (...a: unknown[]) => iniciarPartida(...a),
    terminarPartida: (...a: unknown[]) => terminarPartida(...a),
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

// O modal real é testado em RecompensaSequenciaModal.test.tsx.
vi.mock("@/components/jogo/RecompensaSequenciaModal", () => ({
  default: (props: { recompensa: { sequencia: number; diamantes: number } | null; onContinuar: () => void }) =>
    props.recompensa ? (
      <div data-testid="modal-sequencia">
        <span>{`sequencia ${props.recompensa.sequencia}, diamantes ${props.recompensa.diamantes}`}</span>
        <button type="button" onClick={props.onContinuar}>
          simular continuar
        </button>
      </div>
    ) : null,
}));

// O modal real é testado em VidaExtraModal.test.tsx -- aqui simulam-se as
// duas decisões do jogador.
vi.mock("@/components/jogo/VidaExtraModal", () => ({
  default: (props: {
    oferta: { custo: number; restantes: number } | null;
    onVidaUsada: (v: unknown) => void;
    onEncerrar: () => void;
  }) =>
    props.oferta ? (
      <div data-testid="modal-vida-extra">
        <span>{`custo ${props.oferta.custo}, restantes ${props.oferta.restantes}`}</span>
        <button
          type="button"
          onClick={() =>
            props.onVidaUsada({
              perfil: { moedas: 0, diamantes: 30, partidas_jogadas: 0, patamar_maximo_alcancado: 0 },
              pergunta_id: "pergunta-1",
              opcao_falhada: "A",
              vidas_restantes: 1,
            })
          }
        >
          simular usar vida
        </button>
        <button type="button" onClick={props.onEncerrar}>
          simular encerrar
        </button>
      </div>
    ) : null,
}));

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
  useProfile: () => ({ profile: mockProfile, loading: false }),
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

const TERMINADA = {
  perfil: { moedas: 0, diamantes: 0, partidas_jogadas: 1, patamar_maximo_alcancado: 0 },
  patamar_superado: 0,
  moedas_ganhas: 0,
  diamantes_ganhos: 0,
  resposta_correta: null,
  explicacao: null,
};

const PERGUNTA_1 = {
  id: "pergunta-1",
  texto_pergunta: "Qual destas é a opção certa?",
  opcao_a: "Errada A",
  opcao_b: "Certa B",
  opcao_c: "Errada C",
  opcao_d: "Errada D",
  patamar: 1,
};

const PERGUNTA_2 = { ...PERGUNTA_1, id: "pergunta-2", texto_pergunta: "E esta, qual é?", patamar: 2 };

// O ecrã de apresentação (splash) mostra-se sempre primeiro -- todos os
// testes de jogabilidade passam por ele clicando em "Começar".
const comecarJogo = async () => {
  await userEvent.click(await screen.findByRole("button", { name: "Começar" }));
};

describe("JogoCuriosidades", () => {
  beforeEach(() => {
    obterPerguntaDaPartida.mockReset();
    validarResposta.mockReset();
    cinquentaCinquenta.mockReset();
    opiniaoPublico.mockReset();
    tempoEsgotado.mockReset();
    mercadoProps.mockReset();
    iniciarPartida.mockReset().mockResolvedValue({ estado: "em_curso" });
    terminarPartida.mockReset().mockResolvedValue(TERMINADA);
    definirPerfil.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    toastInfo.mockReset();
    // Por omissão, joga-se com sessão (perguntas e partida no servidor).
    mockProfile = { id: "utilizador-1" };
    // A reserva offline tem 5 perguntas por patamar, escolhidas ao acaso --
    // fixamos `Math.random` para os testes de modo offline serem
    // determinísticos (index 0 = a primeira pergunta ainda não vista).
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mostra o ecrã de apresentação com a escada antes da primeira pergunta", async () => {
    obterPerguntaDaPartida.mockResolvedValue(PERGUNTA_1);
    render(<JogoCuriosidades />, { wrapper: MemoryRouter });

    expect(await screen.findByText("Prepare-se para subir a escada")).toBeInTheDocument();
    expect(screen.queryByText(PERGUNTA_1.texto_pergunta)).not.toBeInTheDocument();

    await comecarJogo();
    expect(await screen.findByText(PERGUNTA_1.texto_pergunta)).toBeInTheDocument();
  });

  it("busca a pergunta do patamar 1 ao montar e mostra as 4 opções", async () => {
    obterPerguntaDaPartida.mockResolvedValue(PERGUNTA_1);
    render(<JogoCuriosidades />, { wrapper: MemoryRouter });
    await comecarJogo();

    expect(await screen.findByText(PERGUNTA_1.texto_pergunta)).toBeInTheDocument();
    expect(obterPerguntaDaPartida).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Errada A")).toBeInTheDocument();
    expect(screen.getByText("Certa B")).toBeInTheDocument();
    expect(screen.getByText("Errada C")).toBeInTheDocument();
    expect(screen.getByText("Errada D")).toBeInTheDocument();
  });

  it("a escada de prémios mostra só os valores em Kz, nunca o número do patamar", async () => {
    obterPerguntaDaPartida.mockResolvedValue(PERGUNTA_1);
    render(<JogoCuriosidades />, { wrapper: MemoryRouter });

    expect(await screen.findByText("Kz 500")).toBeInTheDocument();
    expect(screen.getByText("Kz 1.000.000")).toBeInTheDocument();
    // Nenhum índice de patamar (1 a 15) deve sobrar como texto isolado na escada.
    expect(screen.queryByText("15")).not.toBeInTheDocument();
    expect(screen.queryByText("1", { exact: true })).not.toBeInTheDocument();
  });

  it("ao errar, marca a opção escolhida a vermelho, a certa a verde, e abre o modal com a explicação", async () => {
    obterPerguntaDaPartida.mockResolvedValue(PERGUNTA_1);
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
    obterPerguntaDaPartida.mockClear();
    obterPerguntaDaPartida.mockResolvedValue(PERGUNTA_1);
    await userEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));

    await waitFor(() => expect(obterPerguntaDaPartida).toHaveBeenCalledTimes(1));
    // Nova partida no servidor.
    expect(iniciarPartida).toHaveBeenCalledTimes(2);
  });

  it("ao acertar, avança automaticamente para o patamar seguinte (o que o servidor diz)", async () => {
    obterPerguntaDaPartida.mockResolvedValueOnce(PERGUNTA_1).mockResolvedValueOnce(PERGUNTA_2);
    validarResposta.mockResolvedValue({ correta: true, resposta_correta: "B", explicacao: null });
    render(<JogoCuriosidades />, { wrapper: MemoryRouter });
    await comecarJogo();
    await screen.findByText(PERGUNTA_1.texto_pergunta);

    await userEvent.click(screen.getByText("Certa B"));
    expect(validarResposta).toHaveBeenCalledWith("pergunta-1", "B");

    expect(await screen.findByText(PERGUNTA_2.texto_pergunta, {}, { timeout: 2500 })).toBeInTheDocument();
    expect(obterPerguntaDaPartida).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText(/Patamar 2 de 15/i).length).toBeGreaterThan(0);
  });

  it("a ajuda 50:50 esconde exactamente duas opções erradas e fica desactivada", async () => {
    obterPerguntaDaPartida.mockResolvedValue(PERGUNTA_1);
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
    obterPerguntaDaPartida.mockResolvedValue(PERGUNTA_1);
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
      obterPerguntaDaPartida.mockResolvedValue(PERGUNTA_1);
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
    obterPerguntaDaPartida.mockResolvedValue(PERGUNTA_1);
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
    obterPerguntaDaPartida.mockResolvedValue(PERGUNTA_1);
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

  it("com sessão, inicia a partida no servidor ao abrir o jogo; sem sessão, não", async () => {
    mockProfile = { id: "utilizador-1" };
    obterPerguntaDaPartida.mockResolvedValue(PERGUNTA_1);
    const { unmount } = render(<JogoCuriosidades />, { wrapper: MemoryRouter });
    await waitFor(() => expect(iniciarPartida).toHaveBeenCalledTimes(1));
    unmount();

    iniciarPartida.mockClear();
    mockProfile = null;
    render(<JogoCuriosidades />, { wrapper: MemoryRouter });
    await comecarJogo();
    await screen.findByText("O que é o estrabismo, em termos simples?");
    expect(iniciarPartida).not.toHaveBeenCalled();
  });

  it("só pede a primeira pergunta depois de a partida estar iniciada no servidor", async () => {
    // Se a pergunta chegasse antes, `iniciarPartida` terminaria a partida a
    // que essa pergunta ficou presa.
    let concluirInicio: (v: unknown) => void = () => {};
    iniciarPartida.mockReturnValue(new Promise((r) => (concluirInicio = r)));
    obterPerguntaDaPartida.mockResolvedValue(PERGUNTA_1);
    render(<JogoCuriosidades />, { wrapper: MemoryRouter });
    await comecarJogo();

    await new Promise((r) => setTimeout(r, 30));
    expect(obterPerguntaDaPartida).not.toHaveBeenCalled();

    concluirInicio({ estado: "em_curso" });
    expect(await screen.findByText(PERGUNTA_1.texto_pergunta)).toBeInTheDocument();
    expect(obterPerguntaDaPartida).toHaveBeenCalledTimes(1);
  });

  describe("Vida Extra", () => {
    const ERRO_COM_OFERTA = {
      correta: false,
      resposta_correta: null,
      explicacao: null,
      vida_extra: { custo: 20, restantes: 2 },
    };

    it("ao errar com sessão, abre a Vida Extra em vez do ecrã final, sem revelar a resposta", async () => {
      mockProfile = { id: "utilizador-1" };
      obterPerguntaDaPartida.mockResolvedValue(PERGUNTA_1);
      validarResposta.mockResolvedValue(ERRO_COM_OFERTA);
      render(<JogoCuriosidades />, { wrapper: MemoryRouter });
      await comecarJogo();
      await screen.findByText(PERGUNTA_1.texto_pergunta);

      await userEvent.click(screen.getByText("Errada A"));

      expect(await screen.findByTestId("modal-vida-extra")).toHaveTextContent("custo 20, restantes 2");
      expect(screen.queryByText("Essa não era a resposta certa")).not.toBeInTheDocument();
      expect(terminarPartida).not.toHaveBeenCalled();
      // Nenhuma opção aparece como a certa.
      expect(screen.getByText("Certa B").closest("button")).not.toHaveClass("border-green");
    });

    it("usar a vida extra: mesma pergunta, sem a opção falhada, e continua a jogar", async () => {
      mockProfile = { id: "utilizador-1" };
      obterPerguntaDaPartida.mockResolvedValue(PERGUNTA_1);
      validarResposta.mockResolvedValueOnce(ERRO_COM_OFERTA).mockResolvedValueOnce({
        correta: true,
        resposta_correta: "B",
        explicacao: null,
      });
      render(<JogoCuriosidades />, { wrapper: MemoryRouter });
      await comecarJogo();
      await screen.findByText(PERGUNTA_1.texto_pergunta);
      await userEvent.click(screen.getByText("Errada A"));

      await userEvent.click(await screen.findByRole("button", { name: "simular usar vida" }));

      await waitFor(() => expect(screen.queryByTestId("modal-vida-extra")).not.toBeInTheDocument());
      expect(screen.getByText("Errada A").closest("button")).toBeDisabled();
      expect(screen.getByText("Certa B").closest("button")).toBeEnabled();
      expect(screen.getByRole("timer")).toHaveTextContent("45");

      await userEvent.click(screen.getByText("Certa B"));
      await waitFor(() => expect(validarResposta).toHaveBeenLastCalledWith("pergunta-1", "B"));
      expect(terminarPartida).not.toHaveBeenCalled();
    });

    it("encerrar: termina a partida no servidor, revela a resposta e mostra o prémio pago", async () => {
      mockProfile = { id: "utilizador-1" };
      obterPerguntaDaPartida.mockResolvedValue(PERGUNTA_1);
      validarResposta.mockResolvedValue(ERRO_COM_OFERTA);
      terminarPartida.mockResolvedValue({
        ...TERMINADA,
        perfil: { ...TERMINADA.perfil, moedas: 150 },
        patamar_superado: 3,
        moedas_ganhas: 150,
        resposta_correta: "B",
        explicacao: "A explicação da certa.",
      });
      render(<JogoCuriosidades />, { wrapper: MemoryRouter });
      await comecarJogo();
      await screen.findByText(PERGUNTA_1.texto_pergunta);
      await userEvent.click(screen.getByText("Errada A"));

      await userEvent.click(await screen.findByRole("button", { name: "simular encerrar" }));

      await waitFor(() => expect(terminarPartida).toHaveBeenCalledTimes(1));
      expect(await screen.findByText("A explicação da certa.")).toBeInTheDocument();
      expect(screen.getByText("+150")).toBeInTheDocument();
      expect(definirPerfil).toHaveBeenCalledWith(expect.objectContaining({ moedas: 150 }));
    });

    it("sem vidas restantes, vai directo ao ecrã final", async () => {
      mockProfile = { id: "utilizador-1" };
      obterPerguntaDaPartida.mockResolvedValue(PERGUNTA_1);
      validarResposta.mockResolvedValue({ ...ERRO_COM_OFERTA, vida_extra: { custo: 20, restantes: 0 } });
      terminarPartida.mockResolvedValue({ ...TERMINADA, resposta_correta: "B", explicacao: "Porque sim." });
      render(<JogoCuriosidades />, { wrapper: MemoryRouter });
      await comecarJogo();
      await screen.findByText(PERGUNTA_1.texto_pergunta);

      await userEvent.click(screen.getByText("Errada A"));

      expect(await screen.findByText("Porque sim.")).toBeInTheDocument();
      expect(screen.queryByTestId("modal-vida-extra")).not.toBeInTheDocument();
    });
  });

  describe("como convidado (sem sessão)", () => {
    beforeEach(() => {
      mockProfile = null;
    });

    it("joga só com a reserva local -- nunca pede perguntas nem valida no servidor", async () => {
      render(<JogoCuriosidades />, { wrapper: MemoryRouter });
      await comecarJogo();

      expect(await screen.findByText("O que é o estrabismo, em termos simples?")).toBeInTheDocument();
      expect(screen.getByText(/a jogar como convidado/i)).toBeInTheDocument();
      // Não é "modo offline" -- é o modo normal de quem não tem conta.
      expect(screen.queryByText("Modo offline")).not.toBeInTheDocument();
      // Sem Mercado (é pago em diamantes, e sem conta não há diamantes).
      expect(screen.queryByRole("button", { name: /Mercado/ })).not.toBeInTheDocument();

      await userEvent.click(screen.getByText("Um desalinhamento dos eixos visuais dos olhos"));
      expect(obterPerguntaDaPartida).not.toHaveBeenCalled();
      expect(validarResposta).not.toHaveBeenCalled();
      expect(iniciarPartida).not.toHaveBeenCalled();
    });

    it("no fim, não há prémio -- convida a entrar", async () => {
      render(<JogoCuriosidades />, { wrapper: MemoryRouter });
      await comecarJogo();
      await screen.findByText("O que é o estrabismo, em termos simples?");

      await userEvent.click(screen.getByText("Uma alteração na cor natural da íris"));

      expect(await screen.findByText(/esta partida não dá moedas nem diamantes/i)).toBeInTheDocument();
      expect(screen.queryByText("Prémio ganho")).not.toBeInTheDocument();
      expect(terminarPartida).not.toHaveBeenCalled();
    });
  });

  describe("Sequência de acertos", () => {
    it("mostra a sequência e, ao 3.º acerto, celebra o marco e actualiza logo os diamantes", async () => {
      obterPerguntaDaPartida.mockResolvedValue(PERGUNTA_1);
      const perfilComBonus = { moedas: 0, diamantes: 10, partidas_jogadas: 0, patamar_maximo_alcancado: 0 };
      validarResposta.mockResolvedValue({
        correta: true,
        resposta_correta: "B",
        explicacao: null,
        sequencia_acertos: 3,
        recompensa_sequencia: {
          sequencia: 3,
          diamantes: 10,
          diamantes_do_marco: 10,
          limite_diario_atingido: false,
          perfil: perfilComBonus,
        },
      });
      render(<JogoCuriosidades />, { wrapper: MemoryRouter });
      await comecarJogo();
      await screen.findByText(PERGUNTA_1.texto_pergunta);

      await userEvent.click(screen.getByText("Certa B"));

      expect(await screen.findByTestId("modal-sequencia")).toHaveTextContent("sequencia 3, diamantes 10");
      expect(definirPerfil).toHaveBeenCalledWith(perfilComBonus);
      expect(screen.getByLabelText("Sequência de 3 respostas certas")).toBeInTheDocument();
    });

    it("o cronómetro pára enquanto o marco está a ser celebrado", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        obterPerguntaDaPartida.mockResolvedValueOnce(PERGUNTA_1).mockResolvedValueOnce(PERGUNTA_2);
        validarResposta.mockResolvedValue({
          correta: true,
          resposta_correta: "B",
          explicacao: null,
          sequencia_acertos: 3,
          recompensa_sequencia: {
            sequencia: 3,
            diamantes: 10,
            diamantes_do_marco: 10,
            limite_diario_atingido: false,
            perfil: { moedas: 0, diamantes: 10, partidas_jogadas: 0, patamar_maximo_alcancado: 0 },
          },
        });
        render(<JogoCuriosidades />, { wrapper: MemoryRouter });
        await comecarJogo();
        await screen.findByText(PERGUNTA_1.texto_pergunta);
        await userEvent.click(screen.getByText("Certa B"));
        expect(await screen.findByText(PERGUNTA_2.texto_pergunta, {}, { timeout: 3000 })).toBeInTheDocument();

        for (let i = 0; i < 5; i++) {
          await act(async () => {
            vi.advanceTimersByTime(1000);
          });
        }
        expect(screen.getByRole("timer")).toHaveTextContent("45");

        await userEvent.click(screen.getByRole("button", { name: "simular continuar" }));
        for (let i = 0; i < 3; i++) {
          await act(async () => {
            vi.advanceTimersByTime(1000);
          });
        }
        expect(screen.getByRole("timer")).toHaveTextContent("42");
      } finally {
        vi.useRealTimers();
      }
    });

    it("sem marco, não há celebração", async () => {
      obterPerguntaDaPartida.mockResolvedValue(PERGUNTA_1);
      validarResposta.mockResolvedValue({
        correta: true,
        resposta_correta: "B",
        explicacao: null,
        sequencia_acertos: 2,
        recompensa_sequencia: null,
      });
      render(<JogoCuriosidades />, { wrapper: MemoryRouter });
      await comecarJogo();
      await screen.findByText(PERGUNTA_1.texto_pergunta);

      await userEvent.click(screen.getByText("Certa B"));

      expect(await screen.findByLabelText("Sequência de 2 respostas certas")).toBeInTheDocument();
      expect(screen.queryByTestId("modal-sequencia")).not.toBeInTheDocument();
    });
  });

  describe("Modo de Contingência (offline)", () => {
    const falhaDeRede = () => Object.assign(new Error("sem ligação"), { status: 0 });

    it("se a API falhar, serve silenciosamente a pergunta estática do patamar e assinala 'Modo offline'", async () => {
      obterPerguntaDaPartida.mockRejectedValue(falhaDeRede());
      render(<JogoCuriosidades />, { wrapper: MemoryRouter });
      await comecarJogo();

      expect(await screen.findByText("O que é o estrabismo, em termos simples?")).toBeInTheDocument();
      expect(screen.getByText("Modo offline")).toBeInTheDocument();
      expect(toastError).not.toHaveBeenCalled();
    });

    it("em modo offline, valida a resposta localmente sem chamar o servidor", async () => {
      obterPerguntaDaPartida.mockRejectedValue(falhaDeRede());
      render(<JogoCuriosidades />, { wrapper: MemoryRouter });
      await comecarJogo();
      await screen.findByText("O que é o estrabismo, em termos simples?");

      await userEvent.click(screen.getByText("Uma alteração na cor natural da íris")); // opção errada

      expect(await screen.findByText("Essa não era a resposta certa")).toBeInTheDocument();
      expect(screen.getByText(/desalinhamento dos eixos visuais dos dois olhos/i)).toBeInTheDocument();
      expect(validarResposta).not.toHaveBeenCalled();
    });

    it("com sessão, avisa que as respostas offline não contam para o prémio pago pelo servidor", async () => {
      // Regressão (2026-09-24): em produção, "acertei 2 e errei a 3.ª -> 0
      // moedas" era isto -- as perguntas vieram da reserva local, o servidor
      // nunca viu os acertos e pagou (bem) 0 patamares, sem explicação.
      mockProfile = { id: "utilizador-1" };
      obterPerguntaDaPartida.mockRejectedValue(falhaDeRede());
      render(<JogoCuriosidades />, { wrapper: MemoryRouter });
      await comecarJogo();
      await screen.findByText("O que é o estrabismo, em termos simples?");

      await userEvent.click(screen.getByText("Uma alteração na cor natural da íris")); // opção errada

      await waitFor(() => expect(terminarPartida).toHaveBeenCalledTimes(1));
      expect(await screen.findByText(/essas respostas não contam para o prémio/i)).toBeInTheDocument();
    });

    it("a ajuda 50:50 funciona em modo offline sem chamar o servidor", async () => {
      obterPerguntaDaPartida.mockRejectedValue(falhaDeRede());
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
      obterPerguntaDaPartida.mockRejectedValue(falhaDeRede());
      render(<JogoCuriosidades />, { wrapper: MemoryRouter });
      await comecarJogo();
      await screen.findByText("O que é o estrabismo, em termos simples?");

      const botaoTrocar = screen.getByRole("button", { name: /Trocar pergunta/i });
      await userEvent.click(botaoTrocar);

      // a reserva do patamar 1 tem 5 perguntas -- trocar mostra a próxima
      // ainda não vista, nunca repetindo a que já apareceu.
      expect(await screen.findByText("Quantos músculos controlam os movimentos de cada olho?")).toBeInTheDocument();
      expect(screen.queryByText("O que é o estrabismo, em termos simples?")).not.toBeInTheDocument();
      expect(obterPerguntaDaPartida).toHaveBeenCalledTimes(1); // só a tentativa inicial (que falhou)
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
      obterPerguntaDaPartida.mockResolvedValue(PERGUNTA_1);
      abrirEmIngles();
      await userEvent.click(await screen.findByRole("button", { name: "Start" }));

      expect(await screen.findByText("What is strabismus, in simple terms?")).toBeInTheDocument();
      expect(obterPerguntaDaPartida).not.toHaveBeenCalled();
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
