import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApiTarefa, ContextoTreino, ResultadoTreino } from "@/components/visao/AssistenteTreino";
import { juntarOlhos, tabelaDosOlhos } from "@/lib/visao/anaglifo";
import {
  contrasteDePartida,
  iniciarKianda,
  limiarOrientacao,
  registarEvento,
  type EstadoKianda,
  type EventoKianda,
} from "@/lib/visao/kianda";
import { ID_ANEIS } from "@/lib/visao/ids";

// Tamanhos em mm de ecrã (convertidos com `pxPorMm`): o jogo tem o mesmo
// tamanho físico em qualquer aparelho.
const ALTURA_PALCO_MM = 60;
const PEIXE_COMPRIMENTO_MM = 22;
const PEIXE_ALTURA_MM = 12;
const REDE_RAIO_MM = 9;
const ROCHA_RAIO_MM = 7;
const VELOCIDADE_PEIXE_MM_S = 28;
const VELOCIDADE_ROCHA_MM_S = 12;
const ONDULACAO_MM = 3;
const INTERVALO_PEIXE_MS = 1400;
const INTERVALO_ROCHA_MS = 3600;
/** Fracção de peixes com a orientação do sinal. */
const FRACCAO_CERTOS = 0.45;
/** Depois de bater numa rocha, a rede fica presa este tempo. */
const REDE_PRESA_MS = 1200;
/** Passo da rede com as setas do teclado. */
const PASSO_TECLADO_MM = 5;
/** Escamas: ciclos por grau de ângulo visual, à distância medida. */
const CICLOS_POR_GRAU = 2;
/** Resolução interna máxima (largura): juntar as duas imagens é feito píxel a píxel. */
const LARGURA_INTERNA_MAX = 640;

interface Peixe {
  id: number;
  x: number;
  y0: number;
  fase: number;
  vx: number;
  certo: boolean;
  /** Peixe dourado de controlo: visto pelos dois olhos, sempre certo. */
  controlo: boolean;
  sprite: HTMLCanvasElement;
}

interface Rocha {
  id: number;
  x: number;
  y: number;
  vx: number;
}

/** Escamas em padrão de Gabor (risca com a orientação dada) dentro do corpo do peixe. */
function desenharPeixe(larguraPx: number, alturaPx: number, orientacaoGraus: number, periodoPx: number, voltaParaEsquerda: boolean) {
  const c = document.createElement("canvas");
  c.width = larguraPx;
  c.height = alturaPx;
  const g = c.getContext("2d");
  if (!g) return c;
  const corpo = larguraPx * 0.78;
  const cx = voltaParaEsquerda ? larguraPx - corpo / 2 : corpo / 2;
  const cy = alturaPx / 2;
  const img = g.createImageData(larguraPx, alturaPx);
  const rad = (orientacaoGraus * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  for (let y = 0; y < alturaPx; y++) {
    for (let x = 0; x < larguraPx; x++) {
      const dx = (x - cx) / (corpo / 2);
      const dy = (y - cy) / (alturaPx / 2);
      if (dx * dx + dy * dy > 1) continue;
      const v = 128 + 120 * Math.sin((2 * Math.PI * ((x - cx) * cos + (y - cy) * sin)) / periodoPx);
      const i = (y * larguraPx + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // Contorno e cauda escuros (contraste máximo nesse olho).
  g.strokeStyle = "rgb(20,20,20)";
  g.lineWidth = Math.max(1, alturaPx * 0.08);
  g.beginPath();
  g.ellipse(cx, cy, corpo / 2 - g.lineWidth / 2, alturaPx / 2 - g.lineWidth / 2, 0, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = "rgb(20,20,20)";
  g.beginPath();
  const base = voltaParaEsquerda ? larguraPx - corpo : corpo;
  const ponta = voltaParaEsquerda ? 0 : larguraPx;
  g.moveTo(base, cy);
  g.lineTo(ponta, cy - alturaPx * 0.4);
  g.lineTo(ponta, cy + alturaPx * 0.4);
  g.closePath();
  g.fill();
  return c;
}

/** Último contraste do olho forte a que se chegou, nas sessões dicópticas anteriores. */
const ultimoContraste = (ctx: ContextoTreino): number | null => {
  const s = ctx.historico.find((x) => x.exercicio_id === ID_ANEIS && x.sinais?.modo === "dicoptico");
  const v = s?.sinais?.contraste_final;
  return typeof v === "number" ? v : null;
};

const percentagem = (x: number) => `${Math.round(x * 100)}%`;

/**
 * O jogo Kianda (modo com óculos 3D). Ver `lib/visao/kianda.ts` para a lógica
 * e o porquê; aqui fica o desenho, o tempo e os toques.
 */
const JogoKianda = ({
  api,
  ctx,
  resultado,
}: {
  api: ApiTarefa;
  ctx: ContextoTreino;
  resultado: MutableRefObject<(() => ResultadoTreino) | null>;
}) => {
  const { t } = useTranslation();
  const { pxPorMm, distanciaMm, afinacao } = ctx;
  const olhoFraco = ctx.olho;
  const contentor = useRef<HTMLDivElement>(null);
  const palco = useRef<HTMLCanvasElement>(null);
  const [larguraCss, setLarguraCss] = useState(0);
  const alturaCss = Math.round(ALTURA_PALCO_MM * pxPorMm);

  const [contrasteInicial] = useState(() => contrasteDePartida(ultimoContraste(ctx)));
  const estado = useRef<EstadoKianda>(iniciarKianda(contrasteInicial));
  const [hud, setHud] = useState({ certos: 0, contraste: contrasteInicial, presa: false });
  const [pausado, setPausado] = useState(false);
  const diplopia = useRef(false);
  const pausadoRef = useRef(false);
  pausadoRef.current = pausado;
  const apiRef = useRef(api);
  apiRef.current = api;
  const rede = useRef({ x: 0, y: 0, presaAte: 0 });

  useEffect(() => {
    const medir = () => setLarguraCss(contentor.current?.clientWidth ?? 0);
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  const escala = larguraCss > 0 ? Math.min(1, LARGURA_INTERNA_MAX / larguraCss) : 1;
  const largura = Math.round(larguraCss * escala);
  const altura = Math.round(alturaCss * escala);
  const mm = useCallback((v: number) => v * pxPorMm * escala, [escala, pxPorMm]);
  const tabela = useMemo(() => tabelaDosOlhos(afinacao), [afinacao]);

  resultado.current = () => {
    const e = estado.current;
    const limiar = e.contrasteSustentado;
    return {
      limiar,
      unidade: "razao_contraste",
      resumo:
        limiar === null
          ? t("Visao.kiandaSemLimiar", { peixes: e.totais.certos })
          : t("Visao.kiandaResumo", { contraste: percentagem(limiar), peixes: e.totais.certos }),
      sinais: {
        modo: "dicoptico",
        olho_fraco: olhoFraco,
        contraste_inicial: contrasteInicial,
        contraste_final: e.contraste,
        contraste_sustentado: e.contrasteSustentado,
        orientacao_graus: limiarOrientacao(e),
        peixes_certos: e.totais.certos,
        peixes_errados: e.totais.errados,
        peixes_fugidos: e.totais.fugidos,
        colisoes: e.totais.colisoes,
        rondas: e.totais.rondas,
        diplopia_reportada: diplopia.current,
      },
    };
  };

  // Um só requestAnimationFrame: mexe, verifica toques e desenha.
  useEffect(() => {
    const visivel = palco.current?.getContext("2d");
    if (!visivel || largura < 1 || altura < 1 || !olhoFraco) return;
    const criar = () => {
      const c = document.createElement("canvas");
      c.width = largura;
      c.height = altura;
      return c.getContext("2d", { willReadFrequently: true });
    };
    const esq = criar();
    const dir = criar();
    if (!esq || !dir) return;
    const fraco = olhoFraco === "esquerdo" ? esq : dir;
    const forte = olhoFraco === "esquerdo" ? dir : esq;
    const saida = visivel.createImageData(largura, altura);

    // Escamas: período em mm de ecrã para `CICLOS_POR_GRAU` à distância medida.
    const periodoPx = Math.max(4, mm(distanciaMm * Math.tan(((1 / CICLOS_POR_GRAU) * Math.PI) / 180)));
    const comprimento = Math.round(mm(PEIXE_COMPRIMENTO_MM));
    const alturaPeixe = Math.round(mm(PEIXE_ALTURA_MM));
    const raioRede = mm(REDE_RAIO_MM);
    const raioRocha = mm(ROCHA_RAIO_MM);
    if (rede.current.x === 0 && rede.current.y === 0) rede.current = { x: largura / 2, y: altura / 2, presaAte: 0 };

    let peixes: Peixe[] = [];
    let rochas: Rocha[] = [];
    let id = 0;
    let alvo = Math.floor(Math.random() * 4) * 45; // orientação do sinal: 0, 45, 90 ou 135°
    let rondaDoAlvo = estado.current.totais.rondas;
    let sinal = desenharPeixe(comprimento, alturaPeixe, alvo, periodoPx, false);
    let controloPendente = false;
    let ultimo = performance.now();
    // Relógio do jogo (ms): só anda enquanto se joga, e ao mesmo passo que os
    // peixes. Com o relógio de parede, um telemóvel lento ou um separador em
    // segundo plano fazia nascer peixes mais depressa do que eles nadavam.
    let tempoJogo = 0;
    let proximoPeixe = 600;
    let proximaRocha = INTERVALO_ROCHA_MS;
    let raf = 0;

    const acontecer = (ev: EventoKianda) => {
      estado.current = registarEvento(estado.current, ev);
      const e = estado.current;
      setHud((h) => ({ ...h, certos: e.totais.certos, contraste: e.contraste }));
      // Nova ronda: novo sinal (orientação), para a tarefa não ficar decorada.
      if (e.totais.rondas !== rondaDoAlvo) {
        rondaDoAlvo = e.totais.rondas;
        alvo = (alvo + 45 * (1 + Math.floor(Math.random() * 3))) % 180;
        sinal = desenharPeixe(comprimento, alturaPeixe, alvo, periodoPx, false);
      }
    };

    const novoPeixe = () => {
      const daEsquerda = Math.random() < 0.5;
      const controlo = controloPendente;
      controloPendente = false;
      const certo = controlo || Math.random() < FRACCAO_CERTOS;
      const sinalDesvio = Math.random() < 0.5 ? -1 : 1;
      const orientacao = certo ? alvo : alvo + sinalDesvio * estado.current.orientacao;
      const margem = alturaPeixe;
      peixes.push({
        id: id++,
        x: daEsquerda ? -comprimento : largura + comprimento,
        y0: margem + Math.random() * Math.max(1, altura - 2 * margem),
        fase: Math.random() * Math.PI * 2,
        vx: (daEsquerda ? 1 : -1) * mm(VELOCIDADE_PEIXE_MM_S),
        certo,
        controlo,
        sprite: desenharPeixe(comprimento, alturaPeixe, orientacao, periodoPx, !daEsquerda),
      });
      proximoPeixe = tempoJogo + INTERVALO_PEIXE_MS * (0.7 + Math.random() * 0.6);
    };

    const yDoPeixe = (p: Peixe) => p.y0 + mm(ONDULACAO_MM) * Math.sin(tempoJogo / 600 + p.fase);

    const desenhar = () => {
      for (const g of [esq, dir]) {
        g.fillStyle = "rgb(255,255,255)";
        g.fillRect(0, 0, largura, altura);
      }
      // Rochas: só o olho forte, com o contraste em treino.
      const cinzentoRocha = Math.round(255 * (1 - estado.current.contraste));
      forte.fillStyle = `rgb(${cinzentoRocha},${cinzentoRocha},${cinzentoRocha})`;
      for (const r of rochas) {
        forte.beginPath();
        forte.arc(r.x, r.y, raioRocha, 0, Math.PI * 2);
        forte.fill();
      }
      // Peixes: só o olho fraco (os dourados de controlo, os dois olhos).
      for (const p of peixes) {
        const y = yDoPeixe(p) - alturaPeixe / 2;
        const x = p.x - comprimento / 2;
        fraco.drawImage(p.sprite, x, y);
        if (p.controlo) forte.drawImage(p.sprite, x, y);
      }
      // Sinal da Kianda e rede: os dois olhos.
      for (const g of [esq, dir]) {
        g.drawImage(sinal, 6, 6);
        g.strokeStyle = "rgb(30,30,30)";
        g.lineWidth = 2;
        g.setLineDash(tempoJogo < rede.current.presaAte ? [4, 4] : []);
        g.beginPath();
        g.arc(rede.current.x, rede.current.y, raioRede, 0, Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
      }
      juntarOlhos(
        esq.getImageData(0, 0, largura, altura).data,
        dir.getImageData(0, 0, largura, altura).data,
        saida.data,
        tabela,
      );
      visivel.putImageData(saida, 0, 0);
    };

    const animar = (agora: number) => {
      const dt = Math.min(0.05, (agora - ultimo) / 1000);
      ultimo = agora;
      // Em pausa (entre blocos, ou "estou a ver a dobrar"), o relógio do jogo pára.
      const aJogar = apiRef.current.activo && !pausadoRef.current;
      if (aJogar) {
        tempoJogo += dt * 1000;
        if (tempoJogo >= proximoPeixe) novoPeixe();
        if (tempoJogo >= proximaRocha) {
          rochas.push({ id: id++, x: largura + raioRocha, y: raioRocha + Math.random() * (altura - 2 * raioRocha), vx: -mm(VELOCIDADE_ROCHA_MM_S) });
          proximaRocha = tempoJogo + INTERVALO_ROCHA_MS * (0.7 + Math.random() * 0.6);
        }
        for (const p of peixes) p.x += p.vx * dt;
        for (const r of rochas) r.x += r.vx * dt;

        const presa = tempoJogo < rede.current.presaAte;
        // Peixes apanhados.
        const restantes: Peixe[] = [];
        for (const p of peixes) {
          const dentro = Math.hypot(p.x - rede.current.x, yDoPeixe(p) - rede.current.y) < raioRede + alturaPeixe / 2;
          if (dentro && !presa) {
            if (p.controlo) apiRef.current.registar({ controlo: true, acertou: true });
            else {
              acontecer(p.certo ? "apanhou_certo" : "apanhou_errado");
              apiRef.current.registar({ controlo: false, acertou: p.certo });
              if (apiRef.current.proximaEControlo()) controloPendente = true;
            }
            continue;
          }
          const fora = p.vx > 0 ? p.x > largura + comprimento : p.x < -comprimento;
          if (fora) {
            if (p.controlo) apiRef.current.registar({ controlo: true, acertou: false });
            else if (p.certo) acontecer("fugiu_certo");
            continue;
          }
          restantes.push(p);
        }
        peixes = restantes;
        // Rochas: bater prende a rede.
        rochas = rochas.filter((r) => {
          if (r.x < -raioRocha) return false;
          if (!presa && Math.hypot(r.x - rede.current.x, r.y - rede.current.y) < raioRede + raioRocha) {
            acontecer("colisao");
            rede.current.presaAte = tempoJogo + REDE_PRESA_MS;
            setHud((h) => ({ ...h, presa: true }));
            window.setTimeout(() => setHud((h) => ({ ...h, presa: false })), REDE_PRESA_MS);
            return false;
          }
          return true;
        });
      }
      desenhar();
      raf = requestAnimationFrame(animar);
    };
    raf = requestAnimationFrame(animar);
    return () => cancelAnimationFrame(raf);
  }, [altura, distanciaMm, largura, mm, olhoFraco, tabela]);

  const moverPara = (clienteX: number, clienteY: number) => {
    const c = palco.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    rede.current.x = ((clienteX - r.left) / r.width) * largura;
    rede.current.y = ((clienteY - r.top) / r.height) * altura;
  };

  const aoTecla = (e: React.KeyboardEvent) => {
    const passo = mm(PASSO_TECLADO_MM);
    const d = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[e.key];
    if (!d) return;
    e.preventDefault();
    rede.current.x = Math.min(largura, Math.max(0, rede.current.x + d[0]));
    rede.current.y = Math.min(altura, Math.max(0, rede.current.y + d[1]));
  };

  if (!olhoFraco) return <p className="py-10 text-center text-sm text-muted-foreground">{t("Visao.kiandaSemOlho")}</p>;

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-center text-sm text-muted-foreground">{t("Visao.kiandaInstrucao")}</p>
      <div className="flex w-full flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground" aria-live="polite">
        <span>{t("Visao.kiandaPeixes", { peixes: hud.certos })}</span>
        <span>{t("Visao.kiandaContrasteOlhoForte", { contraste: percentagem(hud.contraste) })}</span>
        {hud.presa && <span className="font-semibold text-foreground">{t("Visao.kiandaRedePresa")}</span>}
      </div>
      <div ref={contentor} className="relative w-full overflow-hidden rounded-xl border border-border">
        {larguraCss > 0 && (
          <canvas
            ref={palco}
            width={largura}
            height={altura}
            tabIndex={0}
            role="application"
            aria-label={t("Visao.kiandaRotuloPalco")}
            className="block touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ width: larguraCss - 2, height: alturaCss }}
            onPointerMove={(e) => moverPara(e.clientX, e.clientY)}
            onPointerDown={(e) => moverPara(e.clientX, e.clientY)}
            onKeyDown={aoTecla}
          />
        )}
        {pausado && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/95 p-4 text-center">
            <p className="max-w-sm text-sm text-foreground">{t("Visao.kiandaDiplopiaTexto")}</p>
            <Button onClick={() => setPausado(false)}>{t("Visao.kiandaContinuar")}</Button>
          </div>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          diplopia.current = true;
          setPausado(true);
        }}
      >
        <Eye className="h-4 w-4" />
        {t("Visao.kiandaVejoADobrar")}
      </Button>
    </div>
  );
};

export default JogoKianda;
