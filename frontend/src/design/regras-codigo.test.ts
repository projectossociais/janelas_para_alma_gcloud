import { describe, expect, it } from "vitest";

/**
 * As regras de docs/SISTEMA_DESIGN.md que se podem verificar por máquina,
 * aplicadas a todo o código do sistema de design. Uma regra que só existe num
 * documento acaba esquecida.
 *
 * Fora desta verificação, de propósito: os tokens e a marca (são o sítio onde
 * as cores vivem) e os testes.
 */
const fontes = import.meta.glob(
  [
    "/src/design/**/*.{ts,tsx}",
    "!/src/design/**/*.test.{ts,tsx}",
    "!/src/design/tokens.ts",
    "!/src/design/marca/marca.ts",
    "!/src/design/contraste.ts",
  ],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const REGRAS: { nome: string; padrao: RegExp; excepto?: RegExp }[] = [
  { nome: "cor hexadecimal escrita à mão (usar um token)", padrao: /#[0-9a-fA-F]{3,8}\b/ },
  {
    nome: "valor arbitrário do Tailwind com cor ou tamanho (usar a escala)",
    padrao: /\b(?:bg|text|border|ring|outline|fill|stroke|shadow|from|to|via|p[xytrbl]?|m[xytrbl]?|gap|w|h|min-w|min-h|max-w|max-h|rounded|leading|tracking|top|left|right|bottom|inset)-\[[^\]]+\]/,
  },
  {
    nome: "classe do sistema antigo (shadcn/Lovable), que não é deste sistema",
    padrao: /\b(?:bg|text|border|ring)-(?:primary|secondary|muted|accent|destructive|foreground|background|card|popover|navy|teal|gold|sky|green)\b/,
  },
  {
    nome: "motion.* completo (dentro do ProvedorMovimento usa-se m.*)",
    padrao: /\bmotion\.[a-z]+\b/,
    excepto: /from "motion\/react"/,
  },
];

describe("regras de código do sistema de design", () => {
  it("há ficheiros para verificar", () => {
    expect(Object.keys(fontes).length).toBeGreaterThan(0);
  });

  for (const regra of REGRAS) {
    it(`sem ${regra.nome}`, () => {
      const achados: string[] = [];
      for (const [ficheiro, codigo] of Object.entries(fontes)) {
        codigo
          .replace(/\r\n/g, "\n")
          .split("\n")
          .forEach((linha, i) => {
            const t = linha.trim();
            if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
            if (regra.excepto?.test(linha)) return;
            if (regra.padrao.test(linha)) achados.push(`${ficheiro}:${i + 1}  ${t.slice(0, 90)}`);
          });
      }
      expect(achados).toEqual([]);
    });
  }
});
