import { agendamentosApi, publicacoesApi, type ClinicaParceiraPublica, type PublicacaoPublica } from "@/lib/apiClient";

/**
 * O que a pesquisa do site vai buscar à API: as publicações e as clínicas
 * parceiras (ambas públicas). Pede-se uma vez e serve durante uns minutos,
 * para abrir a lupa noutra página não repetir os pedidos.
 */

export interface DadosDaApi {
  publicacoes: PublicacaoPublica[];
  clinicas: ClinicaParceiraPublica[];
  /** Algum dos pedidos falhou: a pesquisa continua, mas avisa que está incompleta. */
  incompleto: boolean;
}

/** Quanto tempo as publicações e as clínicas pedidas servem para as pesquisas seguintes. */
const VALIDADE_MS = 5 * 60 * 1000;
let guardado: { quando: number; dados: Promise<DadosDaApi> } | null = null;

/** Só para os testes: esquece o que foi pedido à API. */
export function esquecerDadosDaPesquisa() {
  guardado = null;
}

export function pedirDadosDaApi(): Promise<DadosDaApi> {
  if (guardado && Date.now() - guardado.quando < VALIDADE_MS) return guardado.dados;
  const dados = Promise.allSettled([publicacoesApi.listarPublicadas(), agendamentosApi.listarClinicas()]).then(
    ([publicacoes, clinicas]) => {
      const incompleto = publicacoes.status === "rejected" || clinicas.status === "rejected";
      // Uma falha não fica guardada: a próxima abertura tenta outra vez.
      if (incompleto) guardado = null;
      return {
        publicacoes: publicacoes.status === "fulfilled" ? publicacoes.value : [],
        clinicas: clinicas.status === "fulfilled" ? clinicas.value : [],
        incompleto,
      };
    },
  );
  guardado = { quando: Date.now(), dados };
  return dados;
}

