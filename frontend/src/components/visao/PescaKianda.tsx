import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import type { ApiTarefa, ContextoTreino, ResultadoTreino } from "@/components/visao/AssistenteTreino";
import {
  FRACCAO_CERTOS_PESCA,
  NIVEIS_PESCA,
  caixaTocada,
  iniciarPesca,
  limiarPesca,
  orientacaoDoPeixe,
  precisaoPesca,
  registarPesca,
  type EstadoPesca,
  type EventoPesca,
} from "@/lib/visao/pescaKianda";

// O mar é sempre o mesmo, em tema claro e escuro: as cores fazem parte do jogo.
type Rgb = readonly [number, number, number];
const CORES_PEIXE: readonly Rgb[] = [
  [244, 178, 35],
  [236, 112, 63],
  [64, 184, 168],
  [233, 99, 140],
  [130, 160, 230],
];
const DOURADO: Rgb = [250, 196, 40];
const ALTURA_MIN_PX = 300;
const ALTURA_MAX_PX = 560;
/** Espaço que fica para o resto da página (cabeçalho, sinal, contadores). */
const RESERVA_PX = 330;
const REDE_PRESA_S = 1.5;
const INTERVALO_ALFORRECA_S = 7;
const RAIO_ALFORRECA_MM = 3.2;
const FOLGA_TOQUE_MM = 2.5;
const PASSO_TECLADO_MM = 5;
/** O peixe dourado de controlo é maior e tem as riscas bem marcadas. */
const ESCALA_CONTROLO = 1.25;

interface Peixe {
  x: number;
  y0: number;
  fase: number;
  vx: number;
  largura: number;
  altura: number;
  certo: boolean;
  controlo: boolean;
  /** "nada" a nadar; "apanhado" a ir para o cesto; "foge" depois de um engano; "sai" mudou o sinal. */
  estado: "nada" | "apanhado" | "foge" | "sai";
  t: number;
  sprite: HTMLCanvasElement;
}

interface Alforreca {
  x: number;
  y: number;
  fase: number;
}

interface Efeito {
  x: number;
  y: number;
  idade: number;
  texto?: string;
  cor?: string;
  presa?: boolean;
}

/** Riscas sinusoidais dentro do que já está pintado (alfa > 0), em coordenadas do ecrã. */
function riscar(g: CanvasRenderingContext2D, w: number, h: number, ori: number, periodoPx: number, contraste: number, base: Rgb) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const th = (ori * Math.PI) / 180;
  const s = Math.sin(th);
  const c = Math.cos(th);
  const k = (2 * Math.PI) / periodoPx;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] === 0) continue;
      const v = Math.sin((-x * s + y * c) * k) * contraste;
      for (let j = 0; j < 3; j++) d[i + j] = v > 0 ? base[j] + (255 - base[j]) * v * 0.75 : base[j] * (1 + v * 0.75);
    }
  }
  g.putImageData(img, 0, 0);
}

function corpo(g: CanvasRenderingContext2D, w: number, h: number) {
  g.beginPath();
  g.ellipse(w * 0.58, h * 0.5, w * 0.4, h * 0.44, 0, 0, Math.PI * 2);
  g.moveTo(w * 0.24, h * 0.5);
  g.lineTo(w * 0.02, h * 0.1);
  g.lineTo(w * 0.02, h * 0.9);
  g.closePath();
}

/** Peixe com escamas em riscas; as riscas ficam com a inclinação pedida mesmo com o peixe virado. */
function spritePeixe(L: number, H: number, ori: number, periodoPx: number, contraste: number, cor: Rgb, paraEsquerda: boolean, dpr: number, controlo: boolean) {
  const w = Math.max(2, Math.ceil(L * dpr));
  const h = Math.max(2, Math.ceil(H * dpr));
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const g = cv.getContext("2d", { willReadFrequently: true });
  if (!g) return cv;
  const espelhar = () => {
    if (paraEsquerda) {
      g.translate(w, 0);
      g.scale(-1, 1);
    }
  };
  g.save();
  espelhar();
  corpo(g, w, h);
  g.fillStyle = "#000";
  g.fill();
  g.restore();
  riscar(g, w, h, ori, periodoPx * dpr, contraste, cor);
  g.save();
  espelhar();
  g.lineWidth = (controlo ? 3 : 1.6) * dpr;
  g.strokeStyle = controlo ? "rgb(255,250,215)" : `rgb(${cor.map((v) => Math.round(v * 0.45)).join(",")})`;
  g.beginPath();
  g.ellipse(w * 0.58, h * 0.5, w * 0.4, h * 0.44, 0, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = "#fff";
  g.beginPath();
  g.arc(w * 0.83, h * 0.4, h * 0.11, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#111";
  g.beginPath();
  g.arc(w * 0.85, h * 0.4, h * 0.06, 0, Math.PI * 2);
  g.fill();
  g.restore();
  return cv;
}

/** O mar da Ilha: degradê, raios de luz e areia. Pinta-se uma vez por tamanho. */
function pintarFundo(w: number, h: number, dpr: number) {
  const cv = document.createElement("canvas");
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  const g = cv.getContext("2d");
  if (!g) return cv;
  g.scale(dpr, dpr);
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#8ad6e3");
  grad.addColorStop(0.35, "#2f9fbe");
  grad.addColorStop(1, "#0c4a6c");
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.globalAlpha = 0.09;
  g.fillStyle = "#fff";
  for (let i = 0; i < 5; i++) {
    const x = (w / 5) * i + 20;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + 40, 0);
    g.lineTo(x - 60 + i * 10, h);
    g.lineTo(x - 110 + i * 10, h);
    g.closePath();
    g.fill();
  }
  g.globalAlpha = 1;
  const areia = h - 34;
  g.fillStyle = "#d9b77a";
  g.beginPath();
  g.moveTo(0, areia);
  for (let x = 0; x <= w; x += 20) g.quadraticCurveTo(x + 10, areia - 5, x + 20, areia);
  g.lineTo(w, h);
  g.lineTo(0, h);
  g.closePath();
  g.fill();
  return cv;
}

/** O sinal da Kianda: um círculo com as riscas do peixe certo. */
const Sinal = ({ alvo, nivel }: { alvo: number; nivel: number }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const g = cv?.getContext("2d", { willReadFrequently: true });
    if (!cv || !g) return;
    const { periodoMm, contraste } = NIVEIS_PESCA[nivel - 1];
    g.clearRect(0, 0, cv.width, cv.height);
    g.beginPath();
    g.arc(cv.width / 2, cv.height / 2, cv.width / 2, 0, Math.PI * 2);
    g.fillStyle = "#000";
    g.fill();
    // O sinal tem sempre riscas bem visíveis: é a referência, não o teste.
    riscar(g, cv.width, cv.height, alvo, (cv.width / 10) * (periodoMm / 1.7), Math.max(0.6, contraste), [150, 150, 150]);
  }, [alvo, nivel]);
  return <canvas ref={ref} width={112} height={112} className="h-14 w-14 shrink-0 rounded-full border-[3px] border-teal" aria-hidden />;
};

/**
 * Kianda com tapa-olho (modo principal, sem óculos 3D). Ver
 * `lib/visao/pescaKianda.ts` para a lógica; aqui fica o desenho, o tempo e os
 * toques. Um só requestAnimationFrame; o relógio do jogo só anda dentro dos
 * blocos de treino.
 */
const PescaKianda = ({
  api,
  ctx,
  resultado,
}: {
  api: ApiTarefa;
  ctx: ContextoTreino;
  resultado: MutableRefObject<(() => ResultadoTreino) | null>;
}) => {
  const { t } = useTranslation();
  const { pxPorMm, devicePixelRatio } = ctx;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const contentor = useRef<HTMLDivElement>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const [tam, setTam] = useState({ w: 0, h: 0 });
  const estado = useRef<EstadoPesca>(iniciarPesca());
  const [hud, setHud] = useState(() => ({ certos: 0, nivel: 1, alvo: estado.current.alvo, presa: false }));
  const apiRef = useRef(api);
  apiRef.current = api;
  const tRef = useRef(t);
  tRef.current = t;
  const toques = useRef<{ x: number; y: number }[]>([]);
  const cursor = useRef({ x: 0, y: 0, visivel: false });

  useEffect(() => {
    const medir = () => {
      const w = contentor.current?.clientWidth ?? 0;
      const h = Math.round(Math.max(ALTURA_MIN_PX, Math.min(ALTURA_MAX_PX, window.innerHeight - RESERVA_PX)));
      setTam((a) => (a.w === w && a.h === h ? a : { w, h }));
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  resultado.current = () => {
    const e = estado.current;
    const limiar = limiarPesca(e);
    return {
      limiar,
      unidade: "graus",
      resumo:
        limiar === null
          ? t("Visao.pescaSemLimiar")
          : t("Visao.pescaResumo", { graus: limiar, peixes: e.totais.certos, nivel: e.nivel }),
      sinais: {
        modo: "tapa_olho",
        nivel: e.nivel,
        diferenca_final: e.diferenca,
        peixes_certos: e.totais.certos,
        peixes_errados: e.totais.errados,
        peixes_fugidos: e.totais.fugidos,
        alforrecas: e.totais.alforrecas,
        precisao: precisaoPesca(e),
      },
    };
  };

  useEffect(() => {
    const cv = tela.current;
    const g = cv?.getContext("2d");
    const { w: W, h: H } = tam;
    if (!cv || !g || W < 1 || H < 1) return;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fundo = pintarFundo(W, H, dpr);
    const mm = (v: number) => v * pxPorMm;
    if (!cursor.current.visivel) cursor.current = { x: W / 2, y: H / 2, visivel: false };

    let peixes: Peixe[] = [];
    let alforrecas: Alforreca[] = [];
    let efeitos: Efeito[] = [];
    const algas = Array.from({ length: 6 }, (_, i) => ({ x: (W / 6) * i + 18, h: 50 + ((i * 37) % 60), f: i }));
    let tempoJogo = 0;
    let proximoPeixe = 0.4;
    let proximaAlforreca = 5;
    let presaAte = 0;
    let controloPendente = false;
    let faixa: { texto: string; idade: number } | null = null;
    let ultimo = performance.now();
    let raf = 0;
    const calmo = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const acontecer = (ev: EventoPesca) => {
      const antes = estado.current.nivel;
      estado.current = registarPesca(estado.current, ev);
      const e = estado.current;
      if (e.nivel !== antes) {
        // Sinal novo: os peixes do sinal antigo vão-se embora sem contar.
        for (const p of peixes) if (p.estado === "nada") {
          p.estado = "sai";
          p.vx *= 2.5;
        }
        faixa = { texto: tRef.current("Visao.pescaNivelNovo", { nivel: e.nivel }), idade: 0 };
      }
      setHud((h) => ({ ...h, certos: e.totais.certos, nivel: e.nivel, alvo: e.alvo }));
    };

    const novoPeixe = () => {
      const e = estado.current;
      const n = NIVEIS_PESCA[e.nivel - 1];
      const controlo = controloPendente;
      controloPendente = false;
      const certo = controlo || Math.random() < FRACCAO_CERTOS_PESCA;
      const escala = controlo ? ESCALA_CONTROLO : 0.9 + Math.random() * 0.2;
      const largura = mm(n.peixeMm) * escala;
      const altura = largura * 0.56;
      const daEsquerda = Math.random() < 0.5;
      const cor = controlo ? DOURADO : CORES_PEIXE[Math.floor(Math.random() * CORES_PEIXE.length)];
      peixes.push({
        x: daEsquerda ? -largura : W,
        y0: 12 + Math.random() * Math.max(10, H - 56 - altura),
        fase: Math.random() * 6,
        vx: (daEsquerda ? 1 : -1) * mm(n.velocidadeMmS) * (0.85 + Math.random() * 0.3),
        largura,
        altura,
        certo,
        controlo,
        estado: "nada",
        t: 0,
        sprite: spritePeixe(
          largura,
          altura,
          orientacaoDoPeixe(e, certo),
          mm(n.periodoMm) * escala,
          controlo ? 0.95 : n.contraste,
          cor,
          !daEsquerda,
          dpr,
          controlo,
        ),
      });
      proximoPeixe = tempoJogo + n.intervaloS * (0.8 + Math.random() * 0.4);
    };

    const yDe = (p: Peixe) => p.y0 + Math.sin(p.fase) * 5;

    const tocar = (x: number, y: number) => {
      const presa = tempoJogo < presaAte;
      efeitos.push({ x, y, idade: 0, presa });
      if (presa) {
        efeitos.push({ x, y: y - 20, idade: 0, texto: tRef.current("Visao.pescaRedePresa"), cor: "#ffd1e6" });
        return;
      }
      const vivos = peixes.filter((p) => p.estado === "nada");
      const i = caixaTocada(
        vivos.map((p) => ({ x: p.x, y: yDe(p), largura: p.largura, altura: p.altura })),
        x,
        y,
        mm(FOLGA_TOQUE_MM),
      );
      if (i >= 0) {
        const p = vivos[i];
        if (p.controlo) {
          p.estado = "apanhado";
          p.t = 0;
          apiRef.current.registar({ controlo: true, acertou: true });
          efeitos.push({ x, y: y - 18, idade: 0, texto: tRef.current("Visao.pescaApanhado"), cor: "#fff3c4" });
          return;
        }
        apiRef.current.registar({ controlo: false, acertou: p.certo });
        if (p.certo) {
          p.estado = "apanhado";
          p.t = 0;
          efeitos.push({ x, y: y - 18, idade: 0, texto: tRef.current("Visao.pescaApanhado"), cor: "#ffffff" });
          acontecer("certo");
        } else {
          p.estado = "foge";
          p.vx *= 3.2;
          efeitos.push({ x, y: y - 18, idade: 0, texto: tRef.current("Visao.pescaRiscasDiferentes"), cor: "#ffe2a8" });
          acontecer("errado");
        }
        if (apiRef.current.proximaEControlo()) controloPendente = true;
        return;
      }
      for (const a of alforrecas) {
        if (Math.hypot(x - a.x, y - a.y) < mm(RAIO_ALFORRECA_MM) + mm(FOLGA_TOQUE_MM)) {
          presaAte = tempoJogo + REDE_PRESA_S;
          acontecer("alforreca");
          setHud((h) => ({ ...h, presa: true }));
          window.setTimeout(() => setHud((h) => ({ ...h, presa: false })), REDE_PRESA_S * 1000);
          efeitos.push({ x, y: y - 18, idade: 0, texto: tRef.current("Visao.pescaAlforreca"), cor: "#ffd1e6" });
          return;
        }
      }
    };

    const actualizar = (dt: number) => {
      tempoJogo += dt;
      if (tempoJogo >= proximoPeixe && peixes.length < 9) novoPeixe();
      if (tempoJogo >= proximaAlforreca && alforrecas.length < 2) {
        alforrecas.push({ x: 30 + Math.random() * Math.max(1, W - 60), y: H + 30, fase: Math.random() * 6 });
        proximaAlforreca = tempoJogo + INTERVALO_ALFORRECA_S * (0.8 + Math.random() * 0.5);
      }
      for (const toque of toques.current.splice(0)) tocar(toque.x, toque.y);
      for (const p of peixes) {
        p.x += p.vx * dt;
        p.fase += dt * 3;
        p.t += dt;
      }
      peixes = peixes.filter((p) => {
        if (p.estado === "apanhado") return p.t < 0.45;
        const fora = p.x > W + 10 || p.x < -p.largura - 10;
        if (fora && p.estado === "nada") {
          if (p.controlo) apiRef.current.registar({ controlo: true, acertou: false });
          else if (p.certo) acontecer("fugiu");
        }
        return !fora;
      });
      for (const a of alforrecas) {
        a.y -= mm(3.5) * dt;
        a.fase += dt * 2;
        a.x += Math.sin(a.fase) * 10 * dt;
      }
      alforrecas = alforrecas.filter((a) => a.y > -50);
      for (const e of efeitos) {
        e.idade += dt;
        if (e.texto) e.y -= 24 * dt;
      }
      efeitos = efeitos.filter((e) => e.idade < (e.texto ? 1 : 0.35));
      if (faixa && (faixa.idade += dt) > 1.8) faixa = null;
    };

    const desenhar = (seg: number) => {
      g.drawImage(fundo, 0, 0, W, H);
      g.lineCap = "round";
      g.strokeStyle = "#2e7d4f";
      g.lineWidth = 6;
      for (const a of algas) {
        const balanco = calmo ? 0 : Math.sin(seg * 1.3 + a.f) * 10;
        g.beginPath();
        g.moveTo(a.x, H - 20);
        g.quadraticCurveTo(a.x + balanco, H - 20 - a.h / 2, a.x + balanco * 1.6, H - 20 - a.h);
        g.stroke();
      }
      const raio = mm(RAIO_ALFORRECA_MM);
      for (const a of alforrecas) {
        g.fillStyle = "rgba(255,160,205,0.85)";
        g.beginPath();
        g.arc(a.x, a.y, raio, Math.PI, 0);
        g.closePath();
        g.fill();
        g.strokeStyle = "rgba(255,190,220,0.8)";
        g.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const x0 = a.x - raio * 0.6 + i * raio * 0.4;
          g.beginPath();
          g.moveTo(x0, a.y);
          for (let k = 1; k <= 4; k++) g.lineTo(x0 + Math.sin(a.fase + k + i) * 3, a.y + k * raio * 0.4);
          g.stroke();
        }
      }
      for (const p of peixes) {
        const y = yDe(p);
        if (p.estado === "apanhado") {
          const k = Math.min(1, p.t / 0.45);
          const esc = 1 - k * 0.8;
          g.globalAlpha = 1 - k * 0.6;
          g.drawImage(p.sprite, p.x + (W - 30 - p.x) * k, y + (10 - y) * k, p.largura * esc, p.altura * esc);
          g.globalAlpha = 1;
        } else g.drawImage(p.sprite, p.x, y, p.largura, p.altura);
      }
      for (const e of efeitos) {
        if (e.texto) continue;
        const r = 10 + e.idade * 90;
        g.strokeStyle = e.presa ? "rgba(255,120,120,0.9)" : "rgba(255,255,255,0.9)";
        g.lineWidth = 2;
        g.beginPath();
        g.arc(e.x, e.y, r, 0, Math.PI * 2);
        g.stroke();
      }
      g.textAlign = "center";
      g.font = "600 15px system-ui, sans-serif";
      for (const e of efeitos) {
        if (!e.texto) continue;
        g.globalAlpha = Math.max(0, 1 - e.idade);
        g.fillStyle = "rgba(0,40,60,0.55)";
        g.fillText(e.texto, e.x + 1, e.y + 1);
        g.fillStyle = e.cor ?? "#fff";
        g.fillText(e.texto, e.x, e.y);
      }
      g.globalAlpha = 1;
      if (tempoJogo < presaAte) {
        g.fillStyle = "rgba(255,160,205,0.18)";
        g.fillRect(0, 0, W, H);
      }
      if (cursor.current.visivel) {
        const { x, y } = cursor.current;
        g.strokeStyle = "#ffffff";
        g.lineWidth = 2;
        g.beginPath();
        g.arc(x, y, mm(FOLGA_TOQUE_MM) + 6, 0, Math.PI * 2);
        g.moveTo(x - 6, y);
        g.lineTo(x + 6, y);
        g.moveTo(x, y - 6);
        g.lineTo(x, y + 6);
        g.stroke();
      }
      if (faixa) {
        g.fillStyle = "rgba(4,40,58,0.72)";
        g.fillRect(0, H / 2 - 26, W, 52);
        g.fillStyle = "#fff";
        g.font = "700 18px system-ui, sans-serif";
        g.fillText(faixa.texto, W / 2, H / 2 + 6);
      }
    };

    const animar = (agora: number) => {
      const dt = Math.min(0.05, (agora - ultimo) / 1000);
      ultimo = agora;
      if (apiRef.current.activo) actualizar(dt);
      else toques.current.length = 0;
      desenhar(agora / 1000);
      raf = requestAnimationFrame(animar);
    };
    raf = requestAnimationFrame(animar);
    return () => cancelAnimationFrame(raf);
  }, [dpr, pxPorMm, tam]);

  const aoTocar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    cursor.current.visivel = false;
    toques.current.push({ x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const aoTecla = (e: React.KeyboardEvent) => {
    const passo = PASSO_TECLADO_MM * pxPorMm;
    const c = cursor.current;
    const d = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[e.key];
    if (d) {
      e.preventDefault();
      c.visivel = true;
      c.x = Math.min(tam.w, Math.max(0, c.x + d[0]));
      c.y = Math.min(tam.h, Math.max(0, c.y + d[1]));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      c.visivel = true;
      toques.current.push({ x: c.x, y: c.y });
    }
  };

  if (!ctx.olho) return <p className="py-10 text-center text-sm text-muted-foreground">{t("Visao.kiandaSemOlho")}</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Sinal alvo={hud.alvo} nivel={hud.nivel} />
          <p className="text-sm leading-tight">
            <span className="block font-semibold text-foreground">{t("Visao.pescaRiscasAssim")}</span>
            <span className="text-muted-foreground">{t("Visao.pescaInstrucao")}</span>
          </p>
        </div>
        <p className="flex gap-4 text-sm tabular-nums text-foreground" aria-live="polite">
          <span>{t("Visao.pescaPeixes", { n: hud.certos })}</span>
          <span>{t("Visao.pescaNivel", { nivel: hud.nivel })}</span>
          {hud.presa && <span className="font-semibold">{t("Visao.pescaRedePresa")}</span>}
        </p>
      </div>
      <div ref={contentor} className="w-full overflow-hidden rounded-xl border border-border">
        {tam.w > 0 && (
          <canvas
            ref={tela}
            tabIndex={0}
            role="application"
            aria-label={t("Visao.pescaRotuloPalco")}
            className="block touch-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ width: tam.w, height: tam.h }}
            onPointerDown={aoTocar}
            onKeyDown={aoTecla}
          />
        )}
      </div>
    </div>
  );
};

export default PescaKianda;
