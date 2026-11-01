import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import BaseExercise from "@/components/exercises/BaseExercise";
import { BotaoContinuar, EcraPasso } from "@/components/visao/EcraPasso";
import PaginaExercicio from "@/components/visao/PaginaExercicio";
import { PassoCalibracao } from "@/components/visao/Passos";
import { CartaoOlho, EcraResultado } from "@/components/visao/Resultados";
import { useCalibracao, useRegistoSessao } from "@/components/visao/hooks";
import { formatarDecimal } from "@/i18n/formatar";
import { PX_POR_MM_NOMINAL } from "@/lib/visao/calibracao";
import {
  MISSANGAS,
  NARIZ_MM,
  RONDAS,
  inicioDaMissanga,
  meioCm,
  posicaoDaMissanga,
  resumirFio,
  roturaAlem,
  yDoCm,
  type RondaFio,
} from "@/lib/visao/fioMissangas";
import { ID_CONTRASTE } from "@/lib/visao/ids";
import { sinalSonoro } from "@/lib/visao/voz";

/** O id histórico `cerebro` (antes, Teste de Contraste). */
const EXERCICIO_ID = ID_CONTRASTE;

type Etapa = "preparar" | "calibracao" | "medir" | "resultado";

/** Pausa entre rondas, com a missanga parada no início. */
const PAUSA_MS = 1200;
/** De quanto em quanto tempo a missanga anda (≈ 30 imagens por segundo). */
const PASSO_MS = 33;
/** Logo a seguir a "ficou a dobrar", um segundo toque é o mesmo toque repetido, não "voltou a ser uma". */
const TOQUE_DUPLO_MS = 500;

const cmTexto = (cm: number) => `${formatarDecimal(cm, cm % 1 ? 1 : 0)} cm`;

/** De lado: a cabeça, o telemóvel deitado com a ponta encostada ao nariz e o olhar na missanga. */
const DesenhoComoSegurar = () => {
  const { t } = useTranslation();
  return (
    <svg viewBox="0 0 300 150" role="img" aria-label={t("Visao.fioRotuloDesenho")} className="h-auto w-full">
      <rect width={300} height={150} rx={14} fill="#eef5f3" />
      <ellipse cx={66} cy={70} rx={46} ry={56} fill="#e7c3a0" />
      <path d="M108 62 L128 88 L108 94 Z" fill="#e7c3a0" />
      <path d="M96 52 q8 -5 14 0" stroke="#3b2a20" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <circle cx={102} cy={60} r={3.5} fill="#1f1a17" />
      <rect x={126} y={96} width={160} height={9} rx={3} fill="#1d2423" />
      <rect x={129} y={97.5} width={154} height={4} rx={1.5} fill="#cfe8e3" />
      <line x1={103} y1={61} x2={222} y2={94} stroke="#127a6e" strokeWidth={2} strokeDasharray="5 5" />
      <circle cx={222} cy={92} r={7} fill={MISSANGAS[0].hex} />
      <circle cx={219.5} cy={89.5} r={2} fill="#ffffff" opacity={0.8} />
      <path d="M128 118 L128 108" stroke="#56635f" strokeWidth={1.5} />
      <text x={128} y={134} textAnchor="middle" fontSize={12} fill="#3f4a47">
        {t("Visao.fioDesenhoNariz")}
      </text>
    </svg>
  );
};

/**
 * O ecrã inteiro e branco: o fio ao centro, a barra do nariz em baixo e a
 * missanga a descer. Um toque em qualquer sítio marca "ficou a dobrar" e,
 * depois, "voltou a ser uma".
 */
const EcraMissanga = ({ pxPorMm, aoAcabar }: { pxPorMm: number; aoAcabar: (rondas: RondaFio[], inicioCm: number) => void }) => {
  const { t } = useTranslation();
  const ref = useRef<HTMLCanvasElement>(null);
  const [tam, setTam] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [ronda, setRonda] = useState(0);
  const [fase, setFase] = useState<"pausa" | "aproximar" | "afastar">("pausa");
  const [rondas, setRondas] = useState<RondaFio[]>([]);
  const [cm, setCm] = useState(() => inicioDaMissanga(window.innerHeight, pxPorMm));
  const [inicioCm, setInicioCm] = useState(cm);
  // A rotura desta ronda, enquanto a missanga se afasta.
  const [roturaActual, setRoturaActual] = useState<number | null>(null);
  // Onde a missanga começou o movimento actual, e quando.
  const movimento = useRef({ desde: cm, t0: Date.now() });
  const aoAcabarRef = useRef(aoAcabar);
  aoAcabarRef.current = aoAcabar;

  // Ecrã inteiro, quando o aparelho deixa (no iPhone não): o fundo da página fica na ponta do telemóvel.
  useEffect(() => {
    // Nem todos os navegadores têm a API, e alguns devolvem undefined em vez de uma promessa.
    const pedido = document.documentElement.requestFullscreen?.() as Promise<void> | undefined;
    pedido?.catch(() => undefined);
    return () => {
      if (!document.fullscreenElement) return;
      const saida = document.exitFullscreen?.() as Promise<void> | undefined;
      saida?.catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    const medir = () => setTam({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  // Pausa: a missanga volta ao início (medido agora, já em ecrã inteiro) e parte daí a pouco.
  useEffect(() => {
    if (fase !== "pausa") return;
    const inicio = inicioDaMissanga(window.innerHeight, pxPorMm);
    setInicioCm(inicio);
    setCm(inicio);
    const id = window.setTimeout(() => {
      movimento.current = { desde: inicio, t0: Date.now() };
      setFase("aproximar");
    }, PAUSA_MS);
    return () => window.clearTimeout(id);
  }, [fase, pxPorMm, ronda]);

  const fecharRonda = (r: RondaFio) => {
    const novas = [...rondas, r];
    setRondas(novas);
    sinalSonoro(novas.length >= RONDAS ? "fim" : "tic");
    if (novas.length >= RONDAS) aoAcabarRef.current(novas, inicioCm);
    else {
      setRonda(novas.length);
      setFase("pausa");
    }
  };

  // A missanga a andar; ao chegar ao nariz (ou de volta ao início) a ronda fecha sozinha.
  useEffect(() => {
    if (fase === "pausa") return;
    const id = window.setInterval(() => {
      const { desde, t0 } = movimento.current;
      const agora = posicaoDaMissanga(desde, (Date.now() - t0) / 1000, fase, inicioCm);
      setCm(agora);
      if (fase === "aproximar" && agora <= NARIZ_MM / 10) {
        window.clearInterval(id);
        fecharRonda({ rotura: 0, recuperacao: 0, alem: false });
      } else if (fase === "afastar" && agora >= inicioCm) {
        window.clearInterval(id);
        const rotura = roturaActual ?? 0;
        setRoturaActual(null);
        fecharRonda({ rotura, recuperacao: null, alem: roturaAlem(rotura, inicioCm) });
      }
    }, PASSO_MS);
    return () => window.clearInterval(id);
    // `fecharRonda` muda a cada render; o intervalo só recomeça quando muda a fase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, inicioCm, ronda]);

  const tocar = () => {
    if (fase === "pausa") return;
    const { desde, t0 } = movimento.current;
    if (fase === "afastar" && Date.now() - t0 < TOQUE_DUPLO_MS) return;
    const aqui = meioCm(posicaoDaMissanga(desde, (Date.now() - t0) / 1000, fase, inicioCm));
    if (fase === "aproximar") {
      sinalSonoro("tic");
      setRoturaActual(aqui);
      movimento.current = { desde: aqui, t0: Date.now() };
      setCm(aqui);
      setFase("afastar");
    } else {
      const rotura = roturaActual ?? aqui;
      setRoturaActual(null);
      fecharRonda({ rotura, recuperacao: Math.max(rotura, aqui), alem: roturaAlem(rotura, inicioCm) });
    }
  };

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
    const x = tam.w / 2;
    const narizY = yDoCm(NARIZ_MM / 10, tam.h, pxPorMm);
    // Marcas discretas de centímetro, à direita e sem números (não influenciam a resposta).
    g.strokeStyle = "#dfe7e5";
    g.lineWidth = 1;
    for (let c = 1; yDoCm(c, tam.h, pxPorMm) > 0; c++) {
      const y = yDoCm(c, tam.h, pxPorMm);
      g.beginPath();
      g.moveTo(tam.w, y);
      g.lineTo(tam.w - (c % 5 === 0 ? 22 : 12), y);
      g.stroke();
    }
    g.strokeStyle = "#8a6d4b";
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(x, narizY);
    g.lineTo(x, yDoCm(inicioCm, tam.h, pxPorMm));
    g.stroke();
    if (roturaActual !== null) {
      g.fillStyle = "rgba(178,59,46,0.85)";
      g.fillRect(x - 18, yDoCm(roturaActual, tam.h, pxPorMm) - 1.5, 36, 3);
    }
    const y = yDoCm(cm, tam.h, pxPorMm);
    g.fillStyle = MISSANGAS[ronda % MISSANGAS.length].hex;
    g.beginPath();
    g.arc(x, y, 13, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.75)";
    g.beginPath();
    g.arc(x - 4, y - 4, 3.5, 0, Math.PI * 2);
    g.fill();
    // Um pormenor pequeno para os olhos focarem.
    g.fillStyle = "#111111";
    g.beginPath();
    g.arc(x + 3, y + 3, 1.6, 0, Math.PI * 2);
    g.fill();
  }, [cm, inicioCm, pxPorMm, ronda, roturaActual, tam]);

  const narizPx = NARIZ_MM * pxPorMm;
  return (
    <div className="fixed inset-0 z-[100]" style={{ backgroundColor: "#ffffff", color: "#17201f", colorScheme: "light" }}>
      <canvas ref={ref} aria-hidden className="block" style={{ width: tam.w, height: tam.h }} />
      {/* À esquerda, para não tapar o fio, que está ao centro. */}
      <div className="pointer-events-none absolute left-4 top-4 max-w-[38%] space-y-2 text-left" aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#56635f" }}>
          {t("Visao.fioRonda", { n: ronda + 1, total: RONDAS })}
        </p>
        <p className="text-xl font-bold leading-tight">{fase === "afastar" ? t("Visao.fioToqueUma") : t("Visao.fioToqueDuas")}</p>
        <p className="text-sm leading-snug" style={{ color: "#56635f" }}>
          {fase === "afastar" ? t("Visao.fioToqueUmaAjuda") : t("Visao.fioToqueDuasAjuda")}
        </p>
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 grid place-items-center text-sm font-bold"
        style={{ height: narizPx, backgroundColor: "#127a6e", color: "#ffffff" }}
      >
        {t("Visao.fioNariz")}
      </div>
      <button
        type="button"
        aria-label={fase === "afastar" ? t("Visao.fioToqueUma") : t("Visao.fioToqueDuas")}
        className="absolute inset-0 h-full w-full cursor-pointer touch-none bg-transparent focus-visible:outline-none"
        onPointerDown={tocar}
      />
    </div>
  );
};

/**
 * Fio de Missangas (id `cerebro`, no teste de 90 dias): o ponto mais próximo
 * de convergência só com o telemóvel. Ver `lib/visao/fioMissangas.ts`.
 */
const FioMissangas = () => {
  const { t } = useTranslation();
  const { calibracao, guardar } = useCalibracao();
  const [etapa, setEtapa] = useState<Etapa>("preparar");
  const [medido, setMedido] = useState<{ rondas: RondaFio[]; inicioCm: number } | null>(null);
  const inicio = useRef(Date.now());
  const pxPorMm = calibracao?.pxPorMm ?? PX_POR_MM_NOMINAL;

  const passos = [t("Visao.passoPreparar"), t("Visao.passoCartao"), t("Visao.fioPassoMedir"), t("Visao.passoResultado")];
  const passoActual = { preparar: 0, calibracao: 1, medir: 2, resultado: 3 }[etapa];

  let conteudo;
  if (etapa === "preparar") {
    const lista = [1, 2, 3].map((n) => t(`Visao.fioPreparar${n}`));
    conteudo = (
      <EcraPasso
        titulo={t("Visao.fioPrepararTitulo")}
        accao={<BotaoContinuar aoClicar={() => setEtapa(calibracao?.calibrado ? "medir" : "calibracao")}>{t("Visao.fioComecar")}</BotaoContinuar>}
      >
        <div className="w-full space-y-3 text-left text-sm">
          <DesenhoComoSegurar />
          <ol className="list-decimal space-y-1 pl-5 text-base text-foreground">
            {lista.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </div>
      </EcraPasso>
    );
  } else if (etapa === "calibracao")
    conteudo = <PassoCalibracao calibracao={calibracao} aoGuardar={guardar} aoContinuar={() => setEtapa("medir")} />;
  else if (etapa === "medir")
    conteudo = (
      <EcraMissanga
        pxPorMm={pxPorMm}
        aoAcabar={(rondas, inicioCm) => {
          setMedido({ rondas, inicioCm });
          setEtapa("resultado");
        }}
      />
    );
  else
    conteudo = medido && (
      <ResultadoFio
        rondas={medido.rondas}
        inicioCm={medido.inicioCm}
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
  rondas,
  inicioCm,
  pxPorMm,
  calibrado,
  segundos,
}: {
  rondas: RondaFio[];
  inicioCm: number;
  pxPorMm: number;
  calibrado: boolean;
  segundos: number;
}) => {
  const { t } = useTranslation();
  const { estado, gravar, tentarDeNovo } = useRegistoSessao();
  const gravou = useRef(false);
  const r = resumirFio(rondas);

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
          versao: 2,
          rotura_cm: rondas.map((x) => x.rotura),
          recuperacao_cm: rondas.map((x) => x.recuperacao),
          recuperacao_media_cm: r.recuperacaoCm,
          chegou_ao_nariz: r.chegouAoNariz,
          alem_do_ecra: r.alemDoEcra,
          cansaco: r.cansaco,
          inicio_cm: inicioCm,
        },
      },
    ]);
  }, [calibrado, gravar, inicioCm, pxPorMm, r, rondas, segundos]);

  const sinais = [...(r.classe === "alto" ? [t("Visao.fioSinalPpc")] : []), ...(r.cansaco ? [t("Visao.fioCansaco")] : [])];
  const ppcTexto = r.chegouAoNariz ? t("Visao.fioChegouNariz") : r.ppcCm === null ? t("Visao.fioPpcAlem", { cm: inicioCm }) : cmTexto(r.ppcCm);

  return (
    <EcraResultado
      titulo={t("Visao.fioResultadoTitulo")}
      gravacao={estado}
      aoTentarDeNovo={() => void tentarDeNovo()}
      sinais={sinais}
      cartoes={[
        <CartaoOlho key="ppc" titulo={t("Visao.fioPpcTitulo")} estado={r.classe === "alto" ? "sinal" : r.classe === "limite" ? "indeterminado" : "ok"}>
          <p className="text-2xl font-bold text-foreground">{ppcTexto}</p>
          <p>{r.chegouAoNariz ? t("Visao.fioChegouNarizTexto") : t(`Visao.fioPpcClasse_${r.classe}`)}</p>
        </CartaoOlho>,
        <CartaoOlho key="rec" titulo={t("Visao.fioRecuperacaoTitulo")} estado={r.cansaco ? "sinal" : "ok"}>
          <p className="text-2xl font-bold text-foreground">{r.recuperacaoCm === null ? t("Visao.fioRecuperacaoAlem") : cmTexto(r.recuperacaoCm)}</p>
          <p>{t("Visao.fioRondas", { lista: rondas.map((x) => (x.alem ? `> ${inicioCm} cm` : cmTexto(x.rotura))).join(" · ") })}</p>
          <p>{r.cansaco ? t("Visao.fioCansaco") : t("Visao.fioSemCansaco")}</p>
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
