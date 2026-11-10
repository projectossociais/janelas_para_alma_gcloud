import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const api = {
  criar: vi.fn(),
  entrar: vi.fn(),
  comecar: vi.fn(),
  estado: vi.fn(),
  responder: vi.fn(),
  sair: vi.fn(),
  enviarMensagem: vi.fn(),
  denunciarChat: vi.fn(),
};
vi.mock("@/lib/apiClient", () => ({
  jogoOnlineApi: {
    criar: (...a: unknown[]) => api.criar(...a),
    entrar: (...a: unknown[]) => api.entrar(...a),
    comecar: (...a: unknown[]) => api.comecar(...a),
    estado: (...a: unknown[]) => api.estado(...a),
    responder: (...a: unknown[]) => api.responder(...a),
    sair: (...a: unknown[]) => api.sair(...a),
    enviarMensagem: (...a: unknown[]) => api.enviarMensagem(...a),
    denunciarChat: (...a: unknown[]) => api.denunciarChat(...a),
  },
}));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/BackButton", () => ({ default: () => null }));

let mockProfile: { id: string } | null = null;
vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: mockProfile, loading: false }),
}));
const recarregar = vi.fn();
vi.mock("@/contexts/CarteiraJogoContext", () => ({
  useCarteiraJogo: () => ({ recarregar: (...a: unknown[]) => recarregar(...a) }),
}));

import JogoOnline from "./JogoOnline";
import type { JogadorSalaJogo, SalaJogo } from "@/lib/apiClient";

const jogador = (nome: string, extra: Partial<JogadorSalaJogo> = {}): JogadorSalaJogo => ({
  nome,
  eu: false,
  anfitriao: false,
  pontos: 0,
  acertos: 0,
  respondeu: false,
  resposta: null,
  certa: null,
  pontos_ronda: null,
  vencedor: false,
  ...extra,
});

const ANA = jogador("Ana", { eu: true, anfitriao: true });
const RUI = jogador("Rui");
const PERGUNTA = { id: "p1", texto_pergunta: "Quantos olhos tem uma pessoa?", opcao_a: "Um", opcao_b: "Dois", opcao_c: "Três", opcao_d: "Quatro" };

const sala = (extra: Partial<SalaJogo> = {}): SalaJogo => ({
  codigo: "ABC234",
  estado: "a_aguardar",
  fase: null,
  ronda: 0,
  rondas: 5,
  desempate: 0,
  sou_anfitriao: true,
  jogadores: [ANA],
  pergunta: null,
  tempo_por_pergunta: 30,
  segundos_restantes: null,
  minha_resposta: null,
  revelacao: null,
  motivo_fim: null,
  premio: null,
  chat: { disponivel: false, motivo: "a_espera", eu_adulto: true, mensagens: [] },
  ...extra,
});

const A_DOIS = sala({ jogadores: [ANA, RUI], chat: { disponivel: true, motivo: null, eu_adulto: true, mensagens: [] } });
const EM_JOGO = sala({
  estado: "em_curso",
  fase: "pergunta",
  ronda: 1,
  jogadores: [ANA, RUI],
  pergunta: PERGUNTA,
  segundos_restantes: 28,
  chat: A_DOIS.chat,
});

const erroApi = (status: number, message: string) => Object.assign(new Error(message), { status });

const montar = (caminho = "/jogo-curiosidades/online") =>
  render(
    <MemoryRouter initialEntries={[caminho]}>
      <JogoOnline intervaloMs={25} />
    </MemoryRouter>
  );

/** Abre a página já dentro de uma sala (criada por este jogador). */
const naSala = async (inicial: SalaJogo, seguinte: SalaJogo = inicial) => {
  api.criar.mockResolvedValue(inicial);
  api.estado.mockResolvedValue(seguinte);
  montar();
  await userEvent.click(screen.getByRole("button", { name: "Criar sala" }));
};

describe("JogoOnline (Multijogador Online)", () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    recarregar.mockReset();
    mockProfile = { id: "u1" };
    window.sessionStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("sem sessão, pede para iniciar sessão e não fala com o servidor", () => {
    mockProfile = null;
    montar();

    expect(screen.getByText("Para jogar online é preciso iniciar sessão.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Iniciar sessão" })).toHaveAttribute("href", "/auth");
    expect(screen.queryByRole("button", { name: "Criar sala" })).not.toBeInTheDocument();
    expect(api.estado).not.toHaveBeenCalled();
  });

  it("criar uma sala mostra o código e espera pelo segundo jogador; com dois, o anfitrião pode começar", async () => {
    await naSala(sala(), A_DOIS);

    expect(await screen.findByTestId("codigo-da-sala")).toHaveTextContent("ABC234");
    expect(screen.getByRole("link", { name: "Enviar pelo WhatsApp" })).toHaveAttribute(
      "href",
      expect.stringContaining(encodeURIComponent("/jogo-curiosidades/online?sala=ABC234"))
    );

    api.comecar.mockImplementation(async () => {
      // A partir daqui o servidor já está em jogo.
      api.estado.mockResolvedValue(EM_JOGO);
      return EM_JOGO;
    });
    await userEvent.click(await screen.findByRole("button", { name: "Começar a partida" }));

    expect(api.comecar).toHaveBeenCalledWith("ABC234");
    expect(await screen.findByText(PERGUNTA.texto_pergunta)).toBeInTheDocument();
  });

  it("quem entrou pelo código espera que o anfitrião comece", async () => {
    const visto = sala({
      sou_anfitriao: false,
      jogadores: [jogador("Rui", { anfitriao: true }), jogador("Ana", { eu: true })],
    });
    api.entrar.mockResolvedValue(visto);
    api.estado.mockResolvedValue(visto);
    montar();

    await userEvent.type(screen.getByLabelText("Código da sala"), "abc-234");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(api.entrar).toHaveBeenCalledWith("ABC234");
    expect(await screen.findByText("À espera que Rui comece a partida...")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Começar a partida" })).not.toBeInTheDocument();
  });

  it.each([
    [erroApi(404, "sala não encontrada"), "Não há nenhuma sala com esse código."],
    [erroApi(409, "sala_cheia"), "Essa sala já tem dois jogadores."],
    [erroApi(409, "sala_ja_comecou"), "Essa partida já começou."],
    [new Error("sem rede"), "Não foi possível. Tente outra vez."],
  ])("entrar numa sala que não dá mostra o motivo e fica no início", async (erro, texto) => {
    api.entrar.mockRejectedValue(erro);
    montar("/jogo-curiosidades/online?sala=zzz999");

    // O código do link vem já preenchido.
    expect(screen.getByLabelText("Código da sala")).toHaveValue("ZZZ999");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(texto);
    expect(screen.getByRole("button", { name: "Criar sala" })).toBeInTheDocument();
  });

  it("responder envia a opção ao servidor e fica à espera do outro jogador", async () => {
    await naSala(EM_JOGO);
    const respondida = { ...EM_JOGO, minha_resposta: "B" as const, jogadores: [{ ...ANA, respondeu: true }, RUI] };
    api.responder.mockImplementation(async () => {
      // A partir daqui o servidor já sabe da resposta.
      api.estado.mockResolvedValue(respondida);
      return respondida;
    });

    expect(await screen.findByText("Ronda 1 de 5")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Dois/ }));

    expect(api.responder).toHaveBeenCalledWith("ABC234", "p1", "B");
    expect(await screen.findByText("À espera de Rui...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Três/ })).toBeDisabled();
    // Não se sabe ainda se acertou: isso só vem com a ronda fechada.
    expect(screen.queryByText(/Certo!|Errado\./)).not.toBeInTheDocument();
  });

  it("se a resposta não chegar ao servidor, avisa e deixa tentar outra vez", async () => {
    await naSala(EM_JOGO);
    api.responder.mockRejectedValueOnce(new Error("sem rede"));

    await userEvent.click(await screen.findByRole("button", { name: /Dois/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível enviar a resposta.");
    expect(screen.getByRole("button", { name: /Dois/ })).toBeEnabled();
  });

  it("com a ronda fechada mostra a resposta certa, a explicação e os pontos dos dois", async () => {
    await naSala(
      sala({
        ...EM_JOGO,
        fase: "revelacao",
        segundos_restantes: null,
        revelacao: { resposta_correta: "B", explicacao: "Temos dois olhos." },
        jogadores: [
          { ...ANA, respondeu: true, resposta: "B", certa: true, pontos_ronda: 140, pontos: 140, acertos: 1 },
          { ...RUI, respondeu: true, resposta: "C", certa: false, pontos_ronda: 0 },
        ],
      })
    );

    expect(await screen.findByText("Certo! +140 pontos")).toBeInTheDocument();
    expect(screen.getByText("Temos dois olhos.")).toBeInTheDocument();
    expect(screen.getByText("+140")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dois/ })).toBeDisabled();
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });

  it("no fim mostra quem ganhou e o prémio que o servidor creditou, e actualiza a carteira uma vez", async () => {
    const terminada = sala({
      estado: "terminada",
      motivo_fim: "completa",
      jogadores: [
        { ...ANA, pontos: 620, acertos: 5, vencedor: true },
        { ...RUI, pontos: 240, acertos: 2 },
      ],
      premio: { moedas_ganhas: 80, limite_diario_atingido: false },
      chat: A_DOIS.chat,
    });
    await naSala(EM_JOGO, terminada);

    expect(await screen.findByRole("heading", { name: "Ganhou!" })).toBeInTheDocument();
    expect(screen.getByText("+80 moedas na sua conta")).toBeInTheDocument();
    await waitFor(() => expect(api.estado.mock.calls.length).toBeGreaterThan(2));
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it("quando o outro desiste, diz que ele saiu; com o limite diário, diz que não creditou", async () => {
    await naSala(
      EM_JOGO,
      sala({
        estado: "terminada",
        motivo_fim: "desistencia",
        jogadores: [{ ...ANA, vencedor: true }, RUI],
        premio: { moedas_ganhas: 0, limite_diario_atingido: true },
      })
    );

    expect(await screen.findByText("O outro jogador saiu da partida.")).toBeInTheDocument();
    expect(screen.getByText(/Já atingiu o limite de moedas de hoje/)).toBeInTheDocument();
    expect(screen.queryByText(/moedas na sua conta/)).not.toBeInTheDocument();
  });

  it("sem ligação avisa e continua na mesma pergunta; quando a ligação volta, o aviso sai", async () => {
    await naSala(EM_JOGO);
    await screen.findByText(PERGUNTA.texto_pergunta);
    api.estado.mockRejectedValue(new Error("sem rede"));

    expect(await screen.findByText("Sem ligação. A tentar de novo...")).toBeInTheDocument();
    expect(screen.getByText(PERGUNTA.texto_pergunta)).toBeInTheDocument();
    expect(screen.queryByText("Fim da partida")).not.toBeInTheDocument();

    api.estado.mockResolvedValue(EM_JOGO);
    await waitFor(() => expect(screen.queryByText("Sem ligação. A tentar de novo...")).not.toBeInTheDocument());
  });

  it("se a sala deixar de existir, volta ao início e diz porquê", async () => {
    await naSala(sala());
    await screen.findByTestId("codigo-da-sala");
    api.estado.mockRejectedValue(erroApi(404, "sala não encontrada"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Esta sala já não existe.");
    expect(screen.getByRole("button", { name: "Criar sala" })).toBeInTheDocument();
  });

  it("desistir avisa o servidor e volta ao início", async () => {
    await naSala(EM_JOGO);
    api.sair.mockResolvedValue(undefined);

    await userEvent.click(await screen.findByRole("button", { name: "Desistir da partida" }));

    expect(api.sair).toHaveBeenCalledWith("ABC234");
    expect(await screen.findByRole("button", { name: "Criar sala" })).toBeInTheDocument();
  });

  it("recarregar a página a meio volta à mesma sala", async () => {
    window.sessionStorage.setItem("jogo.salaOnline", "ABC234");
    api.estado.mockResolvedValue(EM_JOGO);
    montar();

    expect(await screen.findByText(PERGUNTA.texto_pergunta)).toBeInTheDocument();
    expect(api.estado).toHaveBeenCalledWith("ABC234");
  });

  describe("chat", () => {
    const COM_MENSAGENS = sala({
      ...A_DOIS,
      chat: {
        disponivel: true,
        motivo: null,
        eu_adulto: true,
        mensagens: [
          { id: "m1", minha: false, nome: "Rui", texto: "Boa sorte!" },
          { id: "m2", minha: true, nome: "Ana", texto: "Igualmente" },
        ],
      },
    });

    it("à espera do segundo jogador não há chat", async () => {
      await naSala(sala());
      await screen.findByTestId("codigo-da-sala");

      expect(screen.queryByRole("region", { name: "Chat da sala" })).not.toBeInTheDocument();
    });

    it("entre dois adultos mostra as mensagens e envia pelo servidor", async () => {
      await naSala(COM_MENSAGENS);
      api.enviarMensagem.mockResolvedValue(COM_MENSAGENS);

      expect(await screen.findByText("Boa sorte!")).toBeInTheDocument();
      await userEvent.type(screen.getByLabelText("Escreva uma mensagem"), "Vamos a isso");
      await userEvent.click(screen.getByRole("button", { name: "Enviar" }));

      expect(api.enviarMensagem).toHaveBeenCalledWith("ABC234", "Vamos a isso");
      await waitFor(() => expect(screen.getByLabelText("Escreva uma mensagem")).toHaveValue(""));
    });

    it.each([
      [erroApi(422, "mensagem_recusada:linguagem"), /linguagem que não é permitida/],
      [erroApi(422, "mensagem_recusada:contacto"), /não se podem partilhar contactos/],
      [erroApi(422, "mensagem_recusada:dados_pessoais"), /pedir nem partilhar dados pessoais/],
      [erroApi(429, "mensagem_depressa_demais"), /Espere um pouco/],
      [new Error("sem rede"), /Não foi possível enviar a mensagem/],
    ])("uma mensagem recusada mostra o motivo e não se perde o que estava escrito", async (erro, texto) => {
      await naSala(COM_MENSAGENS);
      api.enviarMensagem.mockRejectedValue(erro);

      await userEvent.type(await screen.findByLabelText("Escreva uma mensagem"), "o meu número");
      await userEvent.click(screen.getByRole("button", { name: "Enviar" }));

      expect(await screen.findByText(texto)).toBeInTheDocument();
      expect(screen.getByLabelText("Escreva uma mensagem")).toHaveValue("o meu número");
    });

    it("conta que não é de adulto: sem caixa de mensagens, com a explicação e o caminho para o perfil", async () => {
      await naSala(
        sala({ ...A_DOIS, chat: { disponivel: false, motivo: "so_adultos", eu_adulto: false, mensagens: [] } })
      );

      expect(await screen.findByText(/O chat é só para adultos/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Ir ao perfil" })).toHaveAttribute("href", "/editar-perfil");
      expect(screen.queryByLabelText("Escreva uma mensagem")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Denunciar" })).not.toBeInTheDocument();
    });

    it("adulto numa sala com um menor: explica que o chat precisa dos dois adultos", async () => {
      await naSala(
        sala({ ...A_DOIS, chat: { disponivel: false, motivo: "so_adultos", eu_adulto: true, mensagens: [] } })
      );

      expect(await screen.findByText(/quando os dois jogadores são adultos/)).toBeInTheDocument();
      expect(screen.queryByLabelText("Escreva uma mensagem")).not.toBeInTheDocument();
    });

    it("denunciar pede confirmação e depois fecha o chat", async () => {
      const fechado = sala({
        ...A_DOIS,
        chat: { disponivel: false, motivo: "denunciado", eu_adulto: true, mensagens: [] },
      });
      await naSala(COM_MENSAGENS);
      api.denunciarChat.mockImplementation(async () => {
        api.estado.mockResolvedValue(fechado);
        return fechado;
      });

      await userEvent.click(await screen.findByRole("button", { name: "Denunciar" }));
      expect(api.denunciarChat).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole("button", { name: "Denunciar e fechar o chat" }));

      expect(api.denunciarChat).toHaveBeenCalledWith("ABC234");
      expect(await screen.findByText(/foi fechado depois de uma denúncia/)).toBeInTheDocument();
      expect(screen.queryByText("Boa sorte!")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Escreva uma mensagem")).not.toBeInTheDocument();
    });
  });
});
