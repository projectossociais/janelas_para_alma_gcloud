/**
 * Vaivém da Missanga: o Fio de Missangas em treino diário (id `convergence`,
 * desde 2026-11-11; substitui o Olho Mágico, por decisão do dono do projecto:
 * cruzar os olhos de propósito era difícil e o exercício "só fazia perguntas").
 *
 * A mesma montagem do teste (`fioMissangas.ts`): o telemóvel deitado, com a
 * ponta encostada ao nariz. Em vez de três medições, a missanga anda em
 * vaivém à volta do ponto em que os olhos se separam:
 *
 *   aproxima-se -> toque quando fica a dobrar (rotura) -> afasta-se -> toque
 *   quando volta a ser uma (recuperação) -> afasta-se mais um pouco, para os
 *   olhos descansarem -> volta a aproximar-se...
 *
 * É a versão no ecrã do exercício da caneta ("pencil push-ups"). Cada
 * repetição diz a que distância do nariz ficou a dobrar: quanto mais perto,
 * melhor. A resposta é declarada (um toque), por isso grava-se como
 * auto-avaliação; a medida para o médico continua a ser a do teste, a 1 cm/s.
 *
 * Funções puras, com o relógio injectado -- o ecrã vive em
 * `components/visao/TreinoFio.tsx`.
 */
import { NARIZ_MM, meioCm } from "./fioMissangas";

export const MODO_FIO_TREINO = "fio_treino";
/** Mais depressa do que no teste (1 cm/s): aqui treina-se, não se mede. */
export const VELOCIDADE_TREINO_CM_S = 1.5;
/** Depois de voltar a ser uma, a missanga afasta-se mais isto antes de voltar. */
export const FOLGA_CM = 2;
/** Parada no início, antes de partir (ao começar, e depois de chegar ao nariz ou ao topo). */
export const ESPERA_MS = 900;
/** Logo a seguir a "ficou a dobrar", um segundo toque é o mesmo toque repetido. */
export const TOQUE_DUPLO_MS = 500;
/** Quantas roturas, no máximo, vão para `sinais` (o campo é pequeno). */
export const ROTURAS_GUARDADAS = 30;

const NARIZ_CM = NARIZ_MM / 10;

export type FaseFio = "espera" | "aproximar" | "afastar" | "folga";

export interface RepFio {
  /** Onde ficou a dobrar (cm); 0 = chegou ao nariz sem dobrar. */
  rotura: number;
  /** Onde voltou a ser uma (cm); `null` = chegou ao topo sem voltar a ser uma. */
  recuperacao: number | null;
}

export interface EstadoFioTreino {
  fase: FaseFio;
  /** De onde partiu o movimento actual (cm a contar do nariz) e quando (ms). */
  desde: number;
  t0: number;
  /** A rotura da repetição em curso, enquanto a missanga se afasta. */
  rotura: number | null;
  /** Até onde vai a folga. */
  alvo: number;
  reps: readonly RepFio[];
}

export type EventoFio = "rotura" | "recuperacao" | "nariz" | "semRecuperar";

export const iniciarFioTreino = (inicioCm: number, agora: number): EstadoFioTreino => ({
  fase: "espera",
  desde: inicioCm,
  t0: agora + ESPERA_MS,
  rotura: null,
  alvo: inicioCm,
  reps: [],
});

/** Onde está a missanga agora (cm a contar do nariz). */
export function posicaoNoTreino(e: EstadoFioTreino, agora: number, inicioCm: number): number {
  const anda = (VELOCIDADE_TREINO_CM_S * Math.max(0, agora - e.t0)) / 1000;
  switch (e.fase) {
    case "espera":
      return e.desde;
    case "aproximar":
      return Math.max(NARIZ_CM, e.desde - anda);
    case "afastar":
      return Math.min(inicioCm, e.desde + anda);
    case "folga":
      return Math.min(e.alvo, e.desde + anda);
  }
}

const esperar = (e: EstadoFioTreino, inicioCm: number, agora: number, rep: RepFio): EstadoFioTreino => ({
  fase: "espera",
  desde: inicioCm,
  t0: agora + ESPERA_MS,
  rotura: null,
  alvo: inicioCm,
  reps: [...e.reps, rep],
});

/** O que acontece sozinho com o passar do tempo (chegar ao nariz, ao topo, ao fim da folga). */
export function avancarFio(e: EstadoFioTreino, agora: number, inicioCm: number): { estado: EstadoFioTreino; evento?: EventoFio } {
  const pos = posicaoNoTreino(e, agora, inicioCm);
  switch (e.fase) {
    case "espera":
      return agora >= e.t0 ? { estado: { ...e, fase: "aproximar", t0: agora } } : { estado: e };
    case "aproximar":
      // Chegou ao nariz sem ficar a dobrar: os olhos juntaram-se até ao fim.
      return pos <= NARIZ_CM ? { estado: esperar(e, inicioCm, agora, { rotura: 0, recuperacao: 0 }), evento: "nariz" } : { estado: e };
    case "afastar":
      return pos >= inicioCm
        ? { estado: esperar(e, inicioCm, agora, { rotura: e.rotura ?? inicioCm, recuperacao: null }), evento: "semRecuperar" }
        : { estado: e };
    case "folga":
      return pos >= e.alvo ? { estado: { ...e, fase: "aproximar", desde: pos, t0: agora } } : { estado: e };
  }
}

/** Um toque: "ficou a dobrar" a aproximar, "voltou a ser uma" a afastar. Fora disso, não conta. */
export function tocarFio(e: EstadoFioTreino, agora: number, inicioCm: number): { estado: EstadoFioTreino; evento?: EventoFio } {
  const pos = posicaoNoTreino(e, agora, inicioCm);
  if (e.fase === "aproximar") {
    return { estado: { ...e, fase: "afastar", desde: pos, t0: agora, rotura: meioCm(pos) }, evento: "rotura" };
  }
  if (e.fase === "afastar") {
    if (agora - e.t0 < TOQUE_DUPLO_MS) return { estado: e };
    const rotura = e.rotura ?? meioCm(pos);
    const rep: RepFio = { rotura, recuperacao: Math.max(rotura, meioCm(pos)) };
    return {
      estado: { fase: "folga", desde: pos, t0: agora, rotura: null, alvo: Math.min(inicioCm, pos + FOLGA_CM), reps: [...e.reps, rep] },
      evento: "recuperacao",
    };
  }
  return { estado: e };
}

/** Pausa (entre blocos): o movimento seguinte parte de onde este ficou, sem salto. */
export const retomarFio = (e: EstadoFioTreino, posicaoCm: number, agora: number): EstadoFioTreino =>
  e.fase === "espera" ? { ...e, t0: agora + ESPERA_MS } : { ...e, desde: posicaoCm, t0: agora };

const mediana = (xs: readonly number[]): number | null => {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return Math.round((o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2) * 10) / 10;
};

export interface ResumoFioTreino {
  repeticoes: number;
  /** Mediana de onde ficou a dobrar (cm); `null` sem repetições. */
  medianaCm: number | null;
  /** A vez em que chegou mais perto do nariz sem dobrar. */
  melhorCm: number | null;
  /** Vezes em que chegou ao nariz sem dobrar. */
  narizes: number;
  /** Vezes em que não voltou a ser uma dentro do ecrã. */
  semRecuperar: number;
}

export function resumirFioTreino(reps: readonly RepFio[]): ResumoFioTreino {
  const roturas = reps.map((r) => r.rotura);
  return {
    repeticoes: reps.length,
    medianaCm: mediana(roturas),
    melhorCm: roturas.length ? Math.min(...roturas) : null,
    narizes: reps.filter((r) => r.rotura === 0).length,
    semRecuperar: reps.filter((r) => r.recuperacao === null).length,
  };
}
