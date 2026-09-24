import { describe, it, expect, afterEach } from "vitest";
import i18n from "@/i18n";
import { PERGUNTAS_OFFLINE_POR_PATAMAR, noIdiomaActual, obterPerguntaOfflinePorId } from "./perguntasOffline";
import { PERGUNTAS_OFFLINE_EN } from "./perguntasOffline.en-US";

const TODAS = Object.values(PERGUNTAS_OFFLINE_POR_PATAMAR).flat();
const CAMPOS = ["texto_pergunta", "opcao_a", "opcao_b", "opcao_c", "opcao_d", "explicacao"] as const;

describe("perguntasOffline em inglês (en-US)", () => {
  afterEach(() => void i18n.changeLanguage("pt-AO"));

  it("todas as perguntas portuguesas têm tradução completa, e não há traduções órfãs", () => {
    const semTraducao = TODAS.filter((p) => CAMPOS.some((c) => !PERGUNTAS_OFFLINE_EN[p.id]?.[c]?.trim())).map((p) => p.id);
    expect(semTraducao).toEqual([]);
    const ids = new Set(TODAS.map((p) => p.id));
    expect(Object.keys(PERGUNTAS_OFFLINE_EN).filter((id) => !ids.has(id))).toEqual([]);
  });

  it("nenhum texto inglês tem acentuação ou palavras portuguesas", () => {
    const PT = /[ãõçáàâéêíóôú]|\b(que|não|olho|olhos|visão|uma|dos|das|pelo|pela|entre|sempre)\b/i;
    const comPortugues = Object.entries(PERGUNTAS_OFFLINE_EN)
      .flatMap(([id, t]) => CAMPOS.filter((c) => PT.test(t[c])).map((c) => `${id}.${c}: ${t[c]}`));
    expect(comPortugues).toEqual([]);
  });

  it("em inglês devolve os textos traduzidos, com o mesmo id e a mesma resposta certa", () => {
    void i18n.changeLanguage("en-US");
    const pergunta = obterPerguntaOfflinePorId("offline-1-1")!;
    expect(pergunta.texto_pergunta).toBe("What is strabismus, in simple terms?");
    expect(pergunta.id).toBe("offline-1-1");
    expect(pergunta.resposta_correta).toBe("C");
  });

  it("em português fica tudo como está", () => {
    const original = TODAS[0];
    expect(noIdiomaActual(original)).toBe(original);
    expect(obterPerguntaOfflinePorId("offline-1-1")!.texto_pergunta).toBe("O que é o estrabismo, em termos simples?");
  });

  // Erro clínico corrigido: um ângulo kappa negativo põe o reflexo do lado
  // temporal e simula uma ESOtropia (o banco dava exotropia como certa).
  it("offline-14-14: a resposta certa é a esotropia, nos dois idiomas", () => {
    const pt = obterPerguntaOfflinePorId("offline-14-14")!;
    expect(pt.resposta_correta).toBe("B");
    expect(pt.opcao_b).toMatch(/^Uma esotropia/);
    void i18n.changeLanguage("en-US");
    expect(obterPerguntaOfflinePorId("offline-14-14")!.opcao_b).toMatch(/^An esotropia/);
  });
});
