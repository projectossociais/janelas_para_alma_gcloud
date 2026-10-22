import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import BaseExercise from "@/components/exercises/BaseExercise";
import BotaoOuvir from "@/components/visao/BotaoOuvir";
import { BotaoContinuar, EcraPasso } from "@/components/visao/EcraPasso";
import PaginaExercicio from "@/components/visao/PaginaExercicio";
import { PassoCalibracao } from "@/components/visao/Passos";
import { CartaoOlho, EcraResultado } from "@/components/visao/Resultados";
import { useCalibracao, useRegistoSessao } from "@/components/visao/hooks";
import { formatarDecimal } from "@/i18n/formatar";
import { PX_POR_MM_NOMINAL } from "@/lib/visao/calibracao";
import {
  MEDICOES_PPC,
  MISSANGAS,
  RESPOSTAS_FIO,
  SEGUNDOS_SEGURAR,
  ZERO_REGUA_PX,
  cmNaRegua,
  linhasDoFio,
  resumirFio,
  type RespostaFio,
} from "@/lib/visao/fioMissangas";
import { ID_CONTRASTE } from "@/lib/visao/ids";
import { falar, sinalSonoro } from "@/lib/visao/voz";

/** O id histórico `cerebro` (antes, Teste de Contraste). */
const EXERCICIO_ID = ID_CONTRASTE;

type Etapa = "preparar" | "calibracao" | "missanga" | "regua" | "resultado";

/** O fio da porta ao nariz, com as três missangas, para mostrar como montar. */
const DesenhoFio = () => {
  const { t } = useTranslation();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext("2d");
    if (!g) return;
    g.fillStyle = "#eef6ef";
    g.fillRect(0, 0, 600, 220);
    g.fillStyle = "#8a6d4b";
    g.fillRect(560, 20, 22, 190);
    g.fillStyle = "#555555";
    g.fillRect(548, 104, 24, 8);
    g.fillStyle = "#f0c9a0";
    g.beginPath();
    g.arc(70, 108, 46, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(112, 104);
    g.lineTo(130, 112);
    g.lineTo(110, 120);
    g.fill();
    g.fillStyle = "#222222";
    g.beginPath();
    g.arc(92, 96, 4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#6b5a45";
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(130, 112);
    g.lineTo(560, 108);
    g.stroke();
    [200, 345, 500].forEach((x, i) => {
      g.fillStyle = MISSANGAS[i].hex;
      g.beginPath();
      g.arc(x, 112 - ((x - 130) / 430) * 4, 10, 0, Math.PI * 2);
      g.fill();
    });
  }, []);
  return (
    <canvas
      ref={ref}
      width={600}
      height={220}
      role="img"
      aria-label={t("Visao.fioRotuloDesenho")}
      className="block h-auto w-full rounded-xl"
    />
  );
};

/** Desenho de uma resposta: os dois fios e a missanga a meio. */
const DesenhoResposta = ({ r, hex }: { r: RespostaFio; hex: string }) => (
  <svg width={54} height={75} viewBox="0 0 72 100" aria-hidden className="shrink-0">
    <defs>
      <clipPath id={`fio-${r}`}>
        <rect width={72} height={100} />
      </clipPath>
    </defs>
    <g clipPath={`url(#fio-${r})`} stroke="currentColor" strokeWidth={2.5}>
      {linhasDoFio(r).map((l, i) => (
        <line key={i} {...l} />
      ))}
    </g>
    <circle cx={36} cy={46} r={6} fill={hex} />
  </svg>
);

/** A régua em ecrã inteiro: o zero à altura da ponta do nariz, um toque onde ficou a missanga. */
const Regua = ({
  pxPorMm,
  medicao,
  aoMedir,
}: {
  pxPorMm: number;
  medicao: number;
  aoMedir: (cm: number | null) => void;
}) => {
  const { t, i18n } = useTranslation();
  const ref = useRef<HTMLCanvasElement>(null);
  const [marca, setMarca] = useState<number | null>(null);
  const [tam, setTam] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const medir = () => setTam({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  useEffect(() => {
    const cv = ref.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(tam.w * dpr);
    cv.height = Math.round(tam.h * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, tam.w, tam.h);
    g.strokeStyle = "#000000";
    g.fillStyle = "#000000";
    g.font = "600 14px system-ui, sans-serif";
    for (let mm = 0; ZERO_REGUA_PX + mm * pxPorMm < tam.h; mm++) {
      const y = ZERO_REGUA_PX + mm * pxPorMm;
      const cm = mm % 10 === 0;
      g.lineWidth = cm ? 2 : 1;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(cm ? 44 : mm % 5 === 0 ? 30 : 18, y);
      g.stroke();
      if (cm) g.fillText(`${mm / 10} cm`, 52, y + 5);
    }
    g.fillStyle = "#2e7a4c";
    g.fillText(t("Visao.fioZeroNariz"), 52, ZERO_REGUA_PX - 8);
    if (marca !== null) {
      const y = ZERO_REGUA_PX + marca * 10 * pxPorMm;
      g.strokeStyle = "#c0392b";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(tam.w, y);
      g.stroke();
    }
  }, [marca, pxPorMm, t, tam]);

  const tocar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if ((e.target as HTMLElement).closest("button") || marca !== null) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    if (!Number.isFinite(y)) return;
    const cm = cmNaRegua(y, pxPorMm);
    setMarca(cm);
    sinalSonoro("tic");
    falar(t("Visao.fioVozCm", { cm: formatarDecimal(cm, cm % 1 ? 1 : 0) }), i18n.language);
    window.setTimeout(() => {
      setMarca(null);
      aoMedir(cm);
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-[100]" style={{ backgroundColor: "#ffffff", color: "#000000", colorScheme: "light" }}>
      <canvas
        ref={ref}
        role="img"
        aria-label={t("Visao.fioRotuloRegua")}
        className="block touch-none"
        style={{ width: tam.w, height: tam.h }}
        onPointerDown={tocar}
      />
      {/* O mesmo que a voz diz, para quem tem o som desligado; os toques passam para a régua. */}
      <p className="pointer-events-none absolute right-4 top-12 max-w-[50%] text-right text-sm leading-snug" style={{ color: "#333333" }}>
        {medicao === 0 ? t("Visao.fioVozRegua") : t("Visao.fioVozOutraVez")}
      </p>
      <div className="absolute bottom-4 right-4 flex max-w-[55%] flex-col items-end gap-2 text-right text-sm">
        <p style={{ color: "#333333" }}>{t("Visao.fioMedicao", { n: medicao + 1, total: MEDICOES_PPC })}</p>
        <button
          type="button"
          className="rounded-lg border px-3 py-2"
          style={{ borderColor: "#cccccc", backgroundColor: "#f4f4f4", color: "#333333" }}
          onClick={() => aoMedir(null)}
        >
          {t("Visao.fioMaisLonge")}
        </button>
      </div>
    </div>
  );
};

/**
 * Fio de Missangas (id `cerebro`, no teste de 7 dias): o cordão de Brock com
 * objectos de casa, e o telemóvel a falar e a medir. Ver
 * `lib/visao/fioMissangas.ts`.
 */
const FioMissangas = () => {
  const { t, i18n } = useTranslation();
  const { calibracao, guardar } = useCalibracao();
  const [etapa, setEtapa] = useState<Etapa>("preparar");
  const [i, setI] = useState(0);
  const [respostas, setRespostas] = useState<RespostaFio[]>([]);
  const [contagem, setContagem] = useState<number | null>(null);
  const [ppc, setPpc] = useState<(number | null)[]>([]);
  const inicio = useRef(Date.now());
  const pxPorMm = calibracao?.pxPorMm ?? PX_POR_MM_NOMINAL;

  const m = MISSANGAS[i];
  const nomeCor = (c: string) => t(`Visao.fioCor_${c}`);
  const textoMissanga = m ? t("Visao.fioMissangaTexto", { cor: nomeCor(m.cor) }) : "";
  const ultima = respostas[i];

  useEffect(() => {
    if (etapa === "missanga" && contagem === null) falar(textoMissanga, i18n.language);
  }, [contagem, etapa, i18n.language, textoMissanga]);

  // Segurar o X: uma contagem de 10 segundos, um bip por segundo.
  const aSegurar = contagem !== null;
  useEffect(() => {
    if (!aSegurar) return;
    const id = window.setInterval(() => {
      sinalSonoro("tic");
      setContagem((c) => (c === null ? null : c - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [aSegurar]);
  useEffect(() => {
    if (contagem === null || contagem > 0) return;
    setContagem(null);
    if (i + 1 < MISSANGAS.length) setI(i + 1);
    else {
      setEtapa("regua");
      falar(t("Visao.fioVozRegua"), i18n.language);
    }
  }, [contagem, i, i18n.language, t]);

  const passos = [t("Visao.passoPreparar"), t("Visao.passoCartao"), t("Visao.fioPassoMissangas"), t("Visao.fioPassoRegua"), t("Visao.passoResultado")];
  const passoActual = { preparar: 0, calibracao: 1, missanga: 2, regua: 3, resultado: 4 }[etapa];

  let conteudo;
  if (etapa === "preparar") {
    const lista = [1, 2, 3, 4].map((n) => t(`Visao.fioPreparar${n}`));
    conteudo = (
      <EcraPasso
        titulo={t("Visao.fioPrepararTitulo")}
        accao={<BotaoContinuar aoClicar={() => setEtapa(calibracao?.calibrado ? "missanga" : "calibracao")} />}
      >
        <div className="w-full space-y-3 text-left text-sm">
          <DesenhoFio />
          <ol className="list-decimal space-y-1 pl-5 text-foreground">
            {lista.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
          <BotaoOuvir texto={lista.join(" ")} />
        </div>
      </EcraPasso>
    );
  } else if (etapa === "calibracao")
    conteudo = <PassoCalibracao calibracao={calibracao} aoGuardar={guardar} aoContinuar={() => setEtapa("missanga")} />;
  else if (etapa === "missanga" && m)
    conteudo = (
      <EcraPasso titulo={t("Visao.fioMissangaTitulo", { cor: nomeCor(m.cor), n: i + 1, total: MISSANGAS.length })}>
        <div className="w-full space-y-3 text-left text-sm">
          {contagem === null ? (
            <>
              <p className="text-foreground">{textoMissanga}</p>
              <BotaoOuvir texto={textoMissanga} />
              <div className="grid gap-2">
                {RESPOSTAS_FIO.map((r) => (
                  <Button
                    key={r}
                    variant="outline"
                    className="h-auto justify-start gap-3 whitespace-normal py-2 text-left"
                    onClick={() => {
                      sinalSonoro(r === "x" ? "certo" : "tic");
                      setRespostas((rs) => {
                        const n = [...rs];
                        n[i] = r;
                        return n;
                      });
                      falar(t(`Visao.fioDica_${r}`, { cor: nomeCor(m.cor) }), i18n.language);
                      setContagem(SEGUNDOS_SEGURAR);
                    }}
                  >
                    <DesenhoResposta r={r} hex={m.hex} />
                    <span>{t(`Visao.fioResposta_${r}`)}</span>
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-3 text-center">
              <p className="text-foreground">{ultima ? t(`Visao.fioDica_${ultima}`, { cor: nomeCor(m.cor) }) : null}</p>
              <p className="text-6xl font-bold tabular-nums text-teal" aria-live="polite">
                {Math.max(0, contagem)}
              </p>
            </div>
          )}
        </div>
      </EcraPasso>
    );
  else if (etapa === "regua")
    conteudo = (
      <Regua
        pxPorMm={pxPorMm}
        medicao={ppc.length}
        aoMedir={(cm) => {
          const novo = [...ppc, cm];
          setPpc(novo);
          if (novo.length >= MEDICOES_PPC) setEtapa("resultado");
          else falar(t("Visao.fioVozOutraVez"), i18n.language);
        }}
      />
    );
  else
    conteudo = (
      <ResultadoFio
        respostas={respostas}
        ppc={ppc}
        pxPorMm={pxPorMm}
        calibrado={calibracao?.calibrado ?? false}
        segundos={Math.max(1, Math.round((Date.now() - inicio.current) / 1000))}
      />
    );

  return (
    <PaginaExercicio>
      <BaseExercise
        title={t("Visao.contrasteTitulo")}
        description={t("Visao.contrasteDescricao")}
        exercicioId={EXERCICIO_ID}
        grupo="trial"
        tipo="teste"
        passos={passos}
        passoActual={passoActual}
      >
        {conteudo}
      </BaseExercise>
    </PaginaExercicio>
  );
};

const ResultadoFio = ({
  respostas,
  ppc,
  pxPorMm,
  calibrado,
  segundos,
}: {
  respostas: RespostaFio[];
  ppc: (number | null)[];
  pxPorMm: number;
  calibrado: boolean;
  segundos: number;
}) => {
  const { t } = useTranslation();
  const { estado, gravar, tentarDeNovo } = useRegistoSessao();
  const gravou = useRef(false);
  const r = resumirFio(respostas, ppc);
  const reguaCm = Math.floor((window.innerHeight - ZERO_REGUA_PX) / pxPorMm / 10);

  useEffect(() => {
    if (gravou.current) return;
    gravou.current = true;
    void gravar([
      {
        exercicio_id: EXERCICIO_ID,
        olho: "ambos",
        duracao_segundos: segundos,
        segundos_activos: segundos,
        limiar: r.ppcCm,
        unidade: "cm",
        px_por_mm: Math.round(pxPorMm * 1000) / 1000,
        calibrado,
        sinais: {
          modo: "fio_missangas",
          respostas: Object.fromEntries(MISSANGAS.map((m, i) => [m.cor, respostas[i] ?? null])),
          supressao: r.supressao,
          x_no_sitio: r.xNoSitio,
          ppc_medicoes_cm: ppc,
          ppc_alem_da_regua: r.alemDaRegua,
          regua_cm: reguaCm,
        },
      },
    ]);
  }, [calibrado, gravar, pxPorMm, ppc, r, reguaCm, respostas, segundos]);

  const sinais = [
    ...(r.supressao ? [t("Visao.fioSinalSupressao")] : []),
    ...(r.classe === "alto" ? [t("Visao.fioSinalPpc")] : []),
  ];
  const ppcTexto = r.ppcCm === null ? t("Visao.fioPpcAlem", { cm: reguaCm }) : `${formatarDecimal(r.ppcCm, r.ppcCm % 1 ? 1 : 0)} cm`;

  return (
    <EcraResultado
      titulo={t("Visao.fioResultadoTitulo")}
      gravacao={estado}
      aoTentarDeNovo={() => void tentarDeNovo()}
      sinais={sinais}
      cartoes={[
        <CartaoOlho key="ppc" titulo={t("Visao.fioPpcTitulo")} estado={r.classe === "alto" ? "sinal" : r.classe === "limite" ? "indeterminado" : "ok"}>
          <p className="text-2xl font-bold text-foreground">{ppcTexto}</p>
          <p>{t(`Visao.fioPpcClasse_${r.classe}`)}</p>
        </CartaoOlho>,
        <CartaoOlho key="fios" titulo={t("Visao.fioFiosTitulo")} estado={r.supressao ? "sinal" : "ok"}>
          <p className="text-2xl font-bold text-foreground">{t("Visao.fioXNoSitio", { n: r.xNoSitio, total: MISSANGAS.length })}</p>
          <p>{r.supressao ? t("Visao.fioUmFio") : t("Visao.fioDoisFios")}</p>
        </CartaoOlho>,
      ]}
      notas={
        <div className="space-y-2 text-center text-xs text-muted-foreground">
          <p>{t("Visao.fioNota")}</p>
          {!calibrado && <p>{t("Visao.semCartaoAviso")}</p>}
        </div>
      }
    />
  );
};

export default FioMissangas;
