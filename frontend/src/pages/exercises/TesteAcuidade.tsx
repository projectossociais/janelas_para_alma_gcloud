import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import AnelLandolt from "@/components/visao/AnelLandolt";
import AssistenteTeste, { type ContextoTeste } from "@/components/visao/AssistenteTeste";
import PaginaExercicio from "@/components/visao/PaginaExercicio";
import { CartaoOlho, EcraResultado } from "@/components/visao/Resultados";
import TarefaAnelTeste, { type FimTarefaAnel } from "@/components/visao/TarefaAnelTeste";
import { useRegistoSessao } from "@/components/visao/hooks";
import { formatarDecimal, separadorDecimal } from "@/i18n/formatar";
import { indiceMaisProximo } from "@/lib/visao/escada";
import {
  DISTANCIA_LONGE_MM,
  NIVEIS_TESTE_ACUIDADE,
  aberturaPx,
  fraccao6,
  logmarParaDecimal,
  niveisDesenhaveis,
} from "@/lib/visao/geometria";
import { OLHOS, sinaisAcuidade, type Olho } from "@/lib/visao/resultados";
import { ID_ACUIDADE } from "@/lib/visao/ids";

const EXERCICIO_ID = ID_ACUIDADE;

/** O anel maior (5 x abertura) não pode passar de ~70% da largura do palco. */
const DIAMETRO_MAX_PX = 260;

export interface ResultadoAcuidade {
  /** logMAR do nível mais pequeno lido; `null` = nem o maior. */
  limiar: number | null;
  /** Leu o nível mais pequeno que o ecrã consegue desenhar. */
  limiteEcra: boolean;
  segundosActivos: number;
  duracaoSegundos: number;
}

/** Níveis desenháveis neste ecrã/distância, sem anéis maiores do que o palco. */
function niveisAcuidade(ctx: ContextoTeste): number[] {
  return niveisDesenhaveis(NIVEIS_TESTE_ACUIDADE, ctx.distanciaMm, ctx.pxPorMm, ctx.devicePixelRatio).filter(
    (l) => aberturaPx(l, ctx.distanciaMm, ctx.pxPorMm) * 5 <= DIAMETRO_MAX_PX,
  );
}

/** Calibração impossível (ecrã minúsculo ou valores absurdos): não há níveis. */
const EcraSemNiveis = () => {
  const { t } = useTranslation();
  return <p className="py-10 text-center text-sm text-muted-foreground">{t("Visao.semNiveisNesteEcra")}</p>;
};

const TarefaAcuidade = ({ ctx, aoTerminar }: { ctx: ContextoTeste; aoTerminar: (r: ResultadoAcuidade) => void }) => {
  const niveis = useMemo(() => niveisAcuidade(ctx), [ctx]);
  // Começa em 0,7 (0,4 a 1 m): grande o bastante para quase todos lerem.
  const inicio = indiceMaisProximo(niveis, ctx.distanciaMm >= DISTANCIA_LONGE_MM ? 0.4 : 0.7);
  if (!niveis.length) return <EcraSemNiveis />;
  return (
    <TarefaAnelTeste
      totalNiveis={niveis.length}
      indiceInicial={inicio}
      estimulo={(i, d) => <AnelLandolt aberturaPx={aberturaPx(niveis[i], ctx.distanciaMm, ctx.pxPorMm)} direccao={d} />}
      aoTerminar={({ escada, segundosActivos, duracaoSegundos }: FimTarefaAnel) =>
        aoTerminar({
          limiar: escada.limiar === null ? null : niveis[escada.limiar],
          limiteEcra: escada.atingiuLimite,
          segundosActivos,
          duracaoSegundos,
        })
      }
    />
  );
};

const ResultadoAcuidadeEcra = ({
  res,
  ctx,
  repetirA,
}: {
  res: Record<Olho, ResultadoAcuidade>;
  ctx: ContextoTeste;
  repetirA: (mm: number) => void;
}) => {
  const { t } = useTranslation();
  const { estado, gravar, tentarDeNovo } = useRegistoSessao();
  const gravou = useRef(false);

  useEffect(() => {
    if (gravou.current) return;
    gravou.current = true;
    void gravar(
      OLHOS.map((olho) => ({
        exercicio_id: EXERCICIO_ID,
        olho,
        duracao_segundos: res[olho].duracaoSegundos,
        segundos_activos: res[olho].segundosActivos,
        limiar: res[olho].limiar,
        unidade: "logmar" as const,
        distancia_mm: ctx.distanciaMm,
        px_por_mm: Math.round(ctx.pxPorMm * 1000) / 1000,
        calibrado: ctx.calibrado,
        sinais: {
          limite_ecra: res[olho].limiteEcra,
          nao_leu_o_maior: res[olho].limiar === null,
          com_correccao: ctx.usaCorreccao,
        },
      })),
    );
  }, [ctx, gravar, res]);

  const s = sinaisAcuidade({ direito: res.direito.limiar, esquerdo: res.esquerdo.limiar });
  const sinais = [
    ...s.abaixoDe6_9.map((o) => (o === "direito" ? t("Visao.acuidadeSinalDireito") : t("Visao.acuidadeSinalEsquerdo"))),
    ...(s.diferencaEntreOlhos ? [t("Visao.acuidadeSinalDiferenca")] : []),
  ];
  const algumLimite = OLHOS.some((o) => res[o].limiteEcra);

  return (
    <EcraResultado
      titulo={t("Visao.resultadoAcuidadeTitulo")}
      gravacao={estado}
      aoTentarDeNovo={() => void tentarDeNovo()}
      sinais={sinais}
      cartoes={OLHOS.map((olho) => {
        const r = res[olho];
        const titulo = olho === "direito" ? t("Visao.olhoDireito") : t("Visao.olhoEsquerdo");
        if (r.limiar === null)
          return (
            <CartaoOlho key={olho} titulo={titulo} estado="sinal">
              {t("Visao.acuidadeNaoLeuOMaior")}
            </CartaoOlho>
          );
        const prefixo = r.limiteEcra ? "≥ " : "";
        return (
          <CartaoOlho key={olho} titulo={titulo} estado={s.abaixoDe6_9.includes(olho) ? "sinal" : "ok"}>
            <p className="text-2xl font-bold text-foreground">
              {prefixo}
              {fraccao6(r.limiar, separadorDecimal())}
            </p>
            <p>
              {t("Visao.decimal")}: {prefixo}
              {formatarDecimal(logmarParaDecimal(r.limiar), 2)} · logMAR {formatarDecimal(r.limiar, 1)}
            </p>
          </CartaoOlho>
        );
      })}
      notas={
        <div className="space-y-2 text-center text-xs text-muted-foreground">
          {!ctx.calibrado && <p>{t("Visao.semCartaoAviso")}</p>}
          {algumLimite && <p>{t("Visao.acuidadeLimiteEcra")}</p>}
        </div>
      }
      accoesExtra={
        algumLimite && ctx.distanciaMm < DISTANCIA_LONGE_MM ? (
          <Button variant="outline" size="lg" className="w-full gap-2 sm:w-auto" onClick={() => repetirA(DISTANCIA_LONGE_MM)}>
            <Ruler className="h-4 w-4" />
            {t("Visao.repetirAUmMetro")}
          </Button>
        ) : undefined
      }
    />
  );
};

const TesteAcuidade = () => {
  const { t } = useTranslation();
  return (
    <PaginaExercicio>
      <AssistenteTeste<ResultadoAcuidade>
        exercicioId={EXERCICIO_ID}
        grupo="trial"
        titulo={t("Visao.acuidadeTitulo")}
        descricao={t("Visao.acuidadeDescricao")}
        tarefa={(_olho, ctx, aoTerminar) => <TarefaAcuidade ctx={ctx} aoTerminar={aoTerminar} />}
        resultado={(res, ctx, repetirA) => <ResultadoAcuidadeEcra res={res} ctx={ctx} repetirA={repetirA} />}
      />
    </PaginaExercicio>
  );
};

export default TesteAcuidade;
