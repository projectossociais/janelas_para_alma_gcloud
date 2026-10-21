import { describe, it, expect, vi, afterEach } from "vitest";
import i18n from "@/i18n";
import {
  PERGUNTAS_OFFLINE_POR_PATAMAR,
  obterPerguntaOfflineNaoVista,
  obterPerguntaOfflinePorId,
  obterPerguntasDoPatamar,
  raridadeAlvo,
  type TextosPergunta,
} from "./perguntasOffline";
import { PERGUNTAS_OFFLINE_EN } from "./perguntasOffline.en-US";

const TOTAL_PATAMARES = 15;
const MINIMO_POR_PATAMAR = 15;

describe("perguntasOffline", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tem pelo menos 15 perguntas distintas para cada um dos 15 patamares", () => {
    for (let patamar = 1; patamar <= TOTAL_PATAMARES; patamar++) {
      const perguntas = obterPerguntasDoPatamar(patamar);
      expect(perguntas.length).toBeGreaterThanOrEqual(MINIMO_POR_PATAMAR);
      expect(new Set(perguntas.map((p) => p.id)).size).toBe(perguntas.length);
    }
  });

  it("todas as perguntas têm uma das 6 categorias oficiais, e todas as categorias aparecem", () => {
    const oficiais = [
      "anatomia_ocular",
      "doencas_estrabismo",
      "prevencao_cuidados",
      "estilo_vida_visao",
      "ciencia_ocular",
      "curiosidades_visuais",
    ];
    const todas = Object.values(PERGUNTAS_OFFLINE_POR_PATAMAR).flat();
    expect(todas.filter((p) => !oficiais.includes(p.categoria)).map((p) => p.id)).toEqual([]);
    expect(new Set(todas.map((p) => p.categoria))).toEqual(new Set(oficiais));
  });

  it("a versão inglesa herda a categoria pelo id", () => {
    i18n.changeLanguage("en-US");
    try {
      const original = obterPerguntasDoPatamar(1)[0];
      expect(obterPerguntaOfflinePorId(original.id)?.categoria).toBe(original.categoria);
    } finally {
      i18n.changeLanguage("pt-AO");
    }
  });

  it("nunca repete um id entre patamares diferentes", () => {
    const todosOsIds = Object.values(PERGUNTAS_OFFLINE_POR_PATAMAR).flatMap((perguntas) =>
      perguntas.map((p) => p.id)
    );
    expect(new Set(todosOsIds).size).toBe(todosOsIds.length);
  });

  it("distribui as respostas certas por A/B/C/D sem viés (nenhuma letra domina)", () => {
    const contagem = { A: 0, B: 0, C: 0, D: 0 };
    Object.values(PERGUNTAS_OFFLINE_POR_PATAMAR).forEach((perguntas) => {
      perguntas.forEach((p) => {
        contagem[p.resposta_correta] += 1;
      });
    });
    const total = Object.values(contagem).reduce((a, b) => a + b, 0);
    // Nenhuma letra deve responder por muito mais de 1/4 do total -- aqui
    // toleramos alguma folga, mas rejeitamos qualquer viés óbvio (ex.: "a
    // certa é sempre a B").
    Object.values(contagem).forEach((n) => {
      expect(n / total).toBeLessThan(0.35);
      expect(n).toBeGreaterThan(0);
    });
  });

  it("obterPerguntaOfflinePorId encontra uma pergunta em qualquer patamar", () => {
    const doPatamar7 = obterPerguntasDoPatamar(7)[2];
    expect(obterPerguntaOfflinePorId(doPatamar7.id)).toEqual(doPatamar7);
    expect(obterPerguntaOfflinePorId("id-que-nao-existe")).toBeUndefined();
  });

  it("obterPerguntaOfflineNaoVista nunca escolhe uma pergunta já vista, enquanto houver por ver", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const idsDoPatamar1 = obterPerguntasDoPatamar(1).map((p) => p.id);

    const vistos: string[] = [];
    for (let i = 0; i < idsDoPatamar1.length; i++) {
      const escolhida = obterPerguntaOfflineNaoVista(1, vistos);
      expect(vistos).not.toContain(escolhida.id);
      vistos.push(escolhida.id);
    }

    // as 5 escolhas, em conjunto, esgotaram exatamente a reserva do patamar.
    expect(new Set(vistos)).toEqual(new Set(idsDoPatamar1));
  });

  it("quando a reserva do patamar está esgotada, continua a devolver uma pergunta válida em vez de rebentar", () => {
    const idsDoPatamar1 = obterPerguntasDoPatamar(1).map((p) => p.id);

    const escolhida = obterPerguntaOfflineNaoVista(1, idsDoPatamar1);

    expect(idsDoPatamar1).toContain(escolhida.id);
  });

  it("lança um erro claro para um patamar sem reserva de contingência", () => {
    expect(() => obterPerguntaOfflineNaoVista(999, [])).toThrow(/patamar 999/);
  });
});

const palavras = (texto: string) => texto.trim().split(/\s+/).length;
const opcoes = (t: TextosPergunta) => [t.opcao_a, t.opcao_b, t.opcao_c, t.opcao_d];

describe("perguntasOffline -- dificuldade equilibrada", () => {
  const todas = Object.values(PERGUNTAS_OFFLINE_POR_PATAMAR).flat();
  const idiomas: [string, (id: string) => TextosPergunta][] = [
    ["pt", (id) => todas.find((p) => p.id === id)!],
    ["en", (id) => PERGUNTAS_OFFLINE_EN[id]],
  ];

  it.each(idiomas)("[%s] linguagem simples: pergunta até 20 palavras, opções até 8 e niveladas", (_, textos) => {
    const foraDaRegra = todas.flatMap((p) => {
      const t = textos(p.id);
      const ns = opcoes(t).map(palavras);
      const problemas = [];
      if (palavras(t.texto_pergunta) > 20) problemas.push("pergunta longa");
      if (Math.max(...ns) > 8) problemas.push("opção longa");
      if (Math.max(...ns) - Math.min(...ns) > 3) problemas.push(`opções desniveladas ${ns}`);
      return problemas.map((x) => `${p.id}: ${x}`);
    });
    expect(foraDaRegra).toEqual([]);
  });

  it.each(idiomas)("[%s] a resposta certa raramente é a opção mais comprida (sem pista visual)", (_, textos) => {
    const certaMaisLonga = todas.filter((p) => {
      const t = textos(p.id);
      const certa = t[`opcao_${p.resposta_correta.toLowerCase()}` as keyof TextosPergunta];
      return opcoes(t).every((o) => o === certa || o.length < certa.length);
    });
    // Ao acaso seria 1/4; acima de 40% já se nota.
    expect(certaMaisLonga.length / todas.length).toBeLessThanOrEqual(0.4);
  });

  it("a curva alvo vai de 1 a 5 e sobe sempre, devagar no início e mais depressa no fim", () => {
    expect(raridadeAlvo(1)).toBe(1);
    expect(raridadeAlvo(15)).toBeCloseTo(5, 10);
    const saltos = [];
    for (let n = 2; n <= 15; n++) saltos.push(raridadeAlvo(n) - raridadeAlvo(n - 1));
    saltos.forEach((s, i) => {
      expect(s).toBeGreaterThan(0);
      if (i > 0) expect(s).toBeGreaterThanOrEqual(saltos[i - 1]);
    });
  });

  it("cada patamar segue a curva: todas as perguntas no degrau do alvo e média a ±0,15", () => {
    for (let patamar = 1; patamar <= TOTAL_PATAMARES; patamar++) {
      const alvo = raridadeAlvo(patamar);
      const raridades = obterPerguntasDoPatamar(patamar).map((p) => p.raridade);
      raridades.forEach((r) => expect([Math.floor(alvo), Math.ceil(alvo)]).toContain(r));
      const media = raridades.reduce((a, b) => a + b, 0) / raridades.length;
      expect(Math.abs(media - alvo)).toBeLessThanOrEqual(0.15);
    }
  });
});
