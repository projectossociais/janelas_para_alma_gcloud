import { describe, expect, it } from "vitest";
import type { SessaoParaRelatorio } from "./progresso";
import { DIAS_RESUMO_CLINICO, resumoClinico, temMedicoes } from "./resumoClinico";

const hoje = new Date(2026, 9, 21, 18);
const haDias = (n: number, hora = 10) => new Date(2026, 9, 21 - n, hora).toISOString();

const sessao = (o: Partial<SessaoParaRelatorio>): SessaoParaRelatorio => ({
  exercicio_id: "figure8",
  created_at: haDias(0),
  segundos_activos: 60,
  olho: "direito",
  limiar: 0.3,
  unidade: "logmar",
  calibrado: true,
  distancia_mm: 400,
  sinais: { aglomeracao: true, distancia_medida: true },
  ...o,
});

/** Um teste de acuidade grava uma sessão por olho. */
const acuidade = (dias: number, direito: number | null, esquerdo: number | null, sinais?: Record<string, unknown>) => [
  sessao({ created_at: haDias(dias), olho: "direito", limiar: direito, ...(sinais && { sinais }) }),
  sessao({ created_at: haDias(dias), olho: "esquerdo", limiar: esquerdo, ...(sinais && { sinais }) }),
];

const pontes = (dias: number, conv: number | null, div: number | null) => {
  const sentido = (rotura: number | null) =>
    rotura === null
      ? { rampas: 0, semFusao: 0, rotura: null, recuperacao: null, limiteEcra: false, maximo: null }
      : { rampas: 2, semFusao: 0, rotura, recuperacao: rotura - 4, limiteEcra: false, maximo: 30 };
  return sessao({
    exercicio_id: "convergence",
    created_at: haDias(dias),
    olho: "ambos",
    limiar: conv ?? div,
    unidade: "dioptrias_prismaticas",
    sinais: {
      pontes: { convergencia: sentido(conv), divergencia: sentido(div) },
      distancia_medida: true,
      oculos_verificados: true,
      oculos_afinados: true,
    },
  });
};

const kianda = (dias: number, sustentado: number | null, extra: Record<string, unknown> = {}) =>
  sessao({
    exercicio_id: "ambliopia",
    created_at: haDias(dias),
    olho: "ambos",
    limiar: sustentado,
    unidade: "razao_contraste",
    segundos_activos: 600,
    sinais: { modo: "dicoptico", olho_fraco: "esquerdo", orientacao_graus: 12, ...extra },
  });

describe("acuidade (Olhos de Palanca)", () => {
  it("mais recente e primeira por olho, e a diferença em linhas", () => {
    const r = resumoClinico([...acuidade(20, 0.5, 0.1), ...acuidade(10, 0.4, 0.1), ...acuidade(0, 0.3, 0.1)], hoje);
    expect(r.acuidade?.recente.valor).toEqual({ direito: 0.3, esquerdo: 0.1 });
    expect(r.acuidade?.primeira?.valor).toEqual({ direito: 0.5, esquerdo: 0.1 });
    expect(r.acuidade?.primeira?.data).toBe(haDias(20));
    expect(r.acuidade?.diferencaLinhas).toBe(2);
    expect(r.acuidade?.tipo).toBe("barras");
    expect(r.acuidade?.condicoes).toMatchObject({ dias: 3, distanciaMm: 400, distanciaMedida: true, calibrado: true });
  });

  it("uma só medição: sem primeira", () => {
    const r = resumoClinico(acuidade(0, 0.3, 0.1), hoje);
    expect(r.acuidade?.primeira).toBeNull();
  });

  it("não ler o maior tamanho conta como resultado (null), sem diferença em linhas", () => {
    const r = resumoClinico(acuidade(0, null, 0.1, { aglomeracao: true, nao_leu_o_maior: true }), hoje);
    expect(r.acuidade?.recente.valor).toEqual({ direito: null, esquerdo: 0.1 });
    expect(r.acuidade?.diferencaLinhas).toBeNull();
  });

  it("depois das barras, as sessões sem barras não são a primeira", () => {
    const r = resumoClinico([...acuidade(30, 0.1, 0.1, {}), ...acuidade(0, 0.3, 0.1)], hoje);
    expect(r.acuidade?.primeira).toBeNull();
    expect(r.acuidade?.tipo).toBe("barras");
  });

  it("sessões de baixa atenção e de fora dos 90 dias ficam de fora", () => {
    const r = resumoClinico(
      [
        ...acuidade(DIAS_RESUMO_CLINICO + 1, 0.9, 0.9),
        ...acuidade(5, 0.8, 0.8, { aglomeracao: true, baixa_atencao: true }),
        ...acuidade(0, 0.3, 0.1),
      ],
      hoje,
    );
    expect(r.acuidade?.primeira).toBeNull();
    expect(r.acuidade?.condicoes.dias).toBe(1);
  });
});

describe("estereopsia e contraste", () => {
  it("estereoacuidade em segundos de arco; null = não viu a forma", () => {
    const est = (dias: number, limiar: number | null) =>
      sessao({
        exercicio_id: "estereopsia",
        created_at: haDias(dias),
        olho: "ambos",
        limiar,
        unidade: "arcsec",
        sinais: { oculos_verificados: true, oculos_afinados: false, distancia_medida: false },
      });
    const r = resumoClinico([est(9, null), est(1, 200)], hoje);
    expect(r.estereopsia?.recente.valor).toBe(200);
    expect(r.estereopsia?.primeira?.valor).toBeNull();
    expect(r.estereopsia?.condicoes).toMatchObject({ oculosVerificados: true, oculosAfinados: false, distanciaMedida: false });
  });

  it("contraste por olho em log CS", () => {
    const c = (olho: string, limiar: number) =>
      sessao({ exercicio_id: "cerebro", olho, limiar, unidade: "log_cs", sinais: {} });
    const r = resumoClinico([c("direito", 1.5), c("esquerdo", 1.2)], hoje);
    expect(r.contraste?.recente.valor).toEqual({ direito: 1.5, esquerdo: 1.2 });
    expect(r.contraste?.condicoes.oculosVerificados).toBeNull();
  });
});

describe("vergência (Pontes de Fusão)", () => {
  it("cada sentido com a sua sessão mais recente e a primeira", () => {
    const r = resumoClinico([pontes(14, 10, 6), pontes(7, 12, null), pontes(0, 14, null)], hoje);
    expect(r.vergencia?.sentidos.convergencia?.recente.valor.rotura).toBe(14);
    expect(r.vergencia?.sentidos.convergencia?.primeira?.valor.rotura).toBe(10);
    // A divergência só se mediu uma vez, há 14 dias.
    expect(r.vergencia?.sentidos.divergencia?.recente.data).toBe(haDias(14));
    expect(r.vergencia?.sentidos.divergencia?.primeira).toBeNull();
    expect(r.vergencia?.condicoes).toMatchObject({ dias: 3, oculosVerificados: true, distanciaMm: 400 });
  });

  it("o Treino de Convergência antigo (auto-avaliação, em segundos) não entra", () => {
    const antiga = sessao({ exercicio_id: "convergence", olho: "ambos", limiar: 42, unidade: "segundos", sinais: {} });
    expect(resumoClinico([antiga], hoje).vergencia).toBeNull();
  });

  it("sinais estragados não rebentam o relatório", () => {
    const estragada = sessao({
      exercicio_id: "convergence",
      olho: "ambos",
      unidade: "dioptrias_prismaticas",
      sinais: { pontes: { convergencia: "x", divergencia: null } },
    });
    expect(resumoClinico([estragada], hoje).vergencia).toBeNull();
  });
});

describe("Kianda", () => {
  it("contraste do olho forte tolerado, primeiro e mais recente, e o olho treinado", () => {
    const r = resumoClinico([kianda(20, 0.2), kianda(10, null), kianda(0, 0.4)], hoje);
    expect(r.kianda?.recente.valor).toEqual({ sustentado: 0.4, orientacao: 12 });
    expect(r.kianda?.primeira?.valor.sustentado).toBe(0.2);
    expect(r.kianda?.olhoFraco).toBe("esquerdo");
  });

  it("o modo com tapa-olho (anéis, logMAR) não é o treino dicóptico", () => {
    const aneis = sessao({ exercicio_id: "ambliopia", olho: "esquerdo", unidade: "logmar", sinais: {} });
    expect(resumoClinico([aneis], hoje).kianda).toBeNull();
  });

  it("visão dupla relatada aparece mesmo numa sessão de baixa atenção", () => {
    const r = resumoClinico([kianda(3, 0.3, { diplopia_reportada: true, baixa_atencao: true }), kianda(0, 0.4)], hoje);
    expect(r.diplopia).toEqual([haDias(3)]);
    expect(r.kianda?.primeira).toBeNull();
  });
});

describe("Kianda com tapa-olho e Olho Mágico (sem óculos)", () => {
  const pesca = (dias: number, graus: number | null, nivel: number) =>
    sessao({
      exercicio_id: "ambliopia",
      created_at: haDias(dias),
      olho: "esquerdo",
      limiar: graus,
      unidade: "graus",
      segundos_activos: 360,
      sinais: { modo: "tapa_olho", nivel },
    });

  it("inclinação que o olho fraco distingue, primeira e mais recente, e o olho treinado", () => {
    const r = resumoClinico([pesca(12, 30, 1), pesca(0, 14, 3)], hoje);
    expect(r.pesca?.recente.valor).toEqual({ graus: 14, nivel: 3 });
    expect(r.pesca?.primeira?.valor.graus).toBe(30);
    expect(r.pesca?.olho).toBe("esquerdo");
    expect(r.kianda).toBeNull(); // o dicóptico é outra medida
    expect(temMedicoes(r)).toBe(true);
  });

  it("as Pontes medem com óculos; o Olho Mágico sem: o relatório diz qual foi a mais recente", () => {
    const olhoMagico = { ...pontes(0, 12, null), sinais: { ...pontes(0, 12, null).sinais, modo: "fusao_livre", oculos_verificados: undefined } };
    expect(resumoClinico([pontes(5, 10, 6), olhoMagico], hoje).vergencia?.fusaoLivre).toBe(true);
    expect(resumoClinico([olhoMagico, pontes(0, 10, 6)].map((s, i) => ({ ...s, created_at: haDias(5 - i * 5) })), hoje).vergencia?.fusaoLivre).toBe(false);
  });
});

describe("Luz nos Olhos (exame dos pais)", () => {
  it("desvio pelo reflexo, teste de tapar e diário, primeiro e mais recente", () => {
    const luz = (dias: number, delta: number) =>
      sessao({
        exercicio_id: "relax",
        created_at: haDias(dias),
        olho: "ambos",
        limiar: delta,
        unidade: "dioptrias_prismaticas",
        sinais: {
          modo: "luz_olhos",
          achados: delta ? [{ olho: "esquerdo", sentido: "dentro", mm: delta / 15, delta }] : [],
          desvio_tapar: [{ olho: "esquerdo", sentido: "dentro" }, { olho: "x", sentido: 3 }],
          diario: { frequencia: "as_vezes" },
        },
      });
    const r = resumoClinico([luz(14, 30), luz(0, 20)], hoje);
    expect(r.luz?.recente.valor).toEqual({
      delta: 20,
      reflexo: [{ olho: "esquerdo", sentido: "dentro", delta: 20 }],
      tapar: [{ olho: "esquerdo", sentido: "dentro" }],
      frequencia: "as_vezes",
    });
    expect(r.luz?.primeira?.valor.delta).toBe(30);
    expect(r.astigmatismo).toBeNull();
  });
});

describe("Fio de Missangas", () => {
  it("ponto mais próximo em cm, X no sítio e supressão", () => {
    const fio = (dias: number, cm: number | null, supressao: boolean) =>
      sessao({ exercicio_id: "cerebro", created_at: haDias(dias), olho: "ambos", limiar: cm, unidade: "cm", sinais: { modo: "fio_missangas", supressao, x_no_sitio: 2 } });
    const r = resumoClinico([fio(10, 12, true), fio(0, 7, false)], hoje);
    expect(r.fio?.recente.valor).toEqual({ ppcCm: 7, supressao: false, xNoSitio: 2 });
    expect(r.fio?.primeira?.valor).toEqual({ ppcCm: 12, supressao: true, xNoSitio: 2 });
    expect(r.contraste).toBeNull();
  });
});

describe("Caderneta do Tapa-olho", () => {
  it("horas de tapa-olho na semana, sem entrar nos minutos de treino", () => {
    const tapa = (dias: number, minutos: number) =>
      sessao({
        exercicio_id: "flexibilidade-acomodativa",
        created_at: haDias(dias),
        olho: "esquerdo",
        limiar: null,
        unidade: null,
        segundos_activos: minutos * 60,
        sinais: { modo: "tapa_olho_horas", alvo_min: 120 },
      });
    const r = resumoClinico([tapa(1, 120), tapa(0, 60)], hoje);
    expect(r.tapaOlho).toMatchObject({ alvoMin: 120, cumpridos: 1, mediaMin: 26 });
    expect(r.adesao.minutosPorSemana).toEqual([0, 0, 0, 0]);
    expect(resumoClinico([], hoje).tapaOlho).toBeNull();
  });
});

describe("adesão ao treino", () => {
  it("minutos por semana nas últimas 4, dias com treino e sessões de baixa atenção", () => {
    const r = resumoClinico(
      [
        kianda(25, 0.2), // semana 1: 10 min
        kianda(2, 0.3), // semana 4
        kianda(1, 0.3),
        kianda(0, 0.3, { baixa_atencao: true }), // não conta
        kianda(40, 0.2), // fora das 4 semanas
        ...acuidade(0, 0.3, 0.1), // testes não são treino
      ],
      hoje,
    );
    expect(r.adesao.minutosPorSemana).toEqual([10, 0, 0, 20]);
    expect(r.adesao.diasComTreino).toBe(3);
    expect(r.adesao.sessoesBaixaAtencao).toBe(1);
  });

  it("uma sessão de segundos não desaparece no arredondamento", () => {
    const r = resumoClinico([sessao({ ...kianda(0, null), segundos_activos: 12 })], hoje);
    expect(r.adesao.minutosPorSemana[3]).toBe(0.2);
    expect(r.adesao.diasComTreino).toBe(1);
  });

  it("sem sessões: nada medido e zero minutos", () => {
    const r = resumoClinico([], hoje);
    expect(temMedicoes(r)).toBe(false);
    expect(r.adesao.minutosPorSemana).toEqual([0, 0, 0, 0]);
  });
});
