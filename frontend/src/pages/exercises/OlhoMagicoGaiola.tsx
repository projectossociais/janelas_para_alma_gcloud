import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { ApiTarefa, ContextoTreino, ResultadoTreino } from "@/components/visao/AssistenteTreino";
import PalcoVisual from "@/components/visao/PalcoVisual";
import { useLarguraDe } from "@/components/visao/hooks";
import { rotuloDelta, rotuloRoturaRecuperacao } from "@/components/visao/rotulos";
import {
  CARTAO_GAIOLA_MM,
  DIAS_PARA_PANO,
  MODO_GAIOLA,
  RESPOSTAS_GAIOLA,
  diasSeguidosAPrimeira,
  fusaoDaSessao,
  guardarNivelOlhoMagico,
  juntou,
  niveisOlhoMagico,
  niveisQueCabem,
  responderGaiola,
  type RespostaGaiola,
} from "@/lib/visao/olhoMagico";
import { iniciarRampa, rampaEmDelta, resumirRampas, separacaoMm, type EstadoRampa, type RampaEmDelta } from "@/lib/visao/pontes";
import { cn } from "@/lib/utils";

/** Altura do espaço para os dois pontos de referência, por cima dos cartões. */
const PONTOS_PX = 28;

/** O cartão do pássaro (com o sol, que só este olho vê). viewBox 100. */
export const Passaro = ({ semSol = false }: { semSol?: boolean }) => (
  <>
    {!semSol && (
      <>
        <circle cx={16} cy={16} r={9} fill="#e3a21a" />
        <path d="M16 1v4M16 27v4M1 16h4M27 16h4M5 5l3 3M24 24l3 3M5 27l3-3M24 8l3-3" stroke="#e3a21a" strokeWidth={2.5} strokeLinecap="round" />
      </>
    )}
    <ellipse cx={50} cy={64} rx={17} ry={13} fill="#b8322a" />
    <circle cx={61} cy={52} r={9} fill="#b8322a" />
    <circle cx={64} cy={50} r={2.4} fill="#ffffff" />
    <circle cx={64.6} cy={50} r={1.2} fill="#111111" />
    <path d="M69 52 L78 55 L69 57 Z" fill="#e3a21a" />
    <path d="M36 62 L24 56 L27 68 Z" fill="#8f2620" />
    <path d="M44 62 Q52 54 58 64 Q50 70 44 62 Z" fill="#8f2620" />
    <path d="M46 76 v6 M54 76 v6" stroke="#5e3b12" strokeWidth={2.5} strokeLinecap="round" />
  </>
);

/** O cartão da gaiola (com a nuvem, que só o outro olho vê). viewBox 100. */
export const Gaiola = () => (
  <>
    <g fill="#9fb6cc" stroke="#4f6b85" strokeWidth={2}>
      <circle cx={78} cy={15} r={7} />
      <circle cx={88} cy={17} r={6} />
      <circle cx={70} cy={18} r={5} />
      <rect x={70} y={17} width={20} height={7} rx={3.5} />
    </g>
    <g fill="none" stroke="#2a5c8a" strokeWidth={3} strokeLinecap="round">
      <circle cx={50} cy={12} r={4} />
      <path d="M22 88 V46 Q22 20 50 18 Q78 20 78 46 V88" />
      <path d="M36 88 V30 M50 88 V18 M64 88 V30" />
      <path d="M16 88 H84" />
      <path d="M22 50 H78" />
    </g>
  </>
);

/** Um desenho (pássaro ou gaiola) numa posição de um SVG maior. */
const Desenho = ({ x, y, lado, opacidade = 1, children }: { x: number; y: number; lado: number; opacidade?: number; children: ReactNode }) => (
  // Tamanho também em `style`: dentro de um botão, `[&_svg]` do Button sobrepunha-se aos atributos.
  <svg x={x} y={y} width={lado} height={lado} style={{ width: lado, height: lado }} viewBox="0 0 100 100" opacity={opacidade}>
    {children}
  </svg>
);

/**
 * A animação do dedo-guia: vista de cima (os olhos, o dedo e as linhas do
 * olhar a cruzarem na ponta do dedo) e, por baixo, o que se vê -- os dois
 * desenhos passam a três, com o pássaro na gaiola no meio. As posições do
 * que se vê saem da geometria: cada olho vê os dois cartões, centrados onde
 * está a olhar.
 */
export const DemoDedoGuia = () => {
  const { t } = useTranslation();
  const [k, setK] = useState(1);

  const olhoE = 138;
  const olhoD = 162;
  const olhosY = 160;
  const ecraY = 38;
  const cartaoE = 119;
  const cartaoD = 181;
  // Onde as linhas se cruzam e caem nos centros dos cartões.
  const yFusao = olhosY - ((olhosY - ecraY) * 12) / (cartaoD - 150 + 12);
  const yDedo = 50 + (yFusao - 50) * k;
  const acerta = (ox: number) => ox + ((150 - ox) * (olhosY - ecraY)) / (olhosY - yDedo);
  const [hE, hD] = [acerta(olhoE), acerta(olhoD)];

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let ultimo = 0;
    const suave = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
    const animar = (tempo: number) => {
      raf = requestAnimationFrame(animar);
      if (tempo - ultimo < 33) return;
      ultimo = tempo;
      const f = (tempo % 7000) / 7000;
      setK(f < 0.15 ? 0 : f < 0.55 ? suave((f - 0.15) / 0.4) : f < 0.92 ? 1 : 1 - suave((f - 0.92) / 0.08));
    };
    raf = requestAnimationFrame(animar);
    return () => cancelAnimationFrame(raf);
  }, []);

  const juntou = k > 0.98;
  const escala = 1.35;
  const lado = 44;
  return (
    <svg viewBox="0 0 300 300" className="block h-auto w-full rounded-xl" style={{ backgroundColor: "#f6f1e4" }} role="img" aria-label={t("Visao.gaiolaDemoRotulo")}>
      <text x={10} y={18} fontSize={11} fontWeight={700} fill="#5e5b53">
        {t("Visao.gaiolaDemoCima")}
      </text>
      <rect x={60} y={30} width={180} height={8} rx={3} fill="#22201c" />
      <Desenho x={104} y={40} lado={30}>
        <Passaro />
      </Desenho>
      <Desenho x={166} y={40} lado={30}>
        <Gaiola />
      </Desenho>
      <line x1={olhoE} y1={olhosY} x2={hE} y2={ecraY} stroke="#0b7782" strokeWidth={2} strokeDasharray="4 3" />
      <line x1={olhoD} y1={olhosY} x2={hD} y2={ecraY} stroke="#c4450c" strokeWidth={2} strokeDasharray="4 3" />
      <g transform={`translate(150 ${yDedo})`}>
        <rect x={-6} y={-2} width={12} height={30} rx={6} fill="#c98f5f" />
        <rect x={-4} y={0} width={8} height={7} rx={3} fill="#e9c3a0" />
      </g>
      {[
        [olhoE, "#0b7782"],
        [olhoD, "#c4450c"],
      ].map(([x, cor]) => (
        <g key={x}>
          <ellipse cx={x} cy={olhosY} rx={9} ry={6} fill="#ffffff" stroke="#22201c" strokeWidth={2} />
          <circle cx={x} cy={olhosY} r={3} fill={cor as string} />
        </g>
      ))}
      <line x1={10} y1={184} x2={290} y2={184} stroke="#e2dccb" />
      <text x={10} y={202} fontSize={11} fontWeight={700} fill="#5e5b53">
        {t("Visao.gaiolaDemoVe")}
      </text>
      {[hE, hD].flatMap((h, i) =>
        [
          [cartaoE, "p"],
          [cartaoD, "g"],
        ].map(([c, qual]) => (
          <Desenho key={`${i}${qual}`} x={150 + ((c as number) - h) * escala - lado / 2} y={244 - lado / 2} lado={lado} opacidade={0.62}>
            {qual === "p" ? <Passaro /> : <Gaiola />}
          </Desenho>
        )),
      )}
      <text x={150} y={292} textAnchor="middle" fontSize={13} fontWeight={700} fill={juntou ? "#2f7d4f" : "#1c1b18"}>
        {juntou ? t("Visao.gaiolaDemoJuntou") : k < 0.02 ? t("Visao.gaiolaDemoOlhar") : t("Visao.gaiolaDemoAproximar")}
      </text>
    </svg>
  );
};

/** O desenho de cada resposta "o que vê no meio?". */
const MiniResposta = ({ r }: { r: RespostaGaiola }) => {
  const L = 26;
  return (
    <svg viewBox="0 0 84 46" className="shrink-0" style={{ width: 100, height: 55 }} aria-hidden>
      {r === "dentro" || r === "falta" ? (
        <>
          <Desenho x={2} y={10} lado={L} opacidade={0.4}>
            <Passaro />
          </Desenho>
          <Desenho x={29} y={10} lado={L}>
            <Passaro semSol={r === "falta"} />
            <Gaiola />
          </Desenho>
          <Desenho x={56} y={10} lado={L} opacidade={0.4}>
            <Gaiola />
          </Desenho>
        </>
      ) : r === "dois" ? (
        <>
          <Desenho x={12} y={10} lado={L}>
            <Passaro />
          </Desenho>
          <Desenho x={46} y={10} lado={L}>
            <Gaiola />
          </Desenho>
        </>
      ) : (
        [0, 18, 36, 56].map((x, i) => (
          <Desenho key={x} x={x} y={10} lado={L} opacidade={0.7}>
            {i % 2 ? <Gaiola /> : <Passaro />}
          </Desenho>
        ))
      )}
    </svg>
  );
};

type Etapa = "como" | "tentar" | "dica" | "rampa" | "fim";

/**
 * Olho Mágico, nível do pássaro e da gaiola (versão 2): aprender a cruzar os
 * olhos com o dedo como guia; dizer o que se vê no meio (por desenhos); e,
 * já com o pássaro na gaiola, afastar os cartões até sair (rotura) e
 * aproximá-los até voltar a entrar (recuperação), em Δ. Ver
 * `lib/visao/olhoMagico.ts`.
 */
export const TarefaGaiola = ({
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
  const { pxPorMm, distanciaMm } = ctx;

  const todos = useMemo(() => niveisOlhoMagico("convergencia", distanciaMm, CARTAO_GAIOLA_MM), [distanciaMm]);
  const niveis = useMemo(
    () => (larguraCss > 0 ? niveisQueCabem(todos, distanciaMm, larguraCss / pxPorMm, CARTAO_GAIOLA_MM) : []),
    [distanciaMm, larguraCss, pxPorMm, todos],
  );

  const [etapa, setEtapa] = useState<Etapa>("como");
  const [respostas, setRespostas] = useState<RespostaGaiola[]>([]);
  const [rampa, setRampa] = useState<EstadoRampa | null>(null);
  const rampas = useRef<RampaEmDelta[]>([]);
  const [ultima, setUltima] = useState<RampaEmDelta | null>(null);

  const aPrimeira = respostas[0] === "dentro";
  const dias = diasSeguidosAPrimeira(ctx.historico, new Date(), aPrimeira);
  const pronto = dias >= DIAS_PARA_PANO;
  // Chegou aos dias seguidos: a próxima sessão começa nos quadros de pano.
  useEffect(() => {
    if (pronto && aPrimeira) guardarNivelOlhoMagico("pano");
  }, [aPrimeira, pronto]);

  resultado.current = () => {
    const r = resumirRampas(rampas.current);
    return {
      limiar: null,
      resumo: r.rampas ? t("Visao.gaiolaLimiarCurto", { valores: rotuloRoturaRecuperacao(r) }) : t("Visao.gaiolaSemRampa"),
      sinais: {
        modo: MODO_GAIOLA,
        versao: 2,
        modo_fusao: "cruzar",
        fusao: fusaoDaSessao(respostas),
        a_primeira: aPrimeira,
        respostas: Object.fromEntries(RESPOSTAS_GAIOLA.map((x) => [x, respostas.filter((y) => y === x).length])),
        gaiola: r,
        cartao_mm: CARTAO_GAIOLA_MM,
      },
    };
  };

  const naoCabe = larguraCss > 0 && niveis.length < 2;

  const responderTentativa = (r: RespostaGaiola) => {
    if (!api.activo) return;
    api.registar({ controlo: false, acertou: juntou(r) });
    setRespostas((rs) => [...rs, r]);
    if (r === "dentro") comecarRampa();
    else setEtapa("dica");
  };

  function comecarRampa() {
    if (niveis.length < 2) return;
    setRampa(iniciarRampa(niveis.length));
    setEtapa("rampa");
  }

  const responderRampa = (dentro: boolean) => {
    if (!api.activo || !rampa) return;
    api.registar({ controlo: false, acertou: dentro });
    const seguinte = responderGaiola(rampa, dentro);
    if (seguinte.terminado) {
      const r = rampaEmDelta(seguinte, todos);
      rampas.current = [...rampas.current, r];
      setUltima(r);
      setRampa(null);
      setEtapa("fim");
    } else setRampa(seguinte);
  };

  // O palco: os dois cartões, à separação do degrau, com dois pontos por cima.
  const palco = (indice: number) => {
    if (naoCabe)
      return <p className="rounded-lg bg-gold/10 px-3 py-2 text-center text-sm font-medium text-foreground">{t("Visao.olhoMagicoEcraEstreito")}</p>;
    if (!larguraCss) return null;
    const delta = niveis[Math.min(indice, niveis.length - 1)];
    const ladoCss = CARTAO_GAIOLA_MM * pxPorMm;
    const separacaoCss = separacaoMm(delta, distanciaMm) * pxPorMm;
    const centro = (larguraCss - 2) / 2;
    return (
      <PalcoVisual className="min-h-0" rotulo={t("Visao.gaiolaRotuloPalco")}>
        <div className="relative w-full" style={{ height: Math.round(PONTOS_PX + ladoCss + 14) }}>
          {[centro - separacaoCss / 2, centro + separacaoCss / 2].map((c, i) => (
            <span key={`p${i}`} className="absolute h-2.5 w-2.5 rounded-full" style={{ left: c - 5, top: 8, backgroundColor: "#000000" }} />
          ))}
          {[centro - separacaoCss / 2, centro + separacaoCss / 2].map((c, i) => (
            <svg
              key={`c${i}`}
              viewBox="0 0 100 100"
              className="absolute"
              style={{ left: c - ladoCss / 2, top: PONTOS_PX, width: ladoCss, height: ladoCss }}
              aria-hidden
            >
              {i ? <Gaiola /> : <Passaro />}
            </svg>
          ))}
          <span className="absolute bottom-1 right-2 text-xs tabular-nums" style={{ color: "#5e5b53" }}>
            {rotuloDelta(delta)}
          </span>
        </div>
      </PalcoVisual>
    );
  };

  let conteudo: ReactNode;
  if (etapa === "como")
    conteudo = (
      <div className="flex flex-col gap-4">
        <p className="text-lg font-bold text-foreground">{t("Visao.gaiolaComoTitulo")}</p>
        <div className="mx-auto w-full max-w-sm">
          <DemoDedoGuia />
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-left text-foreground">
          {[1, 2, 3].map((n) => (
            <li key={n}>{t(`Visao.gaiolaComo${n}`)}</li>
          ))}
        </ol>
        <Button size="lg" onClick={() => setEtapa("tentar")}>
          {t("Visao.gaiolaExperimentar")}
        </Button>
      </div>
    );
  else if (etapa === "tentar")
    conteudo = (
      <div className="flex flex-col gap-3">
        {palco(0)}
        <p className="text-foreground">
          {t("Visao.gaiolaJunte")} <b>{t("Visao.gaiolaQueVe")}</b>
        </p>
        <div className="grid gap-2">
          {RESPOSTAS_GAIOLA.map((r) => (
            <Button
              key={r}
              variant="outline"
              className="h-auto justify-start gap-3 whitespace-normal py-2 text-left"
              disabled={naoCabe || !larguraCss}
              onClick={() => responderTentativa(r)}
            >
              <MiniResposta r={r} />
              <span className="font-semibold">{t(`Visao.gaiolaResposta_${r}`)}</span>
            </Button>
          ))}
        </div>
        <Button variant="ghost" onClick={() => setEtapa("como")}>
          {t("Visao.gaiolaVerAnimacao")}
        </Button>
      </div>
    );
  else if (etapa === "dica") {
    const r = respostas[respostas.length - 1];
    conteudo = (
      <div className="flex flex-col gap-4">
        <div className="space-y-1 rounded-xl border border-gold/60 bg-gold/10 p-4 text-left">
          <p className="text-lg font-bold text-foreground">{t(`Visao.gaiolaDicaTitulo_${r}`)}</p>
          <p className="text-sm text-foreground">{t(`Visao.gaiolaDica_${r}`)}</p>
        </div>
        <div className="mx-auto w-full max-w-sm">
          <DemoDedoGuia />
        </div>
        {r === "falta" && (
          <Button size="lg" onClick={comecarRampa}>
            {t("Visao.gaiolaContinuarAssim")}
          </Button>
        )}
        <Button size="lg" variant={r === "falta" ? "outline" : "default"} onClick={() => setEtapa("tentar")}>
          {t("Visao.tentarDeNovo")}
        </Button>
      </div>
    );
  } else if (etapa === "rampa" && rampa) {
    const afastar = rampa.fase === "subir";
    conteudo = (
      <div className="flex flex-col gap-3">
        <p className="text-lg font-bold text-foreground">{afastar ? t("Visao.gaiolaAfastarTitulo") : t("Visao.gaiolaAproximarTitulo")}</p>
        <p className="text-sm text-foreground">{afastar ? t("Visao.gaiolaAfastarTexto") : t("Visao.gaiolaAproximarTexto")}</p>
        {palco(rampa.indice)}
        <p className="text-center text-xs text-muted-foreground">{t("Visao.gaiolaDegrau", { n: rampa.indice + 1, total: rampa.total })}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" className="h-auto whitespace-normal bg-green py-4 text-green-foreground hover:bg-green/90" onClick={() => responderRampa(true)}>
            {afastar ? t("Visao.gaiolaContinuaDentro") : t("Visao.gaiolaVoltou")}
          </Button>
          <Button
            size="lg"
            variant={afastar ? "destructive" : "outline"}
            className="h-auto whitespace-normal py-4"
            onClick={() => responderRampa(false)}
          >
            {afastar ? t("Visao.gaiolaSaiu") : t("Visao.gaiolaAindaFora")}
          </Button>
        </div>
      </div>
    );
  } else {
    const r = ultima;
    const supressao = respostas.includes("falta");
    conteudo = (
      <div className="flex flex-col gap-3 text-left">
        {r && (
          <div className={cn("space-y-1 rounded-xl border p-4", supressao ? "border-gold/60 bg-gold/10" : "border-teal/40 bg-teal/10")}>
            <p className="text-lg font-bold text-foreground">
              {r.rotura === null ? t("Visao.gaiolaAteAoFim") : t("Visao.gaiolaSaiuA", { delta: rotuloDelta(r.rotura) })}
            </p>
            <p className="text-sm text-foreground">{supressao ? t("Visao.gaiolaComSupressao") : t("Visao.gaiolaSemSupressao")}</p>
          </div>
        )}
        {r && (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {r.rotura === null ? t("Visao.pontesAcimaDe", { delta: rotuloDelta(r.maximo) }) : rotuloDelta(r.rotura)}
              </p>
              <p className="text-xs text-muted-foreground">{t("Visao.gaiolaRotura")}</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-2xl font-bold tabular-nums text-foreground">{r.recuperacao === null ? "—" : rotuloDelta(r.recuperacao)}</p>
              <p className="text-xs text-muted-foreground">{t("Visao.gaiolaRecuperacao")}</p>
            </div>
          </div>
        )}
        <p className="text-sm text-muted-foreground">{t(r?.limiteEcra ? "Visao.gaiolaRodarParaMais" : "Visao.gaiolaTreinar")}</p>
        <p className="rounded-xl border border-dashed border-border p-3 text-sm text-foreground">
          {pronto ? t("Visao.gaiolaPanoPronto") : t("Visao.gaiolaPanoDepois", { n: DIAS_PARA_PANO, feitos: dias })}
        </p>
        <Button size="lg" onClick={() => setEtapa("tentar")}>
          {t("Visao.gaiolaOutraVez")}
        </Button>
      </div>
    );
  }

  return (
    <div ref={contentor} className="w-full">
      {conteudo}
    </div>
  );
};
