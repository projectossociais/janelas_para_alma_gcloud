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
    // O código novo do site, feito com o sistema de design, segue as mesmas regras.
    "/src/components/site/**/*.{ts,tsx}",
    "/src/components/inicio/**/*.{ts,tsx}",
    "/src/pages/Inicio.tsx",
    "/src/pages/Scanner.tsx",
    "/src/pages/ScannerResultados.tsx",
    "/src/lib/rastreio/relatorioRastreio.ts",
    "/src/hooks/useCameraRastreio.ts",
    "/src/lib/rastreio/rastreio.ts",
    "!/src/design/**/*.test.{ts,tsx}",
    "!/src/components/site/**/*.test.{ts,tsx}",
    "!/src/components/inicio/**/*.test.{ts,tsx}",
    "!/src/design/tokens.ts",
    "!/src/design/marca/marca.ts",
    "!/src/design/contraste.ts",
  ],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const REGRAS: { id: string; nome: string; padrao: RegExp; excepto?: RegExp }[] = [
  { id: "hex", nome: "cor hexadecimal escrita à mão (usar um token)", padrao: /#[0-9a-fA-F]{3,8}\b/ },
  {
    id: "arbitrario",
    nome: "valor arbitrário do Tailwind com cor ou tamanho (usar a escala)",
    padrao: /\b(?:bg|text|border|ring|outline|fill|stroke|shadow|from|to|via|p[xytrbl]?|m[xytrbl]?|gap|w|h|min-w|min-h|max-w|max-h|rounded|leading|tracking|top|left|right|bottom|inset)-\[[^\]]+\]/,
  },
  {
    id: "antigo",
    nome: "classe do sistema antigo (shadcn/Lovable), que não é deste sistema",
    padrao: /\b(?:bg|text|border|ring)-(?:primary|secondary|muted|accent|destructive|foreground|background|card|popover|navy|teal|gold|sky|green)\b/,
  },
  {
    id: "dinamica",
    nome: "classe do Tailwind montada com texto dinâmico (o Tailwind não a gera; escrever por inteiro)",
    padrao: /`[^`]*\b(?:text|bg|border|rounded|shadow|p|m|w|h|gap|min-h|min-w)-\$\{/,
  },
  {
    id: "cn",
    nome: "o cn genérico (@/lib/utils), que não conhece os nomes do sistema (usar ./cn)",
    padrao: /from "@\/lib\/utils"/,
  },
  {
    id: "motion",
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

// As guardas também se testam: uma expressão regular partida deixaria passar tudo.
describe("as regras apanham o que devem e só isso", () => {
  const casos: [string, string, string][] = [
    ["hex", 'style={{ color: "#0064A8" }}', 'className="text-accao"'],
    ["arbitrario", 'className="text-[17px]"', 'className="text-corpo"'],
    ["antigo", 'className="bg-primary"', 'className="bg-accao"'],
    ["dinamica", "cn(`text-${nome}`)", 'cn("text-corpo")'],
    ["cn", 'import { cn } from "@/lib/utils";', 'import { cn } from "../cn";'],
    ["motion", "<motion.div />", "<m.div />"],
  ];
  it("cada regra tem um caso de teste", () => {
    expect(casos.map(([id]) => id).sort()).toEqual(REGRAS.map((r) => r.id).sort());
  });

  for (const [id, errado, certo] of casos) {
    it(id, () => {
      const regra = REGRAS.find((r) => r.id === id);
      expect(regra, `regra "${id}"`).toBeDefined();
      expect(regra!.padrao.test(errado)).toBe(true);
      expect(regra!.padrao.test(certo)).toBe(false);
    });
  }
});
