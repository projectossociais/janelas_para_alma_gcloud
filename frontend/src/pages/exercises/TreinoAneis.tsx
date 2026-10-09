import { useTranslation } from "react-i18next";
import AnelLandolt from "@/components/visao/AnelLandolt";
import AssistenteTreino, { type ContextoTreino } from "@/components/visao/AssistenteTreino";
import PaginaExercicio from "@/components/visao/PaginaExercicio";
import { RequisitoTeste, ultimaDoTeste } from "@/components/visao/RequisitoTeste";
import TarefaAnelTreino from "@/components/visao/TarefaAnelTreino";
import { formatarDecimal, separadorDecimal } from "@/i18n/formatar";
import { indiceMaisProximo, limiarTreino, valorNoIndice } from "@/lib/visao/escada";
import { NIVEIS_TREINO_ACUIDADE, aberturaPx, fraccao6, niveisDesenhaveis } from "@/lib/visao/geometria";
import { MARGEM_ANEIS_LOGMAR } from "@/lib/visao/treino";
import { ID_ANEIS, ID_ACUIDADE } from "@/lib/visao/ids";

const EXERCICIO_ID = ID_ANEIS;

const DIAMETRO_MAX_PX = 260;

const niveisTreinoAcuidade = (ctx: ContextoTreino) =>
  niveisDesenhaveis(NIVEIS_TREINO_ACUIDADE, ctx.distanciaMm, ctx.pxPorMm, ctx.devicePixelRatio).filter(
    (l) => aberturaPx(l, ctx.distanciaMm, ctx.pxPorMm) * 5 <= DIAMETRO_MAX_PX,
  );

const TreinoAneis = () => {
  const { t } = useTranslation();
  return (
    <PaginaExercicio>
      <AssistenteTreino
        exercicioId={EXERCICIO_ID}
        grupo="trial"
        titulo={t("Visao.aneisTitulo")}
        descricao={t("Visao.aneisDescricao")}
        monocular
        comDistancia
        requisito={(ctx) =>
          ultimaDoTeste(ctx.historico, ID_ACUIDADE, ctx.olho) ? null : (
            <RequisitoTeste caminho="/exercicios/acuidade" nomeDoTeste={t("Visao.acuidadeTitulo")} />
          )
        }
        tarefa={(api, ctx, resultado) => {
          const niveis = niveisTreinoAcuidade(ctx);
          if (!niveis.length) return <p className="py-10 text-center text-sm">{t("Visao.semNiveisNesteEcra")}</p>;
          // Começa 0,1 logMAR acima (mais fácil) do último limiar do olho treinado.
          const ultimo = ultimaDoTeste(ctx.historico, ID_ACUIDADE, ctx.olho);
          const partida = (ultimo?.limiar ?? niveis[0]) + MARGEM_ANEIS_LOGMAR;
          return (
            <TarefaAnelTreino
              api={api}
              resultado={resultado}
              totalNiveis={niveis.length}
              indiceInicial={indiceMaisProximo(niveis, partida)}
              estimulo={(i, d) => <AnelLandolt aberturaPx={aberturaPx(niveis[i], ctx.distanciaMm, ctx.pxPorMm)} direccao={d} />}
              calcularResultado={(escada) => {
                const limiar = Math.round(valorNoIndice(niveis, limiarTreino(escada)) * 100) / 100;
                return {
                  limiar,
                  unidade: "logmar",
                  resumo: t("Visao.aneisResumo", {
                    fraccao: fraccao6(limiar, separadorDecimal()),
                    logmar: formatarDecimal(limiar, 2),
                  }),
                  sinais: { nivel_inicial: niveis[indiceMaisProximo(niveis, partida)], melhor_nivel: niveis[escada.melhor] },
                };
              }}
            />
          );
        }}
      />
    </PaginaExercicio>
  );
};

export default TreinoAneis;
