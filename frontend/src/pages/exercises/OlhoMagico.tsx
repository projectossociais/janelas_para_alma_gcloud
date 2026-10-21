import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import BaseExercise from "@/components/exercises/BaseExercise";
import AssistenteTreino, {
  type ApiTarefa,
  type ContextoTreino,
  type ResultadoTreino,
} from "@/components/visao/AssistenteTreino";
import BotaoOuvir from "@/components/visao/BotaoOuvir";
import { EcraPasso } from "@/components/visao/EcraPasso";
import EscolherOculos, { type ComOuSemOculos } from "@/components/visao/EscolherOculos";
import PaginaExercicio from "@/components/visao/PaginaExercicio";
import PalcoVisual from "@/components/visao/PalcoVisual";
import { rotuloDelta, rotuloSentidoPontes } from "@/components/visao/rotulos";
import { escolhaAleatoria } from "@/lib/visao/escada";
import { ID_CONVERGENCIA } from "@/lib/visao/ids";
import {
  CORES_PANO,
  FALHAS_PARA_DICAS,
  FORMAS_PANO,
  GRELHA_PANO,
  PRATICA_SEGUIDAS,
  QUADRO_PANO_MM,
  alargarRampa,
  gerarParPano,
  guardarModoOlhoMagico,
  lerModoOlhoMagico,
  niveisOlhoMagico,
  niveisQueCabem,
  sentidoDoModo,
  type FormaPano,
  type ModoOlhoMagico,
} from "@/lib/visao/olhoMagico";
import {
  iniciarRampa,
  rampaEmDelta,
  responderRampa,
  resumirRampas,
  separacaoMm,
  type EstadoRampa,
  type RampaEmDelta,
  type Sentido,
} from "@/lib/visao/pontes";
import { cn } from "@/lib/utils";
import PontesFusao from "./PontesFusao";

const EXERCICIO_ID = ID_CONVERGENCIA;
const CHAVE_OCULOS = "jpa.visao.convergencia.oculos";
const MODOS: readonly ModoOlhoMagico[] = ["cruzar", "relaxar"];
const CHAVES_FORMA: Record<FormaPano, string> = {
  peixe: "Visao.formaPeixe",
  estrela: "Visao.formaEstrela",
  coracao: "Visao.formaCoracao",
  casa: "Visao.formaCasa",
};
/** Altura do espaço para os dois pontos de referência, por cima dos quadros. */
const PONTOS_PX = 28;

/** Ícone de cada forma para os botões de resposta (viewBox 24). */
export const IconeFormaPano = ({ forma }: { forma: FormaPano }) => (
  <svg viewBox="0 0 24 24" className="h-8 w-8 fill-current" aria-hidden>
    {forma === "peixe" && (
      <>
        <ellipse cx={13.4} cy={12} rx={7.7} ry={5.3} />
        <polygon points="7.2,12 1.9,6.5 1.9,17.5" />
      </>
    )}
    {forma === "estrela" && (
      <polygon
        points={Array.from({ length: 10 }, (_, i) => {
          const r = i % 2 ? 4.3 : 10.1;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          return `${(12 + r * Math.cos(a)).toFixed(2)},${(13 + r * Math.sin(a)).toFixed(2)}`;
        }).join(" ")}
      />
    )}
    {forma === "coracao" && <path d="M12 21 C3 15 2.5 8.5 7 6.5 C9.6 5.4 11.3 6.8 12 8.2 C12.7 6.8 14.4 5.4 17 6.5 C21.5 8.5 21 15 12 21Z" />}
    {forma === "casa" && <path d="M3.8 12 L12 3.4 L20.2 12 L17.8 12 L17.8 20.6 L6.2 20.6 L6.2 12 Z" />}
  </svg>
);

/** Um quadro de pano: pontos coloridos dentro de uma moldura escura, em píxeis de dispositivo. */
const QuadroPano = ({ grelha, ladoCss, dpr }: { grelha: Uint8Array; ladoCss: number; dpr: number }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const lado = Math.max(1, Math.round(ladoCss * dpr));
  useEffect(() => {
    const g = ref.current?.getContext("2d");
    if (!g) return;
    const moldura = Math.max(2, Math.round(lado * 0.045));
    g.fillStyle = CORES_PANO[0];
    g.fillRect(0, 0, lado, lado);
    const dentro = lado - 2 * moldura;
    const n = GRELHA_PANO;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const x0 = moldura + Math.round((x * dentro) / n);
        const x1 = moldura + Math.round(((x + 1) * dentro) / n);
        const y0 = moldura + Math.round((y * dentro) / n);
        const y1 = moldura + Math.round(((y + 1) * dentro) / n);
        g.fillStyle = CORES_PANO[grelha[y * n + x]];
        g.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
  }, [grelha, lado]);
  return <canvas ref={ref} width={lado} height={lado} style={{ width: ladoCss, height: ladoCss, display: "block" }} />;
};

function useLarguraDe(ref: MutableRefObject<HTMLDivElement | null>): number {
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const medir = () => setLargura(ref.current?.clientWidth ?? 0);
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [ref]);
  return largura;
}

/** Uma forma nova (nunca a mesma da anterior) e um par de quadros novo. */
const novaForma = (anterior: number | null) => {
  const forma = escolhaAleatoria(FORMAS_PANO.length, anterior);
  return { forma, par: gerarParPano(FORMAS_PANO[forma]) };
};

const aoAlto = () => typeof window !== "undefined" && window.innerWidth < window.innerHeight;

type Fase = "praticar" | "dicas" | "rampas";

/**
 * Olho Mágico (sem óculos): pratica-se no primeiro degrau até acertar
 * `PRATICA_SEGUIDAS` seguidas; depois, rampas de rotura e recuperação no
 * sentido do modo (cruzar = convergência, relaxar = divergência). Ao alto,
 * quando os quadros já não se podem afastar mais, pede para deitar o
 * telemóvel e continua. A cada ~10 respostas, um controlo no primeiro degrau.
 */
export const TarefaOlhoMagico = ({
  api,
  ctx,
  resultado,
}: {
  api: ApiTarefa;
  ctx: ContextoTreino;
  resultado: MutableRefObject<(() => ResultadoTreino) | null>;
}) => {
  const { t } = useTranslation();
  const contentor = useRef<HTMLDivElement | null>(null);
  const larguraCss = useLarguraDe(contentor);
  const { pxPorMm, distanciaMm, devicePixelRatio } = ctx;
  const dpr = Math.min(3, devicePixelRatio || 1);

  const [modo, setModo] = useState<ModoOlhoMagico>(() => lerModoOlhoMagico());
  const sentido = sentidoDoModo(modo);
  const todos = useMemo(() => niveisOlhoMagico(sentido, distanciaMm), [distanciaMm, sentido]);
  const niveis = useMemo(
    () => (larguraCss > 0 ? niveisQueCabem(todos, distanciaMm, larguraCss / pxPorMm) : []),
    [distanciaMm, larguraCss, pxPorMm, todos],
  );

  const [fase, setFase] = useState<Fase>("praticar");
  const [pratica, setPratica] = useState({ seguidas: 0, falhas: 0 });
  const [rampa, setRampa] = useState<EstadoRampa | null>(null);
  const [esperaRodar, setEsperaRodar] = useState(false);
  const [controlo, setControlo] = useState(false);
  const [apresentacao, setApresentacao] = useState(() => novaForma(null));
  const { forma, par } = apresentacao;
  const [aviso, setAviso] = useState<{ certo: boolean; forma: FormaPano } | null>(null);
  const rampas = useRef<Record<Sentido, RampaEmDelta[]>>({ convergencia: [], divergencia: [] });
  const [ultima, setUltima] = useState<{ sentido: Sentido; r: RampaEmDelta } | null>(null);

  // Começa a rampa quando a prática passa e cabem pelo menos dois degraus;
  // depois de rodar o telemóvel, continua com os degraus novos.
  useEffect(() => {
    if (fase !== "rampas") return;
    if (!rampa) {
      if (niveis.length >= 2) {
        setRampa(iniciarRampa(niveis.length));
        setEsperaRodar(false);
      } else setEsperaRodar(true);
      return;
    }
    if (esperaRodar && niveis.length > rampa.total) {
      setRampa(alargarRampa(rampa, niveis.length));
      setEsperaRodar(false);
    }
  }, [esperaRodar, fase, niveis.length, rampa]);

  resultado.current = () => {
    const conv = resumirRampas(rampas.current.convergencia);
    const div = resumirRampas(rampas.current.divergencia);
    const sentidoLimiar: Sentido | null = conv.rampas ? "convergencia" : div.rampas ? "divergencia" : null;
    const principal = sentidoLimiar === "convergencia" ? conv : div;
    const linhas = [
      ...(conv.rampas ? [rotuloSentidoPontes("convergencia", conv)] : []),
      ...(div.rampas ? [rotuloSentidoPontes("divergencia", div)] : []),
    ];
    return {
      limiar: sentidoLimiar ? principal.rotura : null,
      unidade: "dioptrias_prismaticas",
      resumo: linhas.length ? linhas.join(" · ") : t("Visao.olhoMagicoSemRampas"),
      sinais: {
        modo: "fusao_livre",
        modo_fusao: modo,
        pontes: { convergencia: conv, divergencia: div },
        sentido_limiar: sentidoLimiar,
        quadro_mm: QUADRO_PANO_MM,
      },
    };
  };

  const novaApresentacao = () => setApresentacao((a) => novaForma(a.forma));

  const mudarModo = (m: ModoOlhoMagico) => {
    if (m === modo) return;
    setModo(m);
    guardarModoOlhoMagico(m);
    // Outro modo é outra habilidade: volta a praticar.
    setFase("praticar");
    setPratica({ seguidas: 0, falhas: 0 });
    setRampa(null);
    setEsperaRodar(false);
  };

  const indice = fase === "praticar" || controlo || !rampa ? 0 : rampa.indice;
  // Voltou a pôr o telemóvel ao alto a meio da rampa: o degrau já não cabe.
  const foraDoEcra = fase === "rampas" && !!rampa && !controlo && larguraCss > 0 && indice >= niveis.length;

  const responder = (i: number | null) => {
    if (!api.activo || esperaRodar || foraDoEcra) return;
    const acertou = i !== null && i === forma;
    setAviso({ certo: acertou, forma: FORMAS_PANO[forma] });

    if (fase === "praticar") {
      api.registar({ controlo: false, acertou });
      if (acertou) {
        const seguidas = pratica.seguidas + 1;
        if (seguidas >= PRATICA_SEGUIDAS) setFase("rampas");
        setPratica({ ...pratica, seguidas });
      } else {
        const falhas = pratica.falhas + 1;
        if (falhas >= FALHAS_PARA_DICAS) setFase("dicas");
        setPratica({ seguidas: 0, falhas: falhas >= FALHAS_PARA_DICAS ? 0 : falhas });
      }
      novaApresentacao();
      return;
    }

    if (controlo) {
      api.registar({ controlo: true, acertou });
      setControlo(false);
      novaApresentacao();
      return;
    }

    if (!rampa) return;
    api.registar({ controlo: false, acertou });
    // No último degrau que cabe ao alto, com mais degraus por mostrar: pede para deitar.
    if (acertou && rampa.fase === "subir" && rampa.indice >= rampa.total - 1 && todos.length > rampa.total && aoAlto()) {
      setEsperaRodar(true);
      novaApresentacao();
      return;
    }
    const seguinte = responderRampa(rampa, acertou);
    if (seguinte.terminado) {
      // Os degraus que cabem são sempre o início de `todos`.
      const r = rampaEmDelta(seguinte, todos);
      rampas.current[sentido] = [...rampas.current[sentido], r];
      setUltima({ sentido, r });
      setRampa(niveis.length >= 2 ? iniciarRampa(niveis.length) : null);
    } else setRampa(seguinte);
    if (api.proximaEControlo()) setControlo(true);
    novaApresentacao();
  };

  if (fase === "dicas")
    return (
      <EcraPasso
        titulo={t("Visao.olhoMagicoDicasTitulo")}
        accao={
          <Button size="lg" onClick={() => setFase("praticar")}>
            {t("Visao.tentarDeNovo")}
          </Button>
        }
      >
        <div className="space-y-3 text-left text-sm">
          <p className="text-muted-foreground">{t("Visao.olhoMagicoDicasTexto")}</p>
          <ComoFazer modo={modo} />
        </div>
      </EcraPasso>
    );

  const delta = todos[indice] ?? todos[0];
  const ladoCss = QUADRO_PANO_MM * pxPorMm;
  const separacaoCss = separacaoMm(delta, distanciaMm) * pxPorMm;
  const alturaCss = Math.round(PONTOS_PX + ladoCss + 14);
  const centro = (larguraCss - 2) / 2;
  // Cruzar: o olho esquerdo olha para o quadro da direita.
  const [quadroEsq, quadroDir] = modo === "cruzar" ? [par.direito, par.esquerdo] : [par.esquerdo, par.direito];
  const naoCabe = larguraCss > 0 && niveis.length === 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-col items-center gap-1">
        <div role="radiogroup" aria-label={t("Visao.olhoMagicoModo")} className="flex flex-wrap justify-center gap-2">
          {MODOS.map((m) => (
            <Button
              key={m}
              role="radio"
              aria-checked={modo === m}
              size="sm"
              variant={modo === m ? "default" : "outline"}
              className={cn(modo === m && "bg-navy text-navy-foreground hover:bg-navy/90")}
              onClick={() => mudarModo(m)}
            >
              {m === "cruzar" ? t("Visao.olhoMagicoCruzar") : t("Visao.olhoMagicoRelaxar")}
            </Button>
          ))}
        </div>
        <p className="max-w-md text-center text-xs text-muted-foreground">{t("Visao.olhoMagicoNotaEsotropia")}</p>
      </div>

      {fase === "praticar" && (
        <details open className="w-full max-w-md rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <summary className="cursor-pointer font-semibold text-foreground">{t("Visao.olhoMagicoComoFazer")}</summary>
          <div className="mt-2">
            <ComoFazer modo={modo} />
          </div>
        </details>
      )}

      <p className="text-center text-sm text-muted-foreground" aria-live="polite">
        {esperaRodar || foraDoEcra
          ? t("Visao.olhoMagicoRodar")
          : fase === "praticar"
            ? t("Visao.olhoMagicoPraticar", { seguidas: pratica.seguidas, total: PRATICA_SEGUIDAS })
            : t("Visao.olhoMagicoInstrucao")}
      </p>

      <div ref={contentor} className="w-full">
        {naoCabe ? (
          <p className="rounded-lg bg-gold/10 px-3 py-2 text-center text-sm font-medium text-foreground">
            {t("Visao.olhoMagicoEcraEstreito")}
          </p>
        ) : (
          larguraCss > 0 && (
            <PalcoVisual className="min-h-0" rotulo={t("Visao.olhoMagicoRotuloPalco")}>
              <div className="relative w-full" style={{ height: alturaCss }}>
                {[centro - separacaoCss / 2, centro + separacaoCss / 2].map((c, i) => (
                  <span
                    key={`p${i}`}
                    className="absolute h-2.5 w-2.5 rounded-full"
                    style={{ left: c - 5, top: 8, backgroundColor: "#000000" }}
                  />
                ))}
                {[
                  [centro - separacaoCss / 2, quadroEsq],
                  [centro + separacaoCss / 2, quadroDir],
                ].map(([c, grelha], i) => (
                  <div key={`q${i}`} className="absolute" style={{ left: (c as number) - ladoCss / 2, top: PONTOS_PX }}>
                    <QuadroPano grelha={grelha as Uint8Array} ladoCss={ladoCss} dpr={dpr} />
                  </div>
                ))}
              </div>
            </PalcoVisual>
          )
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{t("Visao.olhoMagicoSeparacao", { delta: rotuloDelta(delta) })}</span>
        {aviso && (
          <span className={cn("font-medium", aviso.certo ? "text-teal" : "text-foreground")}>
            {aviso.certo
              ? t("Visao.olhoMagicoCerto", { forma: t(CHAVES_FORMA[aviso.forma]).toLowerCase() })
              : t("Visao.olhoMagicoEra", { forma: t(CHAVES_FORMA[aviso.forma]).toLowerCase() })}
          </span>
        )}
      </div>

      {(esperaRodar || foraDoEcra) && (
        <p className="flex items-center gap-2 rounded-lg bg-gold/10 px-3 py-2 text-sm font-medium text-foreground">
          <RotateCw className="h-4 w-4 shrink-0" aria-hidden />
          {t("Visao.olhoMagicoRodarDica")}
        </p>
      )}

      <div className="grid w-full max-w-lg grid-cols-5 gap-2">
        {FORMAS_PANO.map((f, i) => (
          <Button
            key={f}
            variant="outline"
            className="h-auto flex-col gap-1 px-1 py-2"
            disabled={naoCabe || larguraCss === 0 || esperaRodar || foraDoEcra}
            onClick={() => responder(i)}
          >
            <IconeFormaPano forma={f} />
            <span className="text-xs">{t(CHAVES_FORMA[f])}</span>
          </Button>
        ))}
        <Button
          variant="outline"
          className="h-auto flex-col gap-1 px-1 py-2"
          disabled={naoCabe || larguraCss === 0 || esperaRodar || foraDoEcra}
          onClick={() => responder(null)}
        >
          <span className="flex h-8 items-center text-xl font-bold" aria-hidden>
            ?
          </span>
          <span className="text-xs">{t("Visao.olhoMagicoNaoVejo")}</span>
        </Button>
      </div>

      {ultima && (
        <p className="text-center text-xs text-muted-foreground">
          {t("Visao.pontesUltima", { resultado: rotuloSentidoPontes(ultima.sentido, resumirRampas([ultima.r])) })}
        </p>
      )}
    </div>
  );
};

/** Os passos para juntar as imagens, em cada modo, com a opção de os ouvir. */
const ComoFazer = ({ modo }: { modo: ModoOlhoMagico }) => {
  const { t } = useTranslation();
  const passos = [1, 2, 3, 4].map((n) => t(`Visao.olhoMagico${modo === "cruzar" ? "Cruzar" : "Relaxar"}Passo${n}`));
  return (
    <div className="space-y-2">
      <ol className="list-decimal space-y-1 pl-5 text-left text-foreground">
        {passos.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ol>
      <BotaoOuvir texto={passos.join(" ")} />
    </div>
  );
};

const AvisoOlhoMagico = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-3 text-left text-sm">
      <p className="flex gap-2 rounded-lg border border-gold/60 bg-gold/10 p-3 text-foreground" role="note">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
        <span>{t("Visao.convergenciaAvisoParar")}</span>
      </p>
      <p className="flex gap-2 rounded-lg border border-gold/60 bg-gold/10 p-3 text-foreground" role="note">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
        <span>{t("Visao.olhoMagicoAvisoEstrabismo")}</span>
      </p>
      <p className="text-muted-foreground">{t("Visao.olhoMagicoExplicacao")}</p>
    </div>
  );
};

const lerOculos = (): ComOuSemOculos | null => {
  try {
    const v = window.localStorage.getItem(CHAVE_OCULOS);
    return v === "com" || v === "sem" ? v : null;
  } catch {
    return null;
  }
};

/**
 * Olho Mágico (id `convergence`): sem óculos, fusão livre com os quadros de
 * pano; com óculos 3D, as Pontes de Fusão. Mesma medida (Δ) e o mesmo
 * formato de sessão, por isso o relatório do médico lê as duas.
 */
const OlhoMagico = () => {
  const { t } = useTranslation();
  const [oculos, setOculos] = useState<ComOuSemOculos | null>(null);

  if (oculos === "com") return <PontesFusao />;

  if (oculos === "sem")
    return (
      <PaginaExercicio>
        <AssistenteTreino
          exercicioId={EXERCICIO_ID}
          grupo="premium"
          titulo={t("Visao.convergenciaTitulo")}
          descricao={t("Visao.convergenciaDescricao")}
          monocular={false}
          comDistancia
          aviso={<AvisoOlhoMagico />}
          tarefa={(api, ctx, resultado) => <TarefaOlhoMagico api={api} ctx={ctx} resultado={resultado} />}
        />
      </PaginaExercicio>
    );

  return (
    <PaginaExercicio>
      <BaseExercise
        title={t("Visao.convergenciaTitulo")}
        description={t("Visao.convergenciaDescricao")}
        exercicioId={EXERCICIO_ID}
        grupo="premium"
        tipo="treino"
      >
        <EscolherOculos
          titulo={t("Visao.olhoMagicoOculosTitulo")}
          sem={{ titulo: t("Visao.olhoMagicoSemOculos"), texto: t("Visao.olhoMagicoSemOculosTexto") }}
          com={{ titulo: t("Visao.olhoMagicoComOculos"), texto: t("Visao.olhoMagicoComOculosTexto") }}
          inicial={lerOculos()}
          aoEscolher={(o) => {
            try {
              window.localStorage.setItem(CHAVE_OCULOS, o);
            } catch {
              // armazenamento bloqueado: pergunta-se outra vez
            }
            setOculos(o);
          }}
        />
      </BaseExercise>
    </PaginaExercicio>
  );
};

export default OlhoMagico;
