import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import AnelLandolt from "@/components/visao/AnelLandolt";
import AssistenteTeste, { type ContextoTeste } from "@/components/visao/AssistenteTeste";
import PaginaExercicio from "@/components/visao/PaginaExercicio";
import { CartaoOlho, EcraResultado } from "@/components/visao/Resultados";
import TarefaAnelTeste from "@/components/visao/TarefaAnelTeste";
import { useHistoricoVisao, useRegistoSessao } from "@/components/visao/hooks";
import { formatarData, formatarDecimal } from "@/i18n/formatar";
import { DEGRAUS_TESTE_CONTRASTE, corCinzento, degrausMostraveis, sensibilidade } from "@/lib/visao/contraste";
import { aberturaPx } from "@/lib/visao/geometria";
import { OLHOS, diferencaContraste, type Olho } from "@/lib/visao/resultados";
import { LOGMAR_TESTE_CONTRASTE } from "@/lib/visao/treino";
import { ID_CONTRASTE } from "@/lib/visao/ids";

const EXERCICIO_ID = ID_CONTRASTE;

interface ResultadoContraste {
  /** -log10 do contraste limiar; `null` = nem o de 100%. */
  logCs: number | null;
  /** Viu o degrau mais fraco que o ecrã mostra. */
  limiteEcra: boolean;
  segundosActivos: number;
  duracaoSegundos: number;
}

const DEGRAUS = degrausMostraveis(DEGRAUS_TESTE_CONTRASTE);

const TarefaContraste = ({ ctx, aoTerminar }: { ctx: ContextoTeste; aoTerminar: (r: ResultadoContraste) => void }) => {
  // Tamanho fixo, bem acima do limiar de acuidade (~0,5 logMAR), e nunca
  // mais pequeno do que o ecrã desenha bem.
  const gap = Math.max(aberturaPx(LOGMAR_TESTE_CONTRASTE, ctx.distanciaMm, ctx.pxPorMm), 3 / ctx.devicePixelRatio);
  return (
    <TarefaAnelTeste
      totalNiveis={DEGRAUS.length}
      indiceInicial={0}
      estimulo={(i, d) => <AnelLandolt aberturaPx={gap} direccao={d} cor={corCinzento(DEGRAUS[i].cinzento)} />}
      aoTerminar={({ escada, segundosActivos, duracaoSegundos }) =>
        aoTerminar({
          logCs: escada.limiar === null ? null : sensibilidade(DEGRAUS[escada.limiar].real),
          limiteEcra: escada.atingiuLimite,
          segundosActivos,
          duracaoSegundos,
        })
      }
    />
  );
};

const ResultadoContrasteEcra = ({ res, ctx }: { res: Record<Olho, ResultadoContraste>; ctx: ContextoTeste }) => {
  const { t } = useTranslation();
  const { estado, gravar, tentarDeNovo } = useRegistoSessao();
  // O histórico carrega antes de gravar esta sessão: "anterior" é mesmo anterior.
  const { ultimo, carregando } = useHistoricoVisao();
  const anteriores = useMemo(
    () => (carregando ? null : { direito: ultimo(EXERCICIO_ID, "direito"), esquerdo: ultimo(EXERCICIO_ID, "esquerdo") }),
    [carregando, ultimo],
  );
  const gravou = useRef(false);

  useEffect(() => {
    if (gravou.current || anteriores === null) return;
    gravou.current = true;
    void gravar(
      OLHOS.map((olho) => ({
        exercicio_id: EXERCICIO_ID,
        olho,
        duracao_segundos: res[olho].duracaoSegundos,
        segundos_activos: res[olho].segundosActivos,
        limiar: res[olho].logCs,
        unidade: "log_cs" as const,
        distancia_mm: ctx.distanciaMm,
        px_por_mm: Math.round(ctx.pxPorMm * 1000) / 1000,
        calibrado: ctx.calibrado,
        sinais: { limite_ecra: res[olho].limiteEcra, com_correccao: ctx.usaCorreccao },
      })),
    );
  }, [anteriores, ctx, gravar, res]);

  const diferenca = diferencaContraste({
    direito: res.direito.logCs ?? undefined,
    esquerdo: res.esquerdo.logCs ?? undefined,
  });
  const naoViu = OLHOS.filter((o) => res[o].logCs === null);
  const sinais = [
    ...(diferenca ? [t("Visao.contrasteSinalDiferenca")] : []),
    ...naoViu.map((o) => (o === "direito" ? t("Visao.contrasteNaoViuDireito") : t("Visao.contrasteNaoViuEsquerdo"))),
  ];

  return (
    <EcraResultado
      titulo={t("Visao.resultadoContrasteTitulo")}
      gravacao={estado}
      aoTentarDeNovo={() => void tentarDeNovo()}
      sinais={sinais}
      cartoes={OLHOS.map((olho) => {
        const r = res[olho];
        const anterior = anteriores?.[olho];
        return (
          <CartaoOlho
            key={olho}
            titulo={olho === "direito" ? t("Visao.olhoDireito") : t("Visao.olhoEsquerdo")}
            estado={r.logCs === null ? "sinal" : diferenca ? "indeterminado" : "ok"}
          >
            {r.logCs === null ? (
              t("Visao.contrasteNaoViu")
            ) : (
              <>
                <p className="text-2xl font-bold text-foreground">
                  {r.limiteEcra ? "≥ " : ""}
                  {formatarDecimal(r.logCs, 2)}
                </p>
                <p>{t("Visao.sensibilidadeLog")}</p>
              </>
            )}
            {anterior?.limiar != null && (
              <p className="mt-1 text-xs">
                {t("Visao.anterior", { valor: formatarDecimal(anterior.limiar, 2), data: formatarData(anterior.created_at) })}
              </p>
            )}
          </CartaoOlho>
        );
      })}
      notas={<p className="text-center text-xs text-muted-foreground">{t("Visao.contrasteSemNorma")}</p>}
    />
  );
};

const TesteContraste = () => {
  const { t } = useTranslation();
  return (
    <PaginaExercicio>
      <AssistenteTeste<ResultadoContraste>
        exercicioId={EXERCICIO_ID}
        grupo="trial"
        titulo={t("Visao.contrasteTitulo")}
        descricao={t("Visao.contrasteDescricao")}
        tarefa={(_olho, ctx, aoTerminar) => <TarefaContraste ctx={ctx} aoTerminar={aoTerminar} />}
        resultado={(res, ctx) => <ResultadoContrasteEcra res={res} ctx={ctx} />}
      />
    </PaginaExercicio>
  );
};

export default TesteContraste;
