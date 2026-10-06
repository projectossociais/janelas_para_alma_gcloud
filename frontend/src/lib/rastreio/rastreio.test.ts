import { describe, expect, it } from "vitest";
import type { ScreeningResponse } from "@/services/api/screeningApi";
import {
  DIAGNOSTICO_AVALIACAO,
  DIAGNOSTICO_NORMAL,
  LUMINANCIA_MINIMA,
  conclusaoDoRastreio,
  desalinhamentoEmFrente,
  incomitancia,
  variacaoDesalinhamento,
  dataUrlParaBlob,
  lerResultadoGuardado,
  luminanciaMedia,
  paraRegistoScreening,
  paraResultadoEcra,
} from "./rastreio";

const RESPOSTA: ScreeningResponse = {
  estado: "concluido",
  posicoes: [
    {
      posicao: "CENTRO",
      estado: "ok",
      rosto_detetado: true,
      qualidade_captura: { pontuacao: 0.87, fiavel: true, motivos: [] },
      alinhamento_ocular: { assimetria_horizontal: 0.04, assimetria_vertical: 0.01 },
    },
    { posicao: "DIREITA", estado: "ok", rosto_detetado: false },
  ],
  requer_avaliacao_humana: false,
  // Como o serviço responde: a comparação vem dentro de `motilidade`.
  motilidade: { variacao_desalinhamento: 1.4, incomitante: false },
};
const INCOMITANTE: ScreeningResponse = { ...RESPOSTA, motilidade: { variacao_desalinhamento: 1.4, incomitante: true } };

describe("luminanciaMedia", () => {
  it("preto é 0, branco é 255", () => {
    expect(luminanciaMedia([0, 0, 0, 255])).toBe(0);
    expect(luminanciaMedia([255, 255, 255, 255])).toBeCloseTo(255);
  });

  it("uma imagem escura fica abaixo do mínimo", () => {
    expect(luminanciaMedia([30, 30, 30, 255, 40, 40, 40, 255])!).toBeLessThan(LUMINANCIA_MINIMA);
  });

  it("vazia devolve null", () => {
    expect(luminanciaMedia([])).toBeNull();
  });
});

describe("dataUrlParaBlob", () => {
  it("converte com o tipo certo", () => {
    const b = dataUrlParaBlob("data:image/jpeg;base64,AAAA");
    expect(b).toBeInstanceOf(Blob);
    expect(b!.type).toBe("image/jpeg");
  });

  it("formato inválido devolve null", () => {
    expect(dataUrlParaBlob("isto-nao-e-uma-imagem")).toBeNull();
  });
});

describe("paraRegistoScreening (o que se grava)", () => {
  it("nunca leva imagem nenhuma, só as medições", () => {
    const r = paraRegistoScreening(RESPOSTA);
    expect(JSON.stringify(r)).not.toMatch(/base64|imagem|image/i);
    expect(r.estado).toBe("concluido");
    expect(r.rosto_detetado).toBe(true);
    expect(r.qualidade_captura).toBe(0.87);
    // O desalinhamento a olhar em frente (posição CENTRO), não a variação.
    expect(r.assimetria_horizontal).toBe(0.04);
    expect(r.assimetria_vertical).toBe(0.01);
    expect(r.diagnostico).toBe("normal");
  });

  it("incomitante ou avaliação humana passam a 'requer_avaliacao'", () => {
    expect(paraRegistoScreening(INCOMITANTE).diagnostico).toBe("requer_avaliacao");
    expect(paraRegistoScreening({ ...RESPOSTA, requer_avaliacao_humana: true }).diagnostico).toBe("requer_avaliacao");
  });
});

describe("paraResultadoEcra", () => {
  it("normal, com a confiança da qualidade da captura", () => {
    const r = paraResultadoEcra(RESPOSTA, new Date("2026-09-30T10:00:00Z"));
    expect(r.diagnosis).toBe(DIAGNOSTICO_NORMAL);
    expect(r.confidence).toBe(87);
    expect(r.date).toBe("2026-09-30T10:00:00.000Z");
    expect(r.apiData.motilidade?.variacao_desalinhamento).toBe(1.4);
  });

  it("a precisar de avaliação quando a API o diz", () => {
    expect(paraResultadoEcra(INCOMITANTE).diagnosis).toBe(DIAGNOSTICO_AVALIACAO);
  });
});

describe("conclusaoDoRastreio", () => {
  it("lê a variação e a incomitância dentro de `motilidade` (no topo nunca vêm; caso real 2026-10-06)", () => {
    expect(variacaoDesalinhamento(RESPOSTA)).toBe(1.4);
    expect(incomitancia(INCOMITANTE)).toBe(true);
    expect(desalinhamentoEmFrente(RESPOSTA)).toBe(0.04);
    const semComparacao: ScreeningResponse = { ...RESPOSTA, motilidade: null };
    expect(variacaoDesalinhamento(semComparacao)).toBeNull();
    expect(incomitancia(semComparacao)).toBeNull();
  });

  it("com tudo fiável e comparado, um pedido de avaliação do serviço mantém-se (ex.: desvio igual em todas as direcções)", () => {
    const r: ScreeningResponse = {
      estado: "OK",
      posicoes: ["CENTRO", "ESQUERDA", "DIREITA"].map((posicao) => ({
        posicao,
        estado: "OK",
        rosto_detetado: true,
        utilizavel: true,
        qualidade_captura: { pontuacao: 0.9, fiavel: true },
      })),
      motilidade: { variacao_desalinhamento: 0.01, incomitante: false },
      requer_avaliacao_humana: true,
    };
    expect(conclusaoDoRastreio(DIAGNOSTICO_AVALIACAO, r)).toBe("avaliacao");
  });

  it("posição que não entrou na comparação (cabeça mexida) conta como fotografia fraca", () => {
    const r: ScreeningResponse = {
      estado: "QUALIDADE_INSUFICIENTE",
      posicoes: [
        { posicao: "CENTRO", estado: "OK", rosto_detetado: true, utilizavel: true, qualidade_captura: { pontuacao: 0.9, fiavel: true } },
        { posicao: "ESQUERDA", estado: "OK", rosto_detetado: true, utilizavel: false, motivos_invalidez: ["OLHAR_NAO_MUDOU"], qualidade_captura: { pontuacao: 0.9, fiavel: true } },
        { posicao: "DIREITA", estado: "OK", rosto_detetado: true, utilizavel: true, qualidade_captura: { pontuacao: 0.9, fiavel: true } },
      ],
      motilidade: null,
      requer_avaliacao_humana: true,
    };
    expect(conclusaoDoRastreio(DIAGNOSTICO_AVALIACAO, r)).toBe("inconclusivo");
  });

  it("avaliação pedida pela análise ganha a tudo, mesmo com fotografias fracas", () => {
    const fraca = { ...RESPOSTA, requer_avaliacao_humana: true };
    expect(conclusaoDoRastreio(DIAGNOSTICO_AVALIACAO, fraca)).toBe("avaliacao");
  });

  it("pedido de avaliação por não ter conseguido medir, com foto fraca, é inconclusivo (caso real 2026-10-06)", () => {
    const r: ScreeningResponse = {
      estado: "concluido",
      posicoes: [
        { posicao: "CENTRO", estado: "ok", rosto_detetado: true, qualidade_captura: { pontuacao: 0.74, fiavel: true } },
        { posicao: "ESQUERDA", estado: "ok", rosto_detetado: true, qualidade_captura: { pontuacao: 0.77, fiavel: true } },
        { posicao: "DIREITA", estado: "ok", rosto_detetado: true, qualidade_captura: { pontuacao: 0.39, fiavel: false } },
      ],
      requer_avaliacao_humana: true,
    };
    expect(conclusaoDoRastreio(DIAGNOSTICO_AVALIACAO, r)).toBe("inconclusivo");
  });

  it("sem medição mas com todas as fotos fiáveis, o pedido de avaliação mantém-se", () => {
    const r: ScreeningResponse = {
      estado: "concluido",
      posicoes: ["CENTRO", "DIREITA", "ESQUERDA"].map((posicao) => ({
        posicao,
        estado: "ok",
        rosto_detetado: true,
        qualidade_captura: { pontuacao: 0.9, fiavel: true },
      })),
      requer_avaliacao_humana: true,
    };
    expect(conclusaoDoRastreio(DIAGNOSTICO_AVALIACAO, r)).toBe("avaliacao");
  });

  it("incomitância detectada é avaliação, mesmo sem variação e com foto fraca", () => {
    const r: ScreeningResponse = { ...RESPOSTA, motilidade: { variacao_desalinhamento: null, incomitante: true } };
    expect(conclusaoDoRastreio(DIAGNOSTICO_AVALIACAO, r)).toBe("avaliacao");
  });

  it("sem avaliação mas com uma fotografia sem rosto é inconclusivo, nunca normal", () => {
    // RESPOSTA tem a posição DIREITA sem rosto detectado.
    expect(conclusaoDoRastreio(DIAGNOSTICO_NORMAL, RESPOSTA)).toBe("inconclusivo");
  });

  it("fotografia pouco fiável também é inconclusivo", () => {
    const r: ScreeningResponse = {
      ...RESPOSTA,
      posicoes: [{ posicao: "CENTRO", estado: "ok", rosto_detetado: true, qualidade_captura: { pontuacao: 0.3, fiavel: false } }],
    };
    expect(conclusaoDoRastreio(DIAGNOSTICO_NORMAL, r)).toBe("inconclusivo");
  });

  it("normal só com todas as fotografias fiáveis", () => {
    const r: ScreeningResponse = {
      ...RESPOSTA,
      posicoes: ["CENTRO", "DIREITA", "ESQUERDA"].map((posicao) => ({
        posicao,
        estado: "ok",
        rosto_detetado: true,
        qualidade_captura: { pontuacao: 0.9, fiavel: true },
      })),
    };
    expect(conclusaoDoRastreio(DIAGNOSTICO_NORMAL, r)).toBe("normal");
  });

  it("sem dados da análise: só o normal guardado é normal (as 4 categorias antigas contam como avaliação)", () => {
    expect(conclusaoDoRastreio(DIAGNOSTICO_NORMAL, null)).toBe("normal");
    expect(conclusaoDoRastreio("Esotropia", null)).toBe("avaliacao");
  });
});

describe("lerResultadoGuardado", () => {
  it("lê o que o rastreio guarda", () => {
    const r = lerResultadoGuardado(JSON.stringify(paraResultadoEcra(INCOMITANTE)));
    expect(r?.conclusao).toBe("avaliacao");
    expect(r?.analise?.motilidade?.variacao_desalinhamento).toBe(1.4);
  });

  it("vazio, estragado ou sem data dá null", () => {
    expect(lerResultadoGuardado(null)).toBeNull();
    expect(lerResultadoGuardado("{isto não é json")).toBeNull();
    expect(lerResultadoGuardado(JSON.stringify({ diagnosis: DIAGNOSTICO_NORMAL }))).toBeNull();
    expect(lerResultadoGuardado(JSON.stringify({ diagnosis: DIAGNOSTICO_NORMAL, date: "ontem" }))).toBeNull();
  });
});
