import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Botao } from "@/design/componentes/Botao";
import AssistenteTeste, { type ContextoTeste } from "@/components/visao/AssistenteTeste";
import PalcoVisual from "@/components/visao/PalcoVisual";
import { CartaoOlho, EcraResultado } from "@/components/visao/Resultados";
import { useRegistoSessao } from "@/components/visao/hooks";
import { aberturaPx } from "@/lib/visao/geometria";
import { OLHOS, type Olho } from "@/lib/visao/resultados";
import { ID_ASTIGMATISMO } from "@/lib/visao/ids";

const EXERCICIO_ID = ID_ASTIGMATISMO;

/** Linhas do leque: de 0 a 180 graus, de 15 em 15. */
const ANGULOS = Array.from({ length: 13 }, (_, i) => i * 15);

interface ResultadoAstigmatismo {
  /** true = "Não, há linhas mais escuras" -> sinal nesse olho. */
  sinal: boolean;
  segundos: number;
}

/**
 * Leque de linhas pretas (semicírculo), todas com a mesma espessura --
 * padrão público. Espessura de ~0,5 logMAR à distância escolhida, para as
 * linhas serem nítidas sem serem grossas.
 */
const Leque = ({ ctx }: { ctx: ContextoTeste }) => {
  const raio = 120;
  const espessura = Math.max(aberturaPx(0.5, ctx.distanciaMm, ctx.pxPorMm), 2 / ctx.devicePixelRatio);
  // Em px CSS 1:1; num ecrã estreito encolhe por inteiro (viewBox), sem deformar.
  const lado = raio * 2 + 20;
  return (
    <svg
      width={lado}
      viewBox={`0 0 ${lado} ${raio + 20}`}
      aria-hidden
      style={{ display: "block", maxWidth: "100%", height: "auto" }}
    >
      <g transform={`translate(${lado / 2} ${raio + 10})`}>
        {ANGULOS.map((a) => {
          const rad = (a * Math.PI) / 180;
          return (
            <line
              key={a}
              x1={Math.cos(rad) * 18}
              y1={-Math.sin(rad) * 18}
              x2={Math.cos(rad) * raio}
              y2={-Math.sin(rad) * raio}
              stroke="#000"
              strokeWidth={espessura}
              strokeLinecap="butt"
            />
          );
        })}
      </g>
    </svg>
  );
};

const TarefaAstigmatismo = ({
  ctx,
  aoTerminar,
}: {
  ctx: ContextoTeste;
  aoTerminar: (r: ResultadoAstigmatismo) => void;
}) => {
  const { t } = useTranslation();
  const [inicio] = useState(() => Date.now());
  const responder = (mesmoTom: boolean) =>
    aoTerminar({ sinal: !mesmoTom, segundos: Math.max(1, Math.round((Date.now() - inicio) / 1000)) });
  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-center text-sm text-muted-foreground">{t("Visao.astigmatismoInstrucao")}</p>
      <PalcoVisual className="py-6" rotulo={t("Visao.rotuloLeque")}>
        <Leque ctx={ctx} />
      </PalcoVisual>
      <p className="text-center font-semibold text-foreground">{t("Visao.astigmatismoPergunta")}</p>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Botao tamanho="g" className="sm:min-w-40" onClick={() => responder(true)}>
          {t("Visao.sim")}
        </Botao>
        <Botao tamanho="g" variante="secundario" className="sm:min-w-40" onClick={() => responder(false)}>
          {t("Visao.naoHaLinhasMaisEscuras")}
        </Botao>
      </div>
    </div>
  );
};

const ResultadoAstigmatismoEcra = ({ res, ctx }: { res: Record<Olho, ResultadoAstigmatismo>; ctx: ContextoTeste }) => {
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
        duracao_segundos: res[olho].segundos,
        segundos_activos: res[olho].segundos,
        limiar: null,
        distancia_mm: ctx.distanciaMm,
        px_por_mm: Math.round(ctx.pxPorMm * 1000) / 1000,
        calibrado: ctx.calibrado,
        sinais: { astigmatismo: res[olho].sinal, com_correccao: ctx.usaCorreccao },
      })),
    );
  }, [ctx, gravar, res]);

  const sinais = OLHOS.filter((o) => res[o].sinal).map((o) =>
    o === "direito" ? t("Visao.astigmatismoSinalDireito") : t("Visao.astigmatismoSinalEsquerdo"),
  );
  return (
    <EcraResultado
      titulo={t("Visao.resultadoAstigmatismoTitulo")}
      gravacao={estado}
      aoTentarDeNovo={() => void tentarDeNovo()}
      sinais={sinais}
      cartoes={OLHOS.map((olho) => (
        <CartaoOlho
          key={olho}
          titulo={olho === "direito" ? t("Visao.olhoDireito") : t("Visao.olhoEsquerdo")}
          estado={res[olho].sinal ? "sinal" : "ok"}
        >
          {res[olho].sinal ? t("Visao.astigmatismoRespostaNao") : t("Visao.astigmatismoRespostaSim")}
        </CartaoOlho>
      ))}
    />
  );
};

const TesteAstigmatismo = () => {
  const { t } = useTranslation();
  return (
    <AssistenteTeste<ResultadoAstigmatismo>
      exercicioId={EXERCICIO_ID}
      grupo="trial"
      titulo={t("Visao.astigmatismoTitulo")}
      descricao={t("Visao.astigmatismoDescricao")}
      tarefa={(_olho, ctx, aoTerminar) => <TarefaAstigmatismo ctx={ctx} aoTerminar={aoTerminar} />}
      resultado={(res, ctx) => <ResultadoAstigmatismoEcra res={res} ctx={ctx} />}
    />
  );
};

export default TesteAstigmatismo;
