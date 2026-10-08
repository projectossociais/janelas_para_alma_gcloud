import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Glasses } from "lucide-react";
import { Botao } from "@/design/componentes/Botao";
import BaseExercise from "@/components/exercises/BaseExercise";
import PalcoVisual from "@/components/visao/PalcoVisual";
import { CartaoOlho, EcraResultado } from "@/components/visao/Resultados";
import { BotaoContinuar, EcraPasso, PassoBrilho, PassoCalibracao, PassoDistancia } from "@/components/visao/Passos";
import { useCalibracao, useDevicePixelRatio, useRegistoSessao, useTempoActivo } from "@/components/visao/hooks";
import { escolhaAleatoria, iniciarEscadaTeste, responderTeste } from "@/lib/visao/escada";
import { FORMAS, gerarEstereograma, type Forma } from "@/lib/visao/estereograma";
import { DISTANCIA_OMISSAO_MM, arcsegParaPx, desenhavel } from "@/lib/visao/geometria";
import { DISPARIDADES_ARCSEG, sinalEstereopsia } from "@/lib/visao/resultados";
import { PX_POR_MM_NOMINAL } from "@/lib/visao/calibracao";
import { ID_ESTEREOPSIA } from "@/lib/visao/ids";

const EXERCICIO_ID = ID_ESTEREOPSIA;

const LADO_CSS_MAX = 320;
const LETRAS = ["E", "H", "K", "N", "P", "T", "X", "Z"];
const VERMELHO = "#ff0000";
const CIANO = "#00ffff";

const CHAVES_FORMA: Record<Forma, string> = {
  circulo: "Visao.formaCirculo",
  quadrado: "Visao.formaQuadrado",
  triangulo: "Visao.formaTriangulo",
  estrela: "Visao.formaEstrela",
};

/** Ícone de cada forma para os botões de resposta. */
const IconeForma = ({ forma }: { forma: Forma }) => {
  const comum = { className: "fill-current", "aria-hidden": true } as const;
  return (
    <svg viewBox="-12 -12 24 24" className="h-8 w-8">
      {forma === "circulo" && <circle r={10} {...comum} />}
      {forma === "quadrado" && <rect x={-9} y={-9} width={18} height={18} {...comum} />}
      {forma === "triangulo" && <polygon points="0,-10 10,8 -10,8" {...comum} />}
      {forma === "estrela" && (
        <polygon
          points={Array.from({ length: 10 }, (_, i) => {
            const r = i % 2 ? 4.5 : 10.5;
            const a = (i * Math.PI) / 5 - Math.PI / 2;
            return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
          }).join(" ")}
          {...comum}
        />
      )}
    </svg>
  );
};

/** Canvas do estereograma, em píxeis de dispositivo. */
const Estereograma = ({
  disparidadeCss,
  forma,
  dpr,
  semente,
}: {
  disparidadeCss: number;
  forma: Forma;
  dpr: number;
  semente: number;
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
    });
    ctx.putImageData(new ImageData(px, ladoDisp, ladoDisp), 0, 0);
  }, [disparidadeCss, dpr, forma, ladoDisp, semente]);
  return <canvas ref={ref} width={ladoDisp} height={ladoDisp} style={{ width: ladoCss, height: ladoCss, display: "block" }} />;
};

type Etapa = "brilho" | "calibracao" | "distancia" | "oculos" | "tarefa" | "resultado";
const ETAPAS: readonly Etapa[] = ["brilho", "calibracao", "distancia", "oculos", "tarefa", "resultado"];

/** Verificação dos óculos: cada olho só deve ver uma das letras. */
const VerificarOculos = ({ aoContinuar }: { aoContinuar: (ok: boolean) => void }) => {
  const { t } = useTranslation();
  const [letras, setLetras] = useState(() => {
    const a = escolhaAleatoria(LETRAS.length, null);
    return { vermelha: LETRAS[a], ciano: LETRAS[escolhaAleatoria(LETRAS.length, a)] };
  });
  const [fase, setFase] = useState<"esquerdo" | "direito" | "falhou">("esquerdo");
  const [certas, setCertas] = useState(0);
  const opcoes = useMemo(() => {
    const extra = LETRAS.filter((l) => l !== letras.vermelha && l !== letras.ciano).slice(0, 2);
    return [letras.vermelha, letras.ciano, ...extra].sort();
  }, [letras]);

  // Filtro vermelho no olho esquerdo: vê a letra ciano (escura) e não a vermelha.
  const responder = (letra: string | null) => {
    const certa = fase === "esquerdo" ? letras.ciano : letras.vermelha;
    const n = certas + (letra === certa ? 1 : 0);
    if (fase === "esquerdo") {
      setCertas(n);
      setFase("direito");
    } else if (n === 2) {
      aoContinuar(true);
    } else {
      setFase("falhou");
    }
  };

  if (fase === "falhou")
    return (
      <EcraPasso
        icone={<Glasses className="h-7 w-7" />}
        titulo={t("Visao.oculosVCFalhouTitulo")}
        accao={
          <>
            <BotaoContinuar
              aoClicar={() => {
                const a = escolhaAleatoria(LETRAS.length, null);
                setLetras({ vermelha: LETRAS[a], ciano: LETRAS[escolhaAleatoria(LETRAS.length, a)] });
                setCertas(0);
                setFase("esquerdo");
              }}
            >
              {t("Visao.tentarDeNovo")}
            </BotaoContinuar>
            <Botao variante="fantasma" onClick={() => aoContinuar(false)}>
              {t("Visao.continuarMesmoAssim")}
            </Botao>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">{t("Visao.oculosVCFalhouTexto")}</p>
      </EcraPasso>
    );

  return (
    <EcraPasso icone={<Glasses className="h-7 w-7" />} titulo={t("Visao.oculosVCTitulo")}>
      <p className="text-sm text-muted-foreground">{t("Visao.oculosVCTexto")}</p>
      <PalcoVisual className="min-h-[140px] gap-10" rotulo={t("Visao.rotuloLetrasOculos")}>
        <span style={{ color: VERMELHO, fontSize: 72, fontWeight: 800, lineHeight: 1 }}>{letras.vermelha}</span>
        <span style={{ color: CIANO, fontSize: 72, fontWeight: 800, lineHeight: 1 }}>{letras.ciano}</span>
      </PalcoVisual>
      <p className="font-semibold text-foreground" aria-live="polite">
        {fase === "esquerdo" ? t("Visao.oculosVCFecheDireito") : t("Visao.oculosVCFecheEsquerdo")}
      </p>
      <div className="grid w-full grid-cols-3 gap-2 sm:grid-cols-5">
        {opcoes.map((l) => (
          <Botao key={`${fase}-${l}`} tamanho="g" variante="secundario" className="text-xl font-bold" onClick={() => responder(l)}>
            {l}
          </Botao>
        ))}
        <Botao tamanho="g" variante="secundario" className="col-span-3 sm:col-span-1" onClick={() => responder(null)}>
          {t("Visao.vejoAsDuas")}
        </Botao>
      </div>
    </EcraPasso>
  );
};

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
  aoTerminar,
}: {
  distanciaMm: number;
  pxPorMm: number;
  dpr: number;
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
        />
      </PalcoVisual>
      <div className="grid w-full max-w-md grid-cols-2 gap-2 sm:grid-cols-4">
        {FORMAS.map((f, i) => (
          <Botao key={f} tamanho="g" variante="secundario" className="h-auto flex-col gap-1 py-3" onClick={() => responder(i)}>
            <IconeForma forma={f} />
            <span className="text-xs">{t(CHAVES_FORMA[f])}</span>
          </Botao>
        ))}
      </div>
      {tempo.emPausa && <p className="text-xs text-muted-foreground">{t("Visao.emPausaAutomatica")}</p>}
    </div>
  );
};

const ResultadoEstereoEcra = ({
  res,
  oculosOk,
  distanciaMm,
  pxPorMm,
  calibrado,
}: {
  res: ResultadoEstereo;
  oculosOk: boolean;
  distanciaMm: number;
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
        sinais: { limite_ecra: res.limiteEcra, oculos_verificados: oculosOk },
      },
    ]);
  }, [calibrado, distanciaMm, gravar, oculosOk, pxPorMm, res]);

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
          <p>{t("Visao.estereoAvisoCrosstalk")}</p>
          {!oculosOk && <p>{t("Visao.estereoOculosNaoVerificados")}</p>}
          {!calibrado && <p>{t("Visao.semCartaoAviso")}</p>}
        </div>
      }
    />
  );
};

const TesteEstereopsia = () => {
  const { t } = useTranslation();
  const { calibracao, guardar } = useCalibracao();
  const dpr = useDevicePixelRatio();
  const [etapa, setEtapa] = useState<Etapa>("brilho");
  const [distanciaMm, setDistanciaMm] = useState(DISTANCIA_OMISSAO_MM);
  const [oculosOk, setOculosOk] = useState(false);
  const [resultado, setResultado] = useState<ResultadoEstereo | null>(null);
  const pxPorMm = calibracao?.pxPorMm ?? PX_POR_MM_NOMINAL;

  const nomes = [
    t("Visao.passoEcra"),
    t("Visao.passoCartao"),
    t("Visao.passoDistancia"),
    t("Visao.passoOculosVC"),
    t("Visao.passoTarefa"),
    t("Visao.passoResultado"),
  ];

  return (
    <BaseExercise
      title={t("Visao.estereoTitulo")}
      description={t("Visao.estereoDescricao")}
      exercicioId={EXERCICIO_ID}
      grupo="premium"
      tipo="teste"
      passos={nomes}
      passoActual={ETAPAS.indexOf(etapa)}
    >
      {etapa === "brilho" && <PassoBrilho aoContinuar={() => setEtapa("calibracao")} />}
      {etapa === "calibracao" && (
        <PassoCalibracao calibracao={calibracao} aoGuardar={guardar} aoContinuar={() => setEtapa("distancia")} />
      )}
      {etapa === "distancia" && (
        <PassoDistancia
          distanciaMm={distanciaMm}
          aoEscolher={(mm) => {
            setDistanciaMm(mm);
            setEtapa("oculos");
          }}
        />
      )}
      {etapa === "oculos" && (
        <VerificarOculos
          aoContinuar={(ok) => {
            setOculosOk(ok);
            setEtapa("tarefa");
          }}
        />
      )}
      {etapa === "tarefa" && (
        <TarefaEstereo
          distanciaMm={distanciaMm}
          pxPorMm={pxPorMm}
          dpr={dpr}
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
          distanciaMm={distanciaMm}
          pxPorMm={pxPorMm}
          calibrado={calibracao?.calibrado ?? false}
        />
      )}
    </BaseExercise>
  );
};

export default TesteEstereopsia;
