import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import type { ApiTarefa, ContextoTreino, ResultadoTreino } from "@/components/visao/AssistenteTreino";
import { formatarDecimal } from "@/i18n/formatar";
import { MOTIVOS, amostrarTraco, motivoFeito, nivelSamakaka, pontoDoTraco, resumirSamakaka } from "@/lib/visao/samakaka";
import { sinalSonoro } from "@/lib/visao/voz";

// O pano é sempre claro, em tema claro e escuro: o contraste dos pontinhos faz parte do treino.
const FUNDO = "#fbf7ef";
const LADO_MAX_PX = 520;
/** Espaço entre pontos do traço, para seguir o dedo. */
const PASSO_TRACO_MM = 1.2;
/** De quanto em quanto tempo o traço seguido conta como resposta (tempo activo). */
const REGISTO_MS = 1000;

/** Um motivo acabado, pequeno, para o pano que vai crescendo por baixo. */
const MotivoPintado = ({ i }: { i: number }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext("2d");
    if (!g) return;
    const m = MOTIVOS[i % MOTIVOS.length];
    g.fillStyle = FUNDO;
    g.fillRect(0, 0, 96, 96);
    g.strokeStyle = m.cor;
    g.lineWidth = 6;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    m.pontos().forEach(([x, y], k) => (k ? g.lineTo(8 + x * 80, 8 + y * 80) : g.moveTo(8 + x * 80, 8 + y * 80)));
    g.stroke();
  }, [i]);
  return <canvas ref={ref} width={96} height={96} className="h-12 w-12 rounded-md" aria-hidden />;
};

/**
 * Pintar o Samakaka (tarefa do AssistenteTreino, com tapa-olho). Desenha só
 * quando o dedo mexe ou o motivo muda: não há animação contínua.
 */
const PintarSamakaka = ({
  api,
  ctx,
  resultado,
}: {
  api: ApiTarefa;
  ctx: ContextoTreino;
  resultado: MutableRefObject<(() => ResultadoTreino) | null>;
}) => {
  const { t } = useTranslation();
  const raiz = useRef<HTMLDivElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const [lado, setLado] = useState(0);
  const [feitos, setFeitos] = useState<number[]>([]);
  // O motivo em curso também em estado: o canvas redesenha-se sozinho, mas o texto da instrução precisa de um render.
  const [motivoI, setMotivoI] = useState(0);
  const [fora, setFora] = useState(false);
  const estado = useRef({ i: 0, traco: [] as [number, number][], k: 0, desvios: [] as number[], movimentos: 0, fora: 0, aDesenhar: false, ultimoRegisto: 0, aMudar: false });
  const apiRef = useRef(api);
  apiRef.current = api;
  const { pxPorMm } = ctx;

  useEffect(() => {
    const medir = () => setLado(Math.min(LADO_MAX_PX, caixa.current?.clientWidth ?? 0));
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  resultado.current = () => {
    const e = estado.current;
    const r = resumirSamakaka(e.desvios, e.movimentos, e.fora, feitos.length);
    return {
      limiar: r.mediaMm,
      unidade: "mm",
      resumo:
        r.mediaMm === null
          ? t("Visao.samakakaSemLimiar")
          : t("Visao.samakakaResumo", { motivos: r.motivos, mm: formatarDecimal(r.mediaMm, 1), pct: r.dentroPct ?? 0 }),
      sinais: { modo: "samakaka", motivos: r.motivos, dentro_pct: r.dentroPct, ponto_mais_fino_mm: r.maisFinoMm },
    };
  };

  const desenhar = useCallback(
    (dedo?: [number, number]) => {
      const cv = tela.current;
      const g = cv?.getContext("2d");
      const e = estado.current;
      if (!cv || !g || lado < 1 || !e.traco.length) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(lado * dpr)) {
        cv.width = Math.round(lado * dpr);
        cv.height = Math.round(lado * dpr);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = FUNDO;
      g.fillRect(0, 0, lado, lado);
      const n = nivelSamakaka(e.i);
      const cinza = Math.round(255 * (1 - n.contraste));
      g.fillStyle = `rgb(${cinza},${cinza},${cinza})`;
      const raio = (n.pontoMm * pxPorMm) / 2;
      const salto = Math.max(1, Math.round((n.pontoMm * 2.2) / PASSO_TRACO_MM));
      for (let j = 0; j < e.traco.length; j += salto) {
        g.beginPath();
        g.arc(e.traco[j][0], e.traco[j][1], raio, 0, Math.PI * 2);
        g.fill();
      }
      if (e.k > 0) {
        g.strokeStyle = MOTIVOS[e.i % MOTIVOS.length].cor;
        g.lineWidth = Math.max(4, raio * 3.2);
        g.lineCap = "round";
        g.lineJoin = "round";
        g.beginPath();
        e.traco.slice(0, e.k + 1).forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.stroke();
      }
      const [px, py] = e.traco[e.k];
      g.fillStyle = "rgba(163,22,142,0.25)";
      g.beginPath();
      g.arc(px, py, Math.max(14, raio * 5), 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#a3168e";
      g.beginPath();
      g.arc(px, py, Math.max(6, raio * 2), 0, Math.PI * 2);
      g.fill();
      if (dedo) {
        g.strokeStyle = e.fora > 0 && fora ? "rgba(192,57,43,0.8)" : "rgba(0,0,0,0.25)";
        g.lineWidth = 2;
        g.beginPath();
        g.arc(dedo[0], dedo[1], 16, 0, Math.PI * 2);
        g.stroke();
      }
    },
    [fora, lado, pxPorMm],
  );

  const prepararMotivo = useCallback(() => {
    const e = estado.current;
    const m = MOTIVOS[e.i % MOTIVOS.length];
    e.traco = amostrarTraco(
      m.pontos().map(([x, y]) => [x * lado, y * lado] as const),
      PASSO_TRACO_MM * pxPorMm,
    );
    e.k = 0;
    e.aMudar = false;
    desenhar();
  }, [desenhar, lado, pxPorMm]);

  useEffect(() => {
    if (lado > 0) prepararMotivo();
    // Só quando o tamanho muda; os motivos seguintes preparam-se ao acabar o anterior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lado]);

  // No telemóvel o pano começa abaixo da dobra: traz o palco para o centro do ecrã, uma vez.
  const centrado = useRef(false);
  useEffect(() => {
    if (lado < 1 || centrado.current) return;
    centrado.current = true;
    raiz.current?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }, [lado]);

  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = estado.current;
    if (!s.aDesenhar || s.aMudar || !apiRef.current.activo || !s.traco.length) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const { indice, distancia } = pontoDoTraco(s.traco, s.k, x, y);
    const distanciaMm = distancia / pxPorMm;
    s.movimentos += 1;
    if (distanciaMm <= nivelSamakaka(s.i).folgaMm) {
      s.desvios.push(distanciaMm);
      setFora(false);
      if (indice > s.k) s.k = indice;
      const agora = performance.now();
      if (agora - s.ultimoRegisto > REGISTO_MS) {
        s.ultimoRegisto = agora;
        apiRef.current.registar({ controlo: false, acertou: true });
      }
      if (motivoFeito(s.traco, s.k)) {
        s.aMudar = true;
        s.aDesenhar = false;
        sinalSonoro("certo");
        apiRef.current.registar({ controlo: false, acertou: true });
        setFeitos((f) => [...f, s.i]);
        desenhar();
        window.setTimeout(() => {
          s.i += 1;
          setMotivoI(s.i);
          prepararMotivo();
        }, 700);
        return;
      }
    } else {
      s.fora += 1;
      setFora(true);
    }
    desenhar([x, y]);
  };

  const motivo = MOTIVOS[motivoI % MOTIVOS.length];
  return (
    <div ref={raiz} className="flex flex-col items-center gap-3">
      <p className="text-center text-sm text-muted-foreground" aria-live="polite">
        {fora ? t("Visao.samakakaFora") : t("Visao.samakakaInstrucao", { motivo: t(`Visao.samakakaMotivo_${motivo.id}`) })}
      </p>
      <div ref={caixa} className="flex w-full justify-center">
        {lado > 0 && (
          <canvas
            ref={tela}
            role="application"
            aria-label={t("Visao.samakakaRotuloPalco")}
            className="block touch-none rounded-xl"
            style={{ width: lado, height: lado }}
            onPointerDown={(e) => {
              estado.current.aDesenhar = true;
              e.currentTarget.setPointerCapture?.(e.pointerId);
              mover(e);
            }}
            onPointerMove={mover}
            onPointerUp={() => {
              estado.current.aDesenhar = false;
              desenhar();
            }}
          />
        )}
      </div>
      {feitos.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1" aria-label={t("Visao.samakakaPano", { n: feitos.length })}>
          {feitos.map((i, k) => (
            <MotivoPintado key={k} i={i} />
          ))}
        </div>
      )}
    </div>
  );
};

export default PintarSamakaka;
