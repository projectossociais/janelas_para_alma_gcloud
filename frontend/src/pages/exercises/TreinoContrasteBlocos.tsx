import { useTranslation } from "react-i18next";
import AnelLandolt from "@/components/visao/AnelLandolt";
import AssistenteTreino from "@/components/visao/AssistenteTreino";
import PaginaExercicio from "@/components/visao/PaginaExercicio";
import { RequisitoTeste, ultimaDoTeste } from "@/components/visao/RequisitoTeste";
import TarefaAnelTreino from "@/components/visao/TarefaAnelTreino";
import { formatarDecimal } from "@/i18n/formatar";
import {
  DEGRAUS_TREINO_CONTRASTE,
  contrasteDoCinzento,
  corCinzento,
  degrausMostraveis,
  sensibilidade,
} from "@/lib/visao/contraste";
import { indiceMaisProximo, limiarTreino, valorNoIndice } from "@/lib/visao/escada";
import { aberturaPx } from "@/lib/visao/geometria";
import { MARGEM_CONTRASTE_LOGMAR } from "@/lib/visao/treino";
import { ID_ACUIDADE, ID_CONTRASTE, ID_CONTRASTE_BLOCOS } from "@/lib/visao/ids";

const EXERCICIO_ID = ID_CONTRASTE_BLOCOS;

const DEGRAUS = degrausMostraveis(DEGRAUS_TREINO_CONTRASTE);
/** Sensibilidade (log) de cada degrau, para escolher o início e interpolar o limiar. */
const LOG_CS = DEGRAUS.map((d) => -Math.log10(d.real));
/** Começa 0,3 log abaixo (mais fácil) do último limiar do teste. */
const FOLGA_INICIO_LOG_CS = 0.3;

const TreinoContrasteBlocos = () => {
  const { t } = useTranslation();
  return (
    <PaginaExercicio>
      <AssistenteTreino
        exercicioId={EXERCICIO_ID}
        grupo="premium"
        titulo={t("Visao.contrasteBlocosTitulo")}
        descricao={t("Visao.contrasteBlocosDescricao")}
        monocular
        comDistancia
        requisito={(ctx) => {
          const acuidade = ultimaDoTeste(ctx.historico, ID_ACUIDADE, ctx.olho);
          return acuidade?.limiar != null ? null : (
            <RequisitoTeste caminho="/exercicios/acuidade" nomeDoTeste={t("Visao.acuidadeTitulo")} />
          );
        }}
        tarefa={(api, ctx, resultado) => {
          const acuidade = ultimaDoTeste(ctx.historico, ID_ACUIDADE, ctx.olho)?.limiar ?? 0.5;
          // Tamanho fixo: limiar de acuidade daquele olho + 0,3 logMAR.
          const gap = Math.max(
            aberturaPx(acuidade + MARGEM_CONTRASTE_LOGMAR, ctx.distanciaMm, ctx.pxPorMm),
            3 / ctx.devicePixelRatio,
          );
          const ultimoCs = ultimaDoTeste(ctx.historico, ID_CONTRASTE, ctx.olho)?.limiar;
          const inicio = ultimoCs != null ? indiceMaisProximo(LOG_CS, Math.max(0, ultimoCs - FOLGA_INICIO_LOG_CS)) : 0;
          return (
            <TarefaAnelTreino
              api={api}
              resultado={resultado}
              totalNiveis={DEGRAUS.length}
              indiceInicial={inicio}
              estimulo={(i, d) => <AnelLandolt aberturaPx={gap} direccao={d} cor={corCinzento(DEGRAUS[i].cinzento)} />}
              calcularResultado={(escada) => {
                const indice = limiarTreino(escada);
                const cs = indice === null ? null : Math.round(valorNoIndice(LOG_CS, indice) * 100) / 100;
                return {
                  limiar: cs,
                  unidade: "log_cs",
                  resumo:
                    cs === null
                      ? t("Visao.contrasteBlocosSemLimiar")
                      : t("Visao.contrasteBlocosResumo", { valor: formatarDecimal(cs, 2) }),
                  sinais: {
                    tamanho_logmar: Math.round((acuidade + MARGEM_CONTRASTE_LOGMAR) * 100) / 100,
                    melhor_contraste: Math.round(contrasteDoCinzento(DEGRAUS[escada.melhor].cinzento) * 10000) / 10000,
                    melhor_log_cs: sensibilidade(DEGRAUS[escada.melhor].real),
                  },
                };
              }}
            />
          );
        }}
      />
    </PaginaExercicio>
  );
};

export default TreinoContrasteBlocos;
