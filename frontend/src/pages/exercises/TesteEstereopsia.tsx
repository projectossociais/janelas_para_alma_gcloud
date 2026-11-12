import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import VerificarOculos from "@/components/visao/VerificarOculos";
import { BotoesForma } from "@/components/visao/BotoesForma";
import BaseExercise from "@/components/exercises/BaseExercise";
import PaginaExercicio from "@/components/visao/PaginaExercicio";
import PalcoVisual from "@/components/visao/PalcoVisual";
import { CartaoOlho, EcraResultado } from "@/components/visao/Resultados";
import { Button } from "@/components/ui/button";
import { TrocarModo } from "@/components/visao/EscolherOculos";
import { NotaPreparacao, PassoCalibracao, PassoDistancia } from "@/components/visao/Passos";
import { useCalibracao, useDevicePixelRatio, useRegistoSessao, useTempoActivo } from "@/components/visao/hooks";
import { escolhaAleatoria, iniciarEscadaTeste, responderTeste } from "@/lib/visao/escada";
import { FORMAS, gerarEstereograma, type Forma } from "@/lib/visao/estereograma";
import { coresEstereograma, type Afinacao } from "@/lib/visao/anaglifo";
import AfinarOculos from "@/components/visao/AfinarOculos";
import { DISTANCIA_OMISSAO_MM, arcsegParaPx, desenhavel } from "@/lib/visao/geometria";
import { DISPARIDADES_ARCSEG, sinalEstereopsia } from "@/lib/visao/resultados";
import { PX_POR_MM_NOMINAL } from "@/lib/visao/calibracao";
import { ID_ESTEREOPSIA } from "@/lib/visao/ids";
import { guardarEscolhas, lerEscolhas } from "@/lib/visao/preparacao";

const EXERCICIO_ID = ID_ESTEREOPSIA;

const LADO_CSS_MAX = 320;

/** Canvas do estereograma, em píxeis de dispositivo. */
const Estereograma = ({
  disparidadeCss,
  forma,
  dpr,
  semente,
  afinacao,
}: {
  disparidadeCss: number;
  forma: Forma;
  dpr: number;
  semente: number;
  afinacao: Afinacao | null;
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const ladoCss = Math.min(LADO_CSS_MAX, typeof window === "undefined" ? LADO_CSS_MAX : window.innerWidth - 64);
  const ladoDisp = Math.round(ladoCss * dpr);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const px = gerarEstereograma({
      largura: ladoDisp,
      altura: ladoDisp,
      disparidade: disparidadeCss * dpr,
      forma,
      tamanhoPonto: Math.max(1, Math.round(2 * dpr)),
      cores: coresEstereograma(afinacao),
    });
    ctx.putImageData(new ImageData(px, ladoDisp, ladoDisp), 0, 0);
  }, [afinacao, disparidadeCss, dpr, forma, ladoDisp, semente]);
  return <canvas ref={ref} width={ladoDisp} height={ladoDisp} style={{ width: ladoCss, height: ladoCss, display: "block" }} />;
};

type Etapa = "calibracao" | "distancia" | "oculos" | "afinar" | "tarefa" | "resultado";
/** A distância da última vez, por aparelho (a chave é só deste teste com óculos 3D). */
const CHAVE_ESCOLHAS = `${EXERCICIO_ID}.oculos3d`;

interface ResultadoEstereo {
  limiar: number | null;
  limiteEcra: boolean;
  segundosActivos: number;
  duracaoSegundos: number;
}

const TarefaEstereo = ({
  distanciaMm,
  pxPorMm,
  dpr,
  afinacao,
  aoTerminar,
}: {
  distanciaMm: number;
  pxPorMm: number;
  dpr: number;
  afinacao: Afinacao | null;
  aoTerminar: (r: ResultadoEstereo) => void;
}) => {
  const { t } = useTranslation();
  const niveis = useMemo(
    () => DISPARIDADES_ARCSEG.filter((a) => desenhavel(arcsegParaPx(a, distanciaMm, pxPorMm), dpr)),
    [distanciaMm, dpr, pxPorMm],
  );
  const tempo = useTempoActivo();
  const [inicio] = useState(() => Date.now());
  const [escada, setEscada] = useState(() => iniciarEscadaTeste(Math.max(1, niveis.length), 0));
  const [forma, setForma] = useState(() => escolhaAleatoria(FORMAS.length, null));
  const [semente, setSemente] = useState(0);
  const { iniciar } = tempo;
  useEffect(() => iniciar(), [iniciar]);

  if (!niveis.length) return <p className="py-10 text-center text-sm text-muted-foreground">{t("Visao.semNiveisNesteEcra")}</p>;

  const responder = (i: number) => {
    tempo.registar();
    const seguinte = responderTeste(escada, i === forma);
    if (seguinte.terminado) {
      tempo.pausar();
      aoTerminar({
        limiar: seguinte.limiar === null ? null : niveis[seguinte.limiar],
        limiteEcra: seguinte.atingiuLimite,
        segundosActivos: tempo.lerSegundos(),
        duracaoSegundos: Math.max(1, Math.round((Date.now() - inicio) / 1000)),
      });
      return;
    }
    setEscada(seguinte);
    setForma((f) => escolhaAleatoria(FORMAS.length, f));
    setSemente((s) => s + 1);
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-center text-sm text-muted-foreground">{t("Visao.estereoInstrucao")}</p>
      <PalcoVisual className="p-3" rotulo={t("Visao.rotuloEstereograma")}>
        <Estereograma
          disparidadeCss={arcsegParaPx(niveis[escada.indice], distanciaMm, pxPorMm)}
          forma={FORMAS[forma]}
          dpr={dpr}
          semente={semente}
          afinacao={afinacao}
        />
      </PalcoVisual>
      <BotoesForma aoEscolher={responder} />
      {tempo.emPausa && <p className="text-xs text-muted-foreground">{t("Visao.emPausaAutomatica")}</p>}
    </div>
  );
};

const ResultadoEstereoEcra = ({
  res,
  oculosOk,
  oculosAfinados,
  distanciaMm,
  distanciaMedida,
  pxPorMm,
  calibrado,
}: {
  res: ResultadoEstereo;
  oculosOk: boolean;
  oculosAfinados: boolean;
  distanciaMm: number;
  distanciaMedida: boolean;
  pxPorMm: number;
  calibrado: boolean;
}) => {
  const { t } = useTranslation();
  const { estado, gravar, tentarDeNovo } = useRegistoSessao();
  const gravou = useRef(false);
  useEffect(() => {
    if (gravou.current) return;
    gravou.current = true;
    void gravar([
      {
        exercicio_id: EXERCICIO_ID,
        olho: "ambos",
        duracao_segundos: res.duracaoSegundos,
        segundos_activos: res.segundosActivos,
        limiar: res.limiar,
        unidade: "arcsec",
        distancia_mm: distanciaMm,
        px_por_mm: Math.round(pxPorMm * 1000) / 1000,
        calibrado,
        sinais: {
          limite_ecra: res.limiteEcra,
          oculos_verificados: oculosOk,
          oculos_afinados: oculosAfinados,
          distancia_medida: distanciaMedida,
        },
      },
    ]);
  }, [calibrado, distanciaMedida, distanciaMm, gravar, oculosAfinados, oculosOk, pxPorMm, res]);

  const sinais =
    res.limiar === null
      ? [t("Visao.estereoSinalNaoViu")]
      : sinalEstereopsia(res.limiar)
        ? [t("Visao.estereoSinalDiferencaGrande", { valor: res.limiar })]
        : [];
  return (
    <EcraResultado
      titulo={t("Visao.resultadoEstereoTitulo")}
      gravacao={estado}
      aoTentarDeNovo={() => void tentarDeNovo()}
      sinais={sinais}
      cartoes={
        <CartaoOlho titulo={t("Visao.doisOlhos")} estado={sinalEstereopsia(res.limiar) ? "sinal" : "ok"}>
          {res.limiar === null ? (
            t("Visao.estereoNaoViu")
          ) : (
            <>
              <p className="text-2xl font-bold text-foreground">
                {res.limiteEcra ? "≤ " : ""}
                {res.limiar}″
              </p>
              <p>{t("Visao.segundosDeArco")}</p>
            </>
          )}
        </CartaoOlho>
      }
      notas={
        <div className="space-y-2 text-center text-xs text-muted-foreground">
          {!oculosAfinados && <p>{t("Visao.estereoAvisoCrosstalk")}</p>}
          {!oculosOk && <p>{t("Visao.estereoOculosNaoVerificados")}</p>}
          {!calibrado && <p>{t("Visao.semCartaoAviso")}</p>}
        </div>
      }
    />
  );
};

/**
 * Teste de Estereopsia (com óculos 3D). Da segunda vez em diante neste
 * aparelho, começa logo na verificação dos óculos: o cartão já está feito e a
 * distância é a da última vez (gravada como não medida). "Alterar definições"
 * volta ao fluxo completo.
 */
const TesteEstereopsia = ({ aoTrocarModo }: { aoTrocarModo?: () => void }) => {
  const { t } = useTranslation();
  const { calibracao, guardar } = useCalibracao();
  const dpr = useDevicePixelRatio();
  const [guardadas] = useState(() => lerEscolhas(CHAVE_ESCOLHAS));
  const [completo, setCompleto] = useState(() => !(guardadas && calibracao));
  const [etapa, setEtapa] = useState<Etapa>(() => (completo ? (calibracao ? "distancia" : "calibracao") : "oculos"));
  const [distanciaMm, setDistanciaMm] = useState(() => (completo || !guardadas ? DISTANCIA_OMISSAO_MM : guardadas.distanciaMm));
  const [distanciaMedida, setDistanciaMedida] = useState(false);
  const [oculosOk, setOculosOk] = useState(false);
  const [afinacao, setAfinacao] = useState<Afinacao | null>(null);
  const [resultado, setResultado] = useState<ResultadoEstereo | null>(null);
  /** O cartão entra na barra de passos se foi preciso nesta sessão. */
  const [comCartao, setComCartao] = useState(etapa === "calibracao");
  const pxPorMm = calibracao?.pxPorMm ?? PX_POR_MM_NOMINAL;

  const lista: [Etapa, string, boolean][] = [
    ["calibracao", t("Visao.passoCartao"), comCartao],
    ["distancia", t("Visao.passoDistancia"), completo],
    ["oculos", t("Visao.passoOculosVC"), true],
    ["afinar", t("Visao.passoAfinar"), true],
    ["tarefa", t("Visao.passoTarefa"), true],
    ["resultado", t("Visao.passoResultado"), true],
  ];
  const activas = lista.filter(([, , entra]) => entra);
  const aPreparar = etapa === "calibracao" || etapa === "oculos" || etapa === "afinar";

  return (
    <PaginaExercicio>
      <BaseExercise
        title={t("Visao.estereoOculosTitulo")}
        description={t("Visao.estereoOculosDescricao")}
        exercicioId={EXERCICIO_ID}
        tipo="teste"
        passos={activas.map(([, nome]) => nome)}
        passoActual={Math.max(0, activas.findIndex(([e]) => e === etapa))}
      >
        {etapa === "calibracao" && (
          <PassoCalibracao calibracao={calibracao} forcar aoGuardar={guardar} aoContinuar={() => setEtapa("distancia")} />
        )}
        {etapa === "distancia" && (
          <PassoDistancia
            distanciaMm={distanciaMm}
            pxPorMm={pxPorMm}
            aoEscolher={(mm, medida) => {
              setDistanciaMm(mm);
              setDistanciaMedida(medida);
              guardarEscolhas(CHAVE_ESCOLHAS, { distanciaMm: mm, usaCorreccao: false, olho: null });
              setEtapa("oculos");
            }}
          />
        )}
        {etapa === "oculos" && (
          <div className="flex flex-col items-center gap-3">
            <VerificarOculos
              aoContinuar={(ok) => {
                setOculosOk(ok);
                // Sem os óculos a funcionar, não há fuga que valha a pena medir.
                setEtapa(ok ? "afinar" : "tarefa");
              }}
            />
            {!completo && (
              <Button
                variant="ghost"
                onClick={() => {
                  setCompleto(true);
                  setComCartao(true);
                  setDistanciaMm(DISTANCIA_OMISSAO_MM);
                  setEtapa("calibracao");
                }}
              >
                {t("Visao.rapidoAlterar")}
              </Button>
            )}
            {aoTrocarModo && <TrocarModo para="sem" aoTrocar={aoTrocarModo} />}
          </div>
        )}
        {etapa === "afinar" && (
          <AfinarOculos
            aoContinuar={(af) => {
              setAfinacao(af);
              setEtapa("tarefa");
            }}
          />
        )}
        {aPreparar && <NotaPreparacao />}
        {etapa === "tarefa" && (
          <TarefaEstereo
            distanciaMm={distanciaMm}
            pxPorMm={pxPorMm}
            dpr={dpr}
            afinacao={afinacao}
            aoTerminar={(r) => {
              setResultado(r);
              setEtapa("resultado");
            }}
          />
        )}
        {etapa === "resultado" && resultado && (
          <ResultadoEstereoEcra
            res={resultado}
            oculosOk={oculosOk}
            oculosAfinados={afinacao !== null}
            distanciaMm={distanciaMm}
            distanciaMedida={distanciaMedida}
            pxPorMm={pxPorMm}
            calibrado={calibracao?.calibrado ?? false}
          />
        )}
      </BaseExercise>
    </PaginaExercicio>
  );
};

export default TesteEstereopsia;
