import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import AssistenteTeste, { type ContextoTeste } from "@/components/visao/AssistenteTeste";
import { EcraPasso } from "@/components/visao/EcraPasso";
import { DoisOlhos } from "@/components/visao/Passos";
import PaginaExercicio from "@/components/visao/PaginaExercicio";
import { CartaoOlho, EcraResultado } from "@/components/visao/Resultados";
import { useRegistoSessao, useTempoActivo } from "@/components/visao/hooks";
import { useGestos } from "@/components/visao/useGestos";
import { reconhecimentoDisponivel, useRespostaPorVoz } from "@/components/visao/useRespostaPorVoz";
import { formatarDecimal, separadorDecimal } from "@/i18n/formatar";
import { diferencaEmLinhas } from "@/lib/visao/aglomeracao";
import { useProfile } from "@/contexts/ProfileContext";
import { indiceMaisProximo } from "@/lib/visao/escada";
import { fraccao6, logmarParaDecimal } from "@/lib/visao/geometria";
import { ID_ACUIDADE } from "@/lib/visao/ids";
import {
  DIRECCOES_E,
  DISTANCIAS_LONGE_MM,
  FRACCAO_MAX_ECRA,
  FRACCAO_MAX_ECRA_BARRAS,
  FOLGA_BARRAS_TRACOS,
  LADO_COM_BARRAS_TRACOS,
  LOGMAR_INICIAL_LONGE,
  TREINO_TOTAL,
  cabeComBarras,
  direccaoAleatoriaE,
  guardarDistanciaLonge,
  indiceDaPalanca,
  iniciarPalanca,
  ladoDoEPx,
  lerDistanciaLonge,
  limiarDaPalanca,
  niveisPalancaLonge,
  olhoAConfirmar,
  palancaTerminou,
  responderPalanca,
  respostasDaPalanca,
  treinoPassou,
  type DireccaoE,
  type DistanciaLonge,
  type RespostaE,
} from "@/lib/visao/palancaLonge";
import { OLHOS, criterioAcuidade, sinaisAcuidade, type Olho } from "@/lib/visao/resultados";
import { sinalSonoro } from "@/lib/visao/voz";
import { cn } from "@/lib/utils";

const EXERCICIO_ID = ID_ACUIDADE;
const CHAVE_VOZ = "jpa.visao.palanca.voz";
/** O teste já foi montado neste aparelho: da vez seguinte, um ecrã curto em vez das instruções todas. */
const CHAVE_MONTADO = "jpa.visao.palanca.montado";

const jaMontou = (): boolean => {
  try {
    return window.localStorage.getItem(CHAVE_MONTADO) === "1";
  } catch {
    return false;
  }
};

export interface ResultadoAcuidade {
  /** logMAR do nível mais pequeno lido; `null` = nem o maior. */
  limiar: number | null;
  /** Leu o nível mais pequeno que o ecrã consegue desenhar. */
  limiteEcra: boolean;
  segundosActivos: number;
  duracaoSegundos: number;
  distanciaMm: DistanciaLonge;
  comVoz: boolean;
  /** O tamanho do limiar foi mostrado com as barras à volta. */
  barrasNoLimiar: boolean;
  /** Este olho foi repetido para confirmar a diferença; ficou o melhor dos dois. */
  confirmado?: boolean;
}

const arredondar2 = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);

/**
 * A mãozinha (E de Snellen): 5 x 5 traços, dedos para a direita a 0°. Com
 * `barras`, quatro barras à volta, a meia mãozinha de distância (as barras
 * não rodam com ela).
 */
export const MaozinhaE = ({ ladoPx, direccao, barras = false }: { ladoPx: number; direccao: DireccaoE; barras?: boolean }) => {
  const margem = barras ? FOLGA_BARRAS_TRACOS + 1 : 0;
  const lado = barras ? LADO_COM_BARRAS_TRACOS : 5;
  const longe = 5 + FOLGA_BARRAS_TRACOS;
  return (
    <svg
      width={(ladoPx * lado) / 5}
      height={(ladoPx * lado) / 5}
      viewBox={`${-margem} ${-margem} ${lado} ${lado}`}
      aria-hidden
      data-direccao={direccao}
      data-barras={barras ? "sim" : "nao"}
      fill="#000000"
    >
      <g transform={`rotate(${DIRECCOES_E.indexOf(direccao) * 90} 2.5 2.5)`}>
        <rect x={0} y={0} width={1} height={5} />
        <rect x={0} y={0} width={5} height={1} />
        <rect x={0} y={2} width={5} height={1} />
        <rect x={0} y={4} width={5} height={1} />
      </g>
      {barras && (
        <g>
          <rect x={0} y={-margem} width={5} height={1} />
          <rect x={0} y={longe} width={5} height={1} />
          <rect x={-margem} y={0} width={1} height={5} />
          <rect x={longe} y={0} width={1} height={5} />
        </g>
      )}
    </svg>
  );
};

/** Os tamanhos que este ecrã desenha a esta distância, e o lado máximo de um desenho. */
const useNiveisPalanca = (ctx: ContextoTeste, distancia: DistanciaLonge) => {
  const ladoCurto = Math.min(window.innerWidth, window.innerHeight);
  const ladoMax = ladoCurto * FRACCAO_MAX_ECRA;
  const niveis = useMemo(
    () => niveisPalancaLonge(distancia, ctx.pxPorMm, ctx.devicePixelRatio, ladoMax),
    [ctx.devicePixelRatio, ctx.pxPorMm, distancia, ladoMax],
  );
  return { niveis, ladoMaxBarras: ladoCurto * FRACCAO_MAX_ECRA_BARRAS };
};

/**
 * O ecrã inteiro virado para a criança: só a mãozinha, em branco. As respostas
 * chegam pelo deslize do adulto, pelas setas (num computador; espaço = "não
 * sei") ou pela voz da criança.
 */
const PalcoMaozinha = ({
  ladoPx,
  barras,
  direccao,
  comVoz,
  aoResponder,
  aoParar,
  children,
}: {
  ladoPx: number;
  barras: boolean;
  direccao: DireccaoE;
  comVoz: boolean;
  aoResponder: (r: RespostaE) => void;
  aoParar: () => void;
  children: ReactNode;
}) => {
  const { t, i18n } = useTranslation();
  const gestos = useGestos(aoResponder);
  const voz = useRespostaPorVoz(comVoz, i18n.language, aoResponder);
  const responderRef = useRef(aoResponder);
  responderRef.current = aoResponder;
  useEffect(() => {
    const TECLAS: Record<string, RespostaE> = { ArrowUp: "cima", ArrowDown: "baixo", ArrowLeft: "esquerda", ArrowRight: "direita", " ": "naosabe" };
    const aoTecla = (e: KeyboardEvent) => {
      const r = TECLAS[e.key];
      if (!r || e.repeat) return;
      e.preventDefault();
      responderRef.current(r);
    };
    window.addEventListener("keydown", aoTecla);
    return () => window.removeEventListener("keydown", aoTecla);
  }, []);

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
        <MaozinhaE ladoPx={ladoPx} direccao={direccao} barras={barras} />
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
      <div className="absolute inset-x-0 bottom-16 space-y-1 px-4 text-center text-xs" style={{ color: "#999999" }} aria-live="polite">
        {voz.aOuvir && <Mic className="mx-auto h-3.5 w-3.5" aria-label={t("Visao.palancaAOuvir")} />}
        {children}
        {comVoz && voz.erro && <p style={{ color: "#b23b2e" }}>{t("Visao.palancaVozErro")}</p>}
      </div>
    </div>
  );
};

/**
 * Treino com os dois olhos abertos, antes do primeiro olho: quatro mãozinhas
 * grandes. Sem acertar três, a criança ainda não percebeu o jogo (ou a
 * montagem está errada) e um resultado não seria de confiança.
 */
const TreinoPalanca = ({
  ctx,
  distancia,
  comVoz,
  aoPassar,
  aoVoltar,
}: {
  ctx: ContextoTeste;
  distancia: DistanciaLonge;
  comVoz: boolean;
  aoPassar: () => void;
  aoVoltar: () => void;
}) => {
  const { t } = useTranslation();
  const { niveis } = useNiveisPalanca(ctx, distancia);
  const [feitas, setFeitas] = useState(0);
  const [acertos, setAcertos] = useState(0);
  const [direccao, setDireccao] = useState<DireccaoE>(() => direccaoAleatoriaE(null));
  const [falhou, setFalhou] = useState<number | null>(null);
  const semNiveis = niveis.length === 0;

  // Sem tamanhos neste ecrã não há treino possível: o passo do olho explica porquê.
  useEffect(() => {
    if (semNiveis) aoPassar();
    // Só ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semNiveis]);
  if (semNiveis) return null;

  if (falhou !== null)
    return (
      <EcraPasso
        titulo={t("Visao.palancaTreinoFalhouTitulo", { acertos: falhou, total: TREINO_TOTAL })}
        accao={
          <>
            <Button
              size="lg"
              onClick={() => {
                setFeitas(0);
                setAcertos(0);
                setFalhou(null);
              }}
            >
              {t("Visao.palancaTreinarOutraVez")}
            </Button>
            <Button variant="ghost" onClick={aoVoltar}>
              {t("Visao.palancaVerInstrucoes")}
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-left text-sm text-muted-foreground">
          <p>{t("Visao.palancaTreinoFalhou1")}</p>
          <p>{t("Visao.palancaTreinoFalhou2")}</p>
          <p>{t("Visao.palancaTreinoFalhou3")}</p>
        </div>
      </EcraPasso>
    );

  const responder = (r: RespostaE) => {
    sinalSonoro("tic");
    const certos = acertos + (r === direccao ? 1 : 0);
    if (feitas + 1 >= TREINO_TOTAL) {
      if (treinoPassou(certos)) aoPassar();
      else setFalhou(certos);
      return;
    }
    setFeitas(feitas + 1);
    setAcertos(certos);
    setDireccao((d) => direccaoAleatoriaE(d));
  };

  return (
    <PalcoMaozinha
      ladoPx={ladoDoEPx(niveis[0], distancia, ctx.pxPorMm)}
      barras={false}
      direccao={direccao}
      comVoz={comVoz}
      aoResponder={responder}
      aoParar={aoVoltar}
    >
      <p>{t("Visao.palancaTreinoRodape", { n: feitas + 1, total: TREINO_TOTAL })}</p>
    </PalcoMaozinha>
  );
};

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
const PrepararPalanca = ({ ctx, aoContinuar }: { ctx: ContextoTeste; aoContinuar: () => void }) => {
  const { t } = useTranslation();
  const [distancia, setDistancia] = useState<DistanciaLonge>(() => lerDistanciaLonge());
  const [comVoz, setComVoz] = useState(() => reconhecimentoDisponivel() && lerVoz());
  const [gesto, setGesto] = useState<string | null>(null);
  const [resumido, setResumido] = useState(jaMontou);
  const [aTreinar, setATreinar] = useState(false);
  const gestos = useGestos((r) => {
    sinalSonoro("tic");
    setGesto(r === "naosabe" ? t("Visao.palancaTreinoNaoSabe") : t("Visao.palancaTreinoDeslize", { direccao: t(`Visao.direccaoE_${r}`) }));
  });
  const passos = [1, 2, 3, 4, 5].map((n) => t(`Visao.palancaPreparar${n}`));
  if (aTreinar)
    return (
      <TreinoPalanca
        ctx={ctx}
        distancia={distancia}
        comVoz={comVoz}
        aoPassar={aoContinuar}
        aoVoltar={() => {
          setATreinar(false);
          setResumido(false);
        }}
      />
    );
  if (resumido)
    return (
      <EcraPasso
        titulo={t("Visao.palancaMesmaMontagemTitulo")}
        accao={
          <>
            <Button size="lg" onClick={aoContinuar}>
              {t("Visao.continuar")}
            </Button>
            <Button variant="outline" onClick={() => setATreinar(true)}>
              {t("Visao.palancaTreinarPrimeiro")}
            </Button>
            <Button variant="ghost" onClick={() => setResumido(false)}>
              {t("Visao.palancaVerInstrucoes")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">{t("Visao.palancaMesmaMontagemTexto", { metros: distancia / 1000 })}</p>
      </EcraPasso>
    );
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
              window.localStorage.setItem(CHAVE_MONTADO, "1");
            } catch {
              // armazenamento bloqueado
            }
            setATreinar(true);
          }}
        >
          {t("Visao.palancaFazerTreino")}
        </Button>
      }
    >
      <div className="w-full space-y-4 text-left text-sm">
        <ol className="list-decimal space-y-1 pl-5 text-foreground">
          {passos.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
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

/** O teste de um olho: descida rápida e depois o limiar (`palancaLonge.ts`). */
const EcraPalanca = ({
  olho,
  niveis,
  ladoMaxBarras,
  distancia,
  comVoz,
  pxPorMm,
  aoParar,
  aoTerminar,
}: {
  olho: Olho;
  niveis: number[];
  ladoMaxBarras: number;
  distancia: DistanciaLonge;
  comVoz: boolean;
  pxPorMm: number;
  aoParar: () => void;
  aoTerminar: (r: ResultadoAcuidade) => void;
}) => {
  const { t } = useTranslation();
  const tempo = useTempoActivo();
  const inicio = useRef(Date.now());
  const [estado, setEstado] = useState(() => iniciarPalanca(niveis.length, indiceMaisProximo(niveis, LOGMAR_INICIAL_LONGE)));
  const [direccao, setDireccao] = useState<DireccaoE>(() => direccaoAleatoriaE(null));
  const terminou = useRef(false);
  /** A última resposta recebida, para o adulto saber que contou (não diz se estava certa). */
  const [ultima, setUltima] = useState<RespostaE | null>(null);
  const comBarras = (logmar: number) => cabeComBarras(logmar, distancia, pxPorMm, ladoMaxBarras);

  useEffect(() => {
    tempo.iniciar();
    // Só ao abrir o ecrã.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const responder = (r: RespostaE) => {
    if (terminou.current) return;
    sinalSonoro("tic");
    tempo.registar();
    setUltima(r);
    const seguinte = responderPalanca(estado, r === direccao);
    if (palancaTerminou(seguinte)) {
      terminou.current = true;
      tempo.pausar();
      sinalSonoro("fim");
      const iLimiar = seguinte.escada?.limiar ?? null;
      aoTerminar({
        limiar: arredondar2(limiarDaPalanca(seguinte, niveis)),
        limiteEcra: seguinte.escada?.atingiuLimite ?? false,
        segundosActivos: tempo.lerSegundos(),
        duracaoSegundos: Math.max(1, Math.round((Date.now() - inicio.current) / 1000)),
        distanciaMm: distancia,
        comVoz,
        barrasNoLimiar: iLimiar !== null && comBarras(niveis[iLimiar]),
      });
      return;
    }
    setEstado(seguinte);
    setDireccao((d) => direccaoAleatoriaE(d));
  };

  const logmar = niveis[indiceDaPalanca(estado)];

  return (
    <PalcoMaozinha
      ladoPx={ladoDoEPx(logmar, distancia, pxPorMm)}
      barras={comBarras(logmar)}
      direccao={direccao}
      comVoz={comVoz}
      aoResponder={responder}
      aoParar={aoParar}
    >
      <p>
        {t("Visao.palancaRodape", {
          olho: t(olho === "direito" ? "Visao.olhoDireito" : "Visao.olhoEsquerdo"),
          fraccao: fraccao6(logmar, separadorDecimal()),
          metros: distancia / 1000,
        })}
      </p>
      <p>
        {t("Visao.palancaRespostas", { n: respostasDaPalanca(estado) })}
        {ultima && ` · ${t("Visao.palancaUltima", { resposta: t(ultima === "naosabe" ? "Visao.palancaNaoSei" : `Visao.direccaoE_${ultima}`) })}`}
      </p>
      <p>{t("Visao.palancaParaSozinho")}</p>
    </PalcoMaozinha>
  );
};

/** Antes de cada olho: um ecrã curto; o teste em si é a mãozinha em ecrã inteiro. */
const TarefaPalancaLonge = ({
  olho,
  ctx,
  confirmacao = false,
  aoTerminar,
}: {
  olho: Olho;
  ctx: ContextoTeste;
  /** Repetição do olho pior, para confirmar uma diferença entre os olhos. */
  confirmacao?: boolean;
  aoTerminar: (r: ResultadoAcuidade) => void;
}) => {
  const { t } = useTranslation();
  const [distancia] = useState(() => lerDistanciaLonge());
  const [comVoz] = useState(() => reconhecimentoDisponivel() && lerVoz());
  const [aTestar, setATestar] = useState(false);
  const { niveis, ladoMaxBarras } = useNiveisPalanca(ctx, distancia);

  if (!niveis.length) return <p className="py-10 text-center text-sm text-muted-foreground">{t("Visao.semNiveisNesteEcra")}</p>;
  if (aTestar)
    return (
      <EcraPalanca
        olho={olho}
        niveis={niveis}
        ladoMaxBarras={ladoMaxBarras}
        distancia={distancia}
        comVoz={comVoz}
        pxPorMm={ctx.pxPorMm}
        aoParar={() => setATestar(false)}
        aoTerminar={aoTerminar}
      />
    );
  return (
    <EcraPasso
      icone={<DoisOlhos tapado={olho === "direito" ? "esquerdo" : "direito"} />}
      titulo={t(confirmacao ? "Visao.palancaConfirmarTitulo" : "Visao.palancaOlhoTitulo", {
        olho: t(olho === "direito" ? "Visao.olhoDireito" : "Visao.olhoEsquerdo"),
      })}
      accao={
        <Button size="lg" onClick={() => setATestar(true)}>
          {t("Visao.palancaComecar")}
        </Button>
      }
    >
      {confirmacao && <p className="text-sm text-foreground">{t("Visao.palancaConfirmarTexto")}</p>}
      <p className="text-sm text-muted-foreground">{t("Visao.palancaOlhoTexto", { metros: distancia / 1000 })}</p>
      <p className="text-sm text-muted-foreground">{t("Visao.palancaComoAcaba")}</p>
    </EcraPasso>
  );
};

const ResultadoAcuidadeEcra = ({ res, ctx }: { res: Record<Olho, ResultadoAcuidade>; ctx: ContextoTeste }) => {
  const { t } = useTranslation();
  const { estado, gravar, tentarDeNovo } = useRegistoSessao();
  const { profile } = useProfile();
  const criterio = criterioAcuidade(profile?.faixa_etaria);
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
          // Desde 2026-11-12: barras à volta da mãozinha (onde cabem no ecrã),
          // descida rápida + limiar de 4 por tamanho, e o olho pior repetido
          // quando há 2 linhas ou mais de diferença. É outro tipo de sessão.
          aglomeracao: true,
          barras_no_limiar: res[olho].barrasNoLimiar,
          protocolo: "rapida_4_3",
          confirmado: res[olho].confirmado === true,
          criterio: criterio.linha,
          optotipo: "E",
          resposta: res[olho].comVoz ? "voz_e_gesto" : "gesto",
        },
      })),
    );
    // O critério só entra como anotação; a sessão grava-se uma vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, gravar, res]);

  const s = sinaisAcuidade({ direito: res.direito.limiar, esquerdo: res.esquerdo.limiar }, criterio);
  const sinais = [
    ...s.abaixoDoCriterio.map((o) =>
      t(o === "direito" ? "Visao.acuidadeSinalDireito" : "Visao.acuidadeSinalEsquerdo", { linha: criterio.linha }),
    ),
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
          <CartaoOlho key={olho} titulo={titulo} estado={s.abaixoDoCriterio.includes(olho) ? "sinal" : "ok"}>
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
          {OLHOS.filter((o) => res[o].confirmado).map((o) => (
            <p key={o}>{t("Visao.palancaConfirmado", { olho: t(o === "direito" ? "Visao.olhoDireito" : "Visao.olhoEsquerdo") })}</p>
          ))}
          <p>{t("Visao.palancaMedidoA", { metros: distancia / 1000 })}</p>
          <p>{t(criterio.linha === "6/12" ? "Visao.palancaCriterio6_12" : "Visao.palancaCriterio6_9")}</p>
          {!ctx.calibrado && <p>{t("Visao.semCartaoAviso")}</p>}
          {algumLimite && <p>{t("Visao.acuidadeLimiteEcra")}</p>}
        </div>
      }
    />
  );
};

/** Os dois resultados do mesmo olho: fica o melhor, e o tempo dos dois. */
const juntarConfirmacao = (primeiro: ResultadoAcuidade, segundo: ResultadoAcuidade): ResultadoAcuidade => {
  const segundoMelhor = primeiro.limiar === null || (segundo.limiar !== null && segundo.limiar < primeiro.limiar);
  return {
    ...(segundoMelhor ? segundo : primeiro),
    segundosActivos: primeiro.segundosActivos + segundo.segundosActivos,
    duracaoSegundos: primeiro.duracaoSegundos + segundo.duracaoSegundos,
    confirmado: true,
  };
};

/**
 * Antes do resultado: com 2 linhas ou mais de diferença entre os olhos, o
 * pior repete-se e fica o melhor dos dois (`olhoAConfirmar`).
 */
const ResultadoComConfirmacao = ({ res, ctx }: { res: Record<Olho, ResultadoAcuidade>; ctx: ContextoTeste }) => {
  const [alvo] = useState(() => olhoAConfirmar(res.direito.limiar, res.esquerdo.limiar));
  const [final, setFinal] = useState<Record<Olho, ResultadoAcuidade> | null>(null);
  if (!alvo) return <ResultadoAcuidadeEcra res={res} ctx={ctx} />;
  if (!final)
    return (
      <TarefaPalancaLonge
        olho={alvo}
        ctx={ctx}
        confirmacao
        aoTerminar={(r) => setFinal({ ...res, [alvo]: juntarConfirmacao(res[alvo], r) })}
      />
    );
  return <ResultadoAcuidadeEcra res={final} ctx={ctx} />;
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
        semPassoTapar
        preparacao={{ nome: t("Visao.passoPreparar"), render: (aoContinuar, ctx) => <PrepararPalanca ctx={ctx} aoContinuar={aoContinuar} /> }}
        tarefa={(olho, ctx, aoTerminar) => <TarefaPalancaLonge olho={olho} ctx={ctx} aoTerminar={aoTerminar} />}
        resultado={(res, ctx) => <ResultadoComConfirmacao res={res} ctx={ctx} />}
      />
    </PaginaExercicio>
  );
};

export default TesteAcuidade;
