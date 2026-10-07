import { describe, expect, it } from "vitest";
import { DIAMETRO_IRIS_MM } from "./binocular";
import { geradorAleatorio } from "./geometria";
import { medirOlho } from "./olho";
import { gerarCena, type CenaSintetica, type OlhoSintetico } from "./testes/cenaSintetica";
import { simularJpeg, tabelaQuantizacao } from "./testes/jpeg";

/**
 * Robustez antes das fotografias reais (fase V0b, docs/MOTOR_ANALISE_RASTREIO.md §8).
 *
 * Critérios escritos antes de correr:
 * 1. Em cada condição adversa, o que o motor aceita tem erro < 0,08 mm em 95%
 *    dos casos (≈ 1,7 Δ por olho); o resto tem de ser recusado com um motivo.
 * 2. Segurança: números errados sem aviso (erro > 0,15 mm, ≈ 3 Δ) em menos de 1%
 *    do total. Recusar é aceitável; medir mal em silêncio não é.
 */

type Condicao = {
  nome: string;
  /** Qualidade JPEG com que a fotografia é gravada (telemóveis: tipicamente 85–95). */
  jpeg?: number;
  olho?: (aleatorio: () => number, raio: number, c: { x: number; y: number }) => Partial<OlhoSintetico>;
  cena?: (aleatorio: () => number) => Partial<CenaSintetica>;
};

const CONDICOES: Condicao[] = [
  { nome: "tremor horizontal (3–6 px)", cena: (a) => ({ tremor: 3 + 3 * a() }) },
  { nome: "tremor vertical (3–6 px)", cena: (a) => ({ tremor: 3 + 3 * a(), tremorVertical: true }) },
  { nome: "pestanas sobre a íris", olho: () => ({ pestanas: true, palpebraSuperior: 0.25 }) },
  { nome: "pouca luz (exposição 45–65%, mais ruído)", cena: (a) => ({ exposicao: 0.45 + 0.2 * a(), ruido: 5 + 3 * a() }) },
  {
    nome: "reflexos fracos de outras luzes",
    olho: (a, r, c) => ({
      reflexosFracos: [
        { x: c.x - (0.2 + 0.3 * a()) * r, y: c.y + (0.1 + 0.3 * a()) * r },
        { x: c.x + (0.1 + 0.3 * a()) * r, y: c.y - 0.2 * r },
      ],
    }),
  },
  { nome: "íris elíptica (olhar 15–25° de lado)", olho: (a) => ({ achatamento: Math.cos(((15 + 10 * a()) * Math.PI) / 180) }) },
  { nome: "JPEG qualidade 95", jpeg: 95 },
  { nome: "JPEG qualidade 85", jpeg: 85 },
  { nome: "JPEG qualidade 75", jpeg: 75 },
  { nome: "JPEG qualidade 60, com tremor", jpeg: 60, cena: (a) => ({ tremor: 2 + 2 * a() }) },
];

const N = 60;
const ERRO_ACEITE_MM = 0.08;
const ERRO_GRAVE_MM = 0.15;

describe("simulador de JPEG", () => {
  it("segue a regra de qualidade da libjpeg (50 = tabela da norma; 100 = tudo 1)", () => {
    expect(tabelaQuantizacao(50)[0]).toBe(16);
    expect(tabelaQuantizacao(100).every((v) => v === 1)).toBe(true);
  });

  it("qualidade mais baixa estraga mais a imagem", () => {
    const img = gerarCena({ largura: 64, altura: 64, olhos: [{ centroIris: { x: 32, y: 32 }, raioIris: 14, reflexo: { x: 34, y: 31 } }] });
    const erro = (q: number) => {
      const j = simularJpeg(img, q);
      return j.dados.reduce((s, v, i) => s + Math.abs(v - Math.round(img.dados[i]!)), 0) / j.dados.length;
    };
    expect(erro(95)).toBeLessThan(erro(60));
    expect(erro(100)).toBeLessThan(0.6);
  });
});

describe("robustez em condições adversas (V0b)", () => {
  const totais = { olhos: 0, graves: 0 };

  it.each(CONDICOES)("$nome", ({ olho: extraOlho, cena: extraCena, nome, jpeg }) => {
    const aleatorio = geradorAleatorio(nome.length * 7919);
    const entre = (a: number, b: number) => a + (b - a) * aleatorio();
    const erros: number[] = [];
    let recusas = 0;
    let graves = 0;
    for (let i = 0; i < N; i++) {
      const raio = entre(42, 56);
      const c = { x: 110 + entre(-0.5, 0.5), y: 110 + entre(-0.5, 0.5) };
      const off = { x: entre(-0.45, 0.45) * raio, y: entre(-0.25, 0.25) * raio };
      const olho: OlhoSintetico = {
        centroIris: c,
        raioIris: raio,
        reflexo: { x: c.x + off.x, y: c.y + off.y },
        tomIris: entre(25, 80),
        palpebraSuperior: entre(0, 0.3),
        ...extraOlho?.(aleatorio, raio, c),
      };
      const cena = gerarCena({
        largura: 220,
        altura: 220,
        olhos: [olho],
        tomPele: entre(60, 150),
        desfoque: entre(0.8, 1.4),
        ruido: entre(1, 4),
        semente: 500 + i,
        ...extraCena?.(aleatorio),
      });
      const img = jpeg ? simularJpeg(cena, jpeg) : cena;
      const aprox = {
        centro: { x: c.x + entre(-0.12, 0.12) * raio, y: c.y + entre(-0.12, 0.12) * raio },
        raio: raio * entre(0.85, 1.15),
      };
      const m = medirOlho(img, aprox);
      if (m.ok === false) {
        recusas++;
        continue;
      }
      const mmPorPx = DIAMETRO_IRIS_MM / (2 * raio);
      const erro =
        Math.hypot(m.valor.reflexo.x - m.valor.iris.centro.x - off.x, m.valor.reflexo.y - m.valor.iris.centro.y - off.y) *
        mmPorPx;
      erros.push(erro);
      if (erro > ERRO_GRAVE_MM) graves++;
    }
    totais.olhos += N;
    totais.graves += graves;
    erros.sort((a, b) => a - b);
    const p95 = erros.length ? erros[Math.floor(0.95 * (erros.length - 1))]! : 0;
    // Registo para o documento (aparece na saída do vitest).
    console.info(`[V0b] ${nome}: medidos ${erros.length}/${N}, recusados ${recusas}, p95 ${p95.toFixed(3)} mm, graves ${graves}`);
    expect(p95).toBeLessThan(ERRO_ACEITE_MM);
  }, 120_000);

  it("números errados sem aviso em menos de 1% de todos os olhos", () => {
    expect(totais.olhos).toBe(N * CONDICOES.length);
    expect(totais.graves / totais.olhos).toBeLessThan(0.01);
  });
});
