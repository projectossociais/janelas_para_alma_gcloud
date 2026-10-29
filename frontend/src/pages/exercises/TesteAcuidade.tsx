import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import AssistenteTeste, { type ContextoTeste } from "@/components/visao/AssistenteTeste";
import BotaoOuvir from "@/components/visao/BotaoOuvir";
import { EcraPasso } from "@/components/visao/EcraPasso";
import PaginaExercicio from "@/components/visao/PaginaExercicio";
import { CartaoOlho, EcraResultado } from "@/components/visao/Resultados";
import { useRegistoSessao, useTempoActivo } from "@/components/visao/hooks";
import { useGestos } from "@/components/visao/useGestos";
import { reconhecimentoDisponivel, useRespostaPorVoz } from "@/components/visao/useRespostaPorVoz";
import { formatarDecimal, separadorDecimal } from "@/i18n/formatar";
import { diferencaEmLinhas } from "@/lib/visao/aglomeracao";
import { indiceMaisProximo, iniciarEscadaTeste, limiarFinoTeste, responderTeste } from "@/lib/visao/escada";
import { fraccao6, logmarParaDecimal } from "@/lib/visao/geometria";
import { ID_ACUIDADE } from "@/lib/visao/ids";
import {
  DIRECCOES_E,
  DISTANCIAS_LONGE_MM,
  FRACCAO_MAX_ECRA,
  LOGMAR_INICIAL_LONGE,
  direccaoAleatoriaE,
  guardarDistanciaLonge,
  ladoDoEPx,
  lerDistanciaLonge,
  niveisPalancaLonge,
  type DireccaoE,
  type DistanciaLonge,
  type RespostaE,
} from "@/lib/visao/palancaLonge";
import { OLHOS, sinaisAcuidade, type Olho } from "@/lib/visao/resultados";
import { falar, sinalSonoro } from "@/lib/visao/voz";
import { cn } from "@/lib/utils";

const EXERCICIO_ID = ID_ACUIDADE;
const CHAVE_VOZ = "jpa.visao.palanca.voz";

export interface ResultadoAcuidade {
  /** logMAR do nível mais pequeno lido; `null` = nem o maior. */
  limiar: number | null;
  /** Leu o nível mais pequeno que o ecrã consegue desenhar. */
  limiteEcra: boolean;
  segundosActivos: number;
  duracaoSegundos: number;
  distanciaMm: DistanciaLonge;
  comVoz: boolean;
}

const arredondar2 = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);

/** A mãozinha (E de Snellen): 5 x 5 traços, dedos para a direita a 0°. */
export const MaozinhaE = ({ ladoPx, direccao }: { ladoPx: number; direccao: DireccaoE }) => (
  <svg width={ladoPx} height={ladoPx} viewBox="0 0 5 5" aria-hidden data-direccao={direccao}>
    <g transform={`rotate(${DIRECCOES_E.indexOf(direccao) * 90} 2.5 2.5)`} fill="#000000">
      <rect x={0} y={0} width={1} height={5} />
      <rect x={0} y={0} width={5} height={1} />
      <rect x={0} y={2} width={5} height={1} />
      <rect x={0} y={4} width={5} height={1} />
    </g>
  </svg>
);

const lerVoz = (): boolean => {
  try {
    return window.localStorage.getItem(CHAVE_VOZ) === "1";
  } catch {
    return false;
  }
};

/**
 * Montar o teste a 3 metros (antes do primeiro olho): a distância, como
 * segurar o telemóvel, a resposta com a mão e um sítio para treinar o gesto.
 */
const PrepararPalanca = ({ aoContinuar }: { aoContinuar: () => void }) => {
  const { t } = useTranslation();
  const [distancia, setDistancia] = useState<DistanciaLonge>(() => lerDistanciaLonge());
  const [comVoz, setComVoz] = useState(() => reconhecimentoDisponivel() && lerVoz());
  const [gesto, setGesto] = useState<string | null>(null);
  const gestos = useGestos((r) => {
    sinalSonoro("tic");
    setGesto(r === "naosabe" ? t("Visao.palancaTreinoNaoSabe") : t("Visao.palancaTreinoDeslize", { direccao: t(`Visao.direccaoE_${r}`) }));
  });
  const passos = [1, 2, 3, 4].map((n) => t(`Visao.palancaPreparar${n}`));
  return (
    <EcraPasso
      titulo={t("Visao.palancaPrepararTitulo")}
      accao={
        <Button
          size="lg"
          onClick={() => {
            guardarDistanciaLonge(distancia);
            try {
              window.localStorage.setItem(CHAVE_VOZ, comVoz ? "1" : "0");
            } catch {
              // armazenamento bloqueado
            }
            aoContinuar();
          }}
        >
          {t("Visao.continuar")}
        </Button>
      }
    >
      <div className="w-full space-y-4 text-left text-sm">
        <ol className="list-decimal space-y-1 pl-5 text-foreground">
          {passos.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
        <BotaoOuvir texto={passos.join(" ")} />
        <div role="radiogroup" aria-label={t("Visao.palancaDistancia")} className="flex flex-wrap gap-2">
          {DISTANCIAS_LONGE_MM.map((mm) => (
            <Button
              key={mm}
              role="radio"
              aria-checked={distancia === mm}
              size="sm"
              variant={distancia === mm ? "default" : "outline"}
              className={cn(distancia === mm && "bg-navy text-navy-foreground hover:bg-navy/90")}
              onClick={() => setDistancia(mm)}
            >
              {mm === 3000 ? t("Visao.palancaTresMetros") : t("Visao.palancaDoisMetros")}
            </Button>
          ))}
        </div>
        <div
          {...gestos}
          className="grid h-32 touch-none select-none place-items-center rounded-xl border-2 border-dashed border-teal/60 p-3 text-center text-muted-foreground"
        >
          {gesto ?? t("Visao.palancaTreinoGesto")}
        </div>
        {reconhecimentoDisponivel() && (
          <label className="flex items-start gap-2 text-foreground">
            <input type="checkbox" className="mt-1" checked={comVoz} onChange={(e) => setComVoz(e.target.checked)} />
            <span>
              <span className="block font-medium">{t("Visao.palancaComVoz")}</span>
              <span className="text-muted-foreground">{t("Visao.palancaComVozTexto")}</span>
            </span>
          </label>
        )}
      </div>
    </EcraPasso>
  );
};

/** O ecrã inteiro virado para a criança: só a mãozinha, em branco. */
const EcraPalanca = ({
  olho,
  niveis,
  distancia,
  comVoz,
  pxPorMm,
  aoParar,
  aoTerminar,
}: {
  olho: Olho;
  niveis: number[];
  distancia: DistanciaLonge;
  comVoz: boolean;
  pxPorMm: number;
  aoParar: () => void;
  aoTerminar: (r: ResultadoAcuidade) => void;
}) => {
  const { t, i18n } = useTranslation();
  const tempo = useTempoActivo();
  const inicio = useRef(Date.now());
  const [escada, setEscada] = useState(() => iniciarEscadaTeste(niveis.length, indiceMaisProximo(niveis, LOGMAR_INICIAL_LONGE)));
  const [direccao, setDireccao] = useState<DireccaoE>(() => direccaoAleatoriaE(null));
  const terminou = useRef(false);

  useEffect(() => {
    tempo.iniciar();
    falar(t("Visao.palancaVozComecar", { olho: t(olho === "direito" ? "Visao.olhoDireito" : "Visao.olhoEsquerdo").toLowerCase() }), i18n.language);
    // Só ao abrir o ecrã.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const responder = (r: RespostaE) => {
    if (terminou.current) return;
    sinalSonoro("tic");
    tempo.registar();
    const seguinte = responderTeste(escada, r === direccao);
    if (seguinte.terminado) {
      terminou.current = true;
      tempo.pausar();
      sinalSonoro("fim");
      aoTerminar({
        limiar: arredondar2(limiarFinoTeste(seguinte, niveis)),
        limiteEcra: seguinte.atingiuLimite,
        segundosActivos: tempo.lerSegundos(),
        duracaoSegundos: Math.max(1, Math.round((Date.now() - inicio.current) / 1000)),
        distanciaMm: distancia,
        comVoz,
      });
      return;
    }
    setEscada(seguinte);
    setDireccao((d) => direccaoAleatoriaE(d));
  };

  const gestos = useGestos(responder);
  const voz = useRespostaPorVoz(comVoz, i18n.language, responder);
  const logmar = niveis[escada.indice];

  return (
    <div
      {...gestos}
      role="application"
      aria-label={t("Visao.palancaRotuloPalco")}
      className="fixed inset-0 z-[100] touch-none select-none"
      style={{ backgroundColor: "#ffffff", color: "#000000", colorScheme: "light" }}
      data-palco-visual
    >
      <div className="absolute inset-0 grid place-items-center">
        <MaozinhaE ladoPx={ladoDoEPx(logmar, distancia, pxPorMm)} direccao={direccao} />
      </div>
      <button
        type="button"
        onClick={aoParar}
        className="absolute right-3 top-3 flex items-center gap-1 rounded-lg border px-3 py-2 text-sm"
        style={{ borderColor: "#cccccc", backgroundColor: "#f4f4f4", color: "#333333" }}
      >
        <Square className="h-3.5 w-3.5" aria-hidden />
        {t("Visao.palancaParar")}
      </button>
      <p className="absolute inset-x-0 bottom-16 flex items-center justify-center gap-2 px-4 text-xs" style={{ color: "#999999" }}>
        {voz.aOuvir && <Mic className="h-3.5 w-3.5" aria-label={t("Visao.palancaAOuvir")} />}
        {t("Visao.palancaRodape", {
          olho: t(olho === "direito" ? "Visao.olhoDireito" : "Visao.olhoEsquerdo"),
          fraccao: fraccao6(logmar, separadorDecimal()),
          metros: distancia / 1000,
        })}
      </p>
    </div>
  );
};

/** Antes de cada olho: um ecrã curto; o teste em si é a mãozinha em ecrã inteiro. */
const TarefaPalancaLonge = ({
  olho,
  ctx,
  aoTerminar,
}: {
  olho: Olho;
  ctx: ContextoTeste;
  aoTerminar: (r: ResultadoAcuidade) => void;
}) => {
  const { t } = useTranslation();
  const [distancia] = useState(() => lerDistanciaLonge());
  const [comVoz] = useState(() => reconhecimentoDisponivel() && lerVoz());
  const [aTestar, setATestar] = useState(false);
  const ladoMax = Math.min(window.innerWidth, window.innerHeight) * FRACCAO_MAX_ECRA;
  const niveis = useMemo(
    () => niveisPalancaLonge(distancia, ctx.pxPorMm, ctx.devicePixelRatio, ladoMax),
    [ctx.devicePixelRatio, ctx.pxPorMm, distancia, ladoMax],
  );

  if (!niveis.length) return <p className="py-10 text-center text-sm text-muted-foreground">{t("Visao.semNiveisNesteEcra")}</p>;
  if (aTestar)
    return (
      <EcraPalanca
        olho={olho}
        niveis={niveis}
        distancia={distancia}
        comVoz={comVoz}
        pxPorMm={ctx.pxPorMm}
        aoParar={() => setATestar(false)}
        aoTerminar={aoTerminar}
      />
    );
  return (
    <EcraPasso
      titulo={t("Visao.palancaOlhoTitulo", { olho: t(olho === "direito" ? "Visao.olhoDireito" : "Visao.olhoEsquerdo") })}
      accao={
        <Button size="lg" onClick={() => setATestar(true)}>
          {t("Visao.palancaComecar")}
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground">{t("Visao.palancaOlhoTexto", { metros: distancia / 1000 })}</p>
    </EcraPasso>
  );
};

const ResultadoAcuidadeEcra = ({ res, ctx }: { res: Record<Olho, ResultadoAcuidade>; ctx: ContextoTeste }) => {
  const { t } = useTranslation();
  const { estado, gravar, tentarDeNovo } = useRegistoSessao();
  const gravou = useRef(false);
  const distancia = res.direito.distanciaMm;

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
        distancia_mm: res[olho].distanciaMm,
        px_por_mm: Math.round(ctx.pxPorMm * 1000) / 1000,
        calibrado: ctx.calibrado,
        sinais: {
          limite_ecra: res[olho].limiteEcra,
          nao_leu_o_maior: res[olho].limiar === null,
          com_correccao: ctx.usaCorreccao,
          // Desde 2026-10-21: ao longe, com a mãozinha (E). A tendência só
          // compara sessões do mesmo tipo (`mesmoTipoDaUltima`).
          ao_longe: true,
          optotipo: "E",
          resposta: res[olho].comVoz ? "voz_e_gesto" : "gesto",
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
  const linhas = diferencaEmLinhas(res.direito.limiar, res.esquerdo.limiar);

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
              {formatarDecimal(logmarParaDecimal(r.limiar), 2)} · logMAR {formatarDecimal(r.limiar, 2)}
            </p>
          </CartaoOlho>
        );
      })}
      notas={
        <div className="space-y-2 text-center text-xs text-muted-foreground">
          {linhas !== null && (
            <p className="text-sm font-medium text-foreground">
              {linhas === 0
                ? t("Visao.palancaDiferencaZero")
                : linhas === 1
                  ? t("Visao.palancaDiferencaUma")
                  : t("Visao.palancaDiferencaLinhas", { linhas })}
            </p>
          )}
          <p>{t("Visao.palancaMedidoA", { metros: distancia / 1000 })}</p>
          {!ctx.calibrado && <p>{t("Visao.semCartaoAviso")}</p>}
          {algumLimite && <p>{t("Visao.acuidadeLimiteEcra")}</p>}
        </div>
      }
    />
  );
};

/**
 * Olhos de Palanca ao longe (id `figure8`, no teste de 90 dias). Ver
 * `lib/visao/palancaLonge.ts`.
 */
const TesteAcuidade = () => {
  const { t } = useTranslation();
  return (
    <PaginaExercicio>
      <AssistenteTeste<ResultadoAcuidade>
        exercicioId={EXERCICIO_ID}
        titulo={t("Visao.acuidadeTitulo")}
        descricao={t("Visao.acuidadeDescricao")}
        comDistancia={false}
        preparacao={{ nome: t("Visao.passoPreparar"), render: (aoContinuar) => <PrepararPalanca aoContinuar={aoContinuar} /> }}
        tarefa={(olho, ctx, aoTerminar) => <TarefaPalancaLonge olho={olho} ctx={ctx} aoTerminar={aoTerminar} />}
        resultado={(res, ctx) => <ResultadoAcuidadeEcra res={res} ctx={ctx} />}
      />
    </PaginaExercicio>
  );
};

export default TesteAcuidade;
