import {
  jogoLocalApi,
  type PartidaLocalTerminadaJogo,
  type PerguntaJogoPublica,
  type RespostaLocalJogo,
  type RespostaOpcaoJogo,
} from "@/lib/apiClient";
import { obterPerguntaOfflineNaoVista, obterPerguntaOfflinePorId } from "./perguntasOffline";

/**
 * De onde vêm as perguntas de uma partida do Multijogador Local.
 *
 * - Servidor (com sessão): a pergunta e a validação são da API, e a partida
 *   paga moedas ao terminar.
 * - Reserva local (convidados, site inglês, ou servidor inacessível): as
 *   perguntas embutidas no site. As respostas estão no código do cliente, por
 *   isso esta fonte nunca dá prémio.
 */
export interface FontePerguntasLocal {
  comPremio: boolean;
  obterPergunta: (patamar: number) => Promise<PerguntaJogoPublica>;
  /** `resposta: null` = o tempo esgotou. */
  responder: (perguntaId: string, resposta: RespostaOpcaoJogo | null) => Promise<RespostaLocalJogo>;
  /** Só com prémio: fecha a partida no servidor e devolve o que creditou. */
  terminar: () => Promise<PartidaLocalTerminadaJogo | null>;
}

export const criarFonteReservaLocal = (): FontePerguntasLocal => {
  const vistas: string[] = [];
  return {
    comPremio: false,
    obterPergunta: async (patamar) => {
      const pergunta = obterPerguntaOfflineNaoVista(patamar, vistas);
      vistas.push(pergunta.id);
      // Só os campos públicos: a resposta certa não anda pelo estado do ecrã.
      const { id, texto_pergunta, opcao_a, opcao_b, opcao_c, opcao_d } = pergunta;
      return { id, texto_pergunta, opcao_a, opcao_b, opcao_c, opcao_d };
    },
    responder: async (perguntaId, resposta) => {
      const pergunta = obterPerguntaOfflinePorId(perguntaId);
      if (!pergunta) throw new Error(`Pergunta local desconhecida: ${perguntaId}`);
      return {
        correta: resposta === pergunta.resposta_correta,
        resposta_correta: pergunta.resposta_correta,
        explicacao: pergunta.explicacao,
      };
    },
    terminar: async () => null,
  };
};

export const criarFonteServidor = (partidaId: string): FontePerguntasLocal => ({
  comPremio: true,
  obterPergunta: (patamar) => jogoLocalApi.obterPergunta(partidaId, patamar),
  responder: (perguntaId, resposta) => jogoLocalApi.responder(partidaId, perguntaId, resposta),
  terminar: () => jogoLocalApi.terminar(partidaId),
});
