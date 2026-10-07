import { describe, expect, it, vi } from "vitest";
import type { DesvioBinocular } from "../analise/binocular";
import type { Circulo } from "../analise/tipos";
import { dicaDeRepeticao, medirFotografias, paraMedicoesApi, VERSAO_MOTOR } from "./sessaoCompleta";

const IRIS: [Circulo, Circulo] = [
  { centro: { x: 100, y: 100 }, raio: 20 },
  { centro: { x: 200, y: 100 }, raio: 20 },
];

const desvio = (h: number, v = 0): DesvioBinocular => ({
  horizontalDelta: h,
  verticalDelta: v,
  mmPorPx: 0.03,
  direito: { nasal: 0.5, superior: 0 },
  esquerdo: { nasal: 0.5, superior: 0 },
});

/** Cada "fotografia" é só um rótulo: o motor e o detector estão simulados. */
const fotos = ["a", "b", "c", "d"];

describe("medirFotografias", () => {
  it("junta as fotografias medidas numa sessão com a mediana", async () => {
    const valores: Record<string, number> = { a: 1, b: 1.5, c: 2, d: 1.2 };
    const sessao = await medirFotografias(fotos, {
      detectarIris: async () => IRIS,
      analisarFoto: (f) => ({ desvio: desvio(valores[f]!), motivo: null }),
    });
    expect(sessao.ok).toBe(true);
    if (sessao.ok) {
      expect(sessao.valor.fotografiasValidas).toBe(4);
      expect(sessao.valor.horizontalDelta).toBeCloseTo(1.35, 6);
    }
  });

  it("sem rosto detectado ou com a detecção a rebentar, a fotografia falha (nunca excepção)", async () => {
    const sessao = await medirFotografias(fotos, {
      detectarIris: async (f) => {
        if (f === "a") throw new Error("modelo não carregou");
        return f === "b" ? null : IRIS;
      },
      analisarFoto: () => ({ desvio: desvio(1), motivo: null }),
    });
    expect(sessao.ok).toBe(true);
    if (sessao.ok) expect(sessao.valor.fotografiasValidas).toBe(2);
  });

  it("com menos de duas fotografias válidas não há medição", async () => {
    const sessao = await medirFotografias(fotos, {
      detectarIris: async (f) => (f === "a" ? IRIS : null),
      analisarFoto: () => ({ desvio: desvio(1), motivo: null }),
    });
    expect(sessao.ok).toBe(false);
    if (sessao.ok === false) expect(sessao.motivo).toBe("poucas-fotografias-validas");
  });

  it("fotografias que discordam não dão um número", async () => {
    const valores: Record<string, number> = { a: 0, b: 9, c: 0, d: 9 };
    const sessao = await medirFotografias(fotos, {
      detectarIris: async () => IRIS,
      analisarFoto: (f) => ({ desvio: desvio(valores[f]!), motivo: null }),
    });
    expect(sessao.ok).toBe(false);
    if (sessao.ok === false) expect(sessao.motivo).toBe("medicoes-inconsistentes");
  });

  it("avisa do progresso a cada fotografia", async () => {
    const aoProgredir = vi.fn();
    await medirFotografias(fotos, {
      detectarIris: async () => IRIS,
      analisarFoto: () => ({ desvio: desvio(1), motivo: null }),
      aoProgredir,
    });
    expect(aoProgredir.mock.calls).toEqual([
      [1, 4],
      [2, 4],
      [3, 4],
      [4, 4],
    ]);
  });
});

describe("paraMedicoesApi", () => {
  it("sessão medida: os números e a versão do motor, sem falha", async () => {
    const sessao = await medirFotografias(fotos, {
      detectarIris: async () => IRIS,
      analisarFoto: () => ({ desvio: desvio(2, 0.5), motivo: null }),
    });
    expect(paraMedicoesApi(sessao)).toEqual({
      horizontal_delta: 2,
      vertical_delta: 0.5,
      dispersao_delta: 0,
      fotografias_validas: 4,
      fotografias_total: 4,
      falha: null,
      versao_motor: VERSAO_MOTOR,
    });
  });

  it("sessão falhada: números a zero e o motivo, para a API decidir 'não mediu'", async () => {
    const sessao = await medirFotografias(fotos, {
      detectarIris: async () => null,
      analisarFoto: () => ({ desvio: null, motivo: null }),
    });
    expect(paraMedicoesApi(sessao)).toMatchObject({
      falha: "poucas-fotografias-validas",
      fotografias_validas: 0,
      fotografias_total: 4,
    });
  });

  it("o corpo nunca leva imagem", async () => {
    const sessao = await medirFotografias(fotos, {
      detectarIris: async () => IRIS,
      analisarFoto: () => ({ desvio: desvio(1), motivo: null }),
    });
    expect(JSON.stringify(paraMedicoesApi(sessao))).not.toMatch(/base64|imagem|image|data:/i);
  });
});

describe("dicaDeRepeticao", () => {
  const falhar = async (motivo: string | null, semRosto = false) =>
    medirFotografias(fotos, {
      detectarIris: async () => (semRosto ? null : IRIS),
      analisarFoto: () => ({ desvio: null, motivo }),
    });

  it("pelo motivo mais frequente", async () => {
    expect(dicaDeRepeticao(await falhar(null, true))).toBe("semRosto");
    expect(dicaDeRepeticao(await falhar("iris-pequena"))).toBe("longe");
    expect(dicaDeRepeticao(await falhar("sem-reflexo"))).toBe("luz");
    expect(dicaDeRepeticao(await falhar("limbo-irregular"))).toBe("geral");
  });

  it("fotografias que discordam: pede para olhar sempre para o mesmo ponto", async () => {
    const valores: Record<string, number> = { a: 0, b: 9, c: 0, d: 9 };
    const s = await medirFotografias(fotos, {
      detectarIris: async () => IRIS,
      analisarFoto: (f) => ({ desvio: desvio(valores[f]!), motivo: null }),
    });
    expect(dicaDeRepeticao(s)).toBe("olhar");
  });
});
