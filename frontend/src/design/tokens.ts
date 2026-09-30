/**
 * Tokens do sistema de design: a fonte única de cor, letra, espaço, forma e
 * movimento (docs/SISTEMA_DESIGN.md §3). Direcção A · Clínica, escolhida pelo
 * dono do projecto a 2026-09-30, com as cores do manual da marca
 * (docs/MARCA.md) e as regras de conforto visual (docs/PESQUISA_UX.md §3).
 *
 * Daqui sai:
 * - `tokens.css` (variáveis CSS), gerado por `npm run tokens`. Um teste falha
 *   se o ficheiro não estiver em dia com este;
 * - o tema do Tailwind (`temaTailwind`), lido por `tailwind.config.ts`.
 *
 * Nomes em português, para não colidirem com os do site antigo (`--primary`,
 * `bg-primary`...), que continua a funcionar até cada página migrar.
 */
import { MARCA } from "./marca/marca";

// ---------------------------------------------------------------------------
// Camada 2 · Cores semânticas. Só estas chegam aos componentes.
// ---------------------------------------------------------------------------

export type Tema = "claro" | "escuro";

export const NOMES_COR = [
  // Fundos, do mais baixo ao mais alto
  "fundo",
  "superficie",
  "superficie-alt",
  "superficie-elevada",
  // Texto
  "tinta",
  "tinta-suave",
  // Linhas: decorativa (separadores) e de controlo (contorno de campos, 3:1)
  "linha",
  "linha-forte",
  // Acção (botões principais, ligações, selecção)
  "accao",
  "accao-forte",
  "sobre-accao",
  "accao-suave",
  // Acento (turquesa do símbolo): sinais pequenos, nunca texto sobre claro
  "acento",
  "sobre-acento",
  // Palavra em destaque nos títulos grandes
  "destaque",
  // Estados: sempre com ícone e texto, nunca só a cor
  "sucesso",
  "sucesso-suave",
  "aviso",
  "aviso-suave",
  "erro",
  "sobre-erro",
  "erro-suave",
  // Anel de foco do teclado
  "foco",
] as const;

export type NomeCor = (typeof NOMES_COR)[number];
export type Paleta = Record<NomeCor, string>;

// Tons derivados da paleta da marca (docs/MARCA.md §3: permitidos para
// superfícies, linhas e texto secundário; nenhuma cor de marca nova).
export const CORES: Record<Tema, Paleta> = {
  claro: {
    fundo: "#F5F8FC",
    superficie: "#FFFFFF",
    "superficie-alt": "#EDF3FA",
    "superficie-elevada": "#FFFFFF",
    tinta: MARCA.marinho,
    "tinta-suave": "#3E5474",
    linha: "#D8E2ED",
    "linha-forte": "#7788A0",
    accao: MARCA.azul,
    "accao-forte": "#004E84",
    "sobre-accao": "#FFFFFF",
    "accao-suave": "#E3EEF9",
    acento: MARCA.turquesa,
    "sobre-acento": MARCA.marinho,
    destaque: MARCA.azul,
    sucesso: MARCA.verde,
    "sucesso-suave": "#E4F1EA",
    aviso: "#6E5300",
    "aviso-suave": "#FBF3D5",
    erro: "#B42318",
    "sobre-erro": "#FFFFFF",
    "erro-suave": "#FDECEA",
    foco: MARCA.azul,
  },
  escuro: {
    fundo: "#00132E",
    superficie: MARCA.marinho,
    "superficie-alt": "#0B2E63",
    "superficie-elevada": "#123A70",
    tinta: "#DCE5EF",
    "tinta-suave": "#AFC2D9",
    linha: "#1D3D6B",
    "linha-forte": "#6F8BB0",
    accao: MARCA.azulClaro,
    "accao-forte": "#C4E3FD",
    "sobre-accao": "#00132E",
    "accao-suave": "#0E3566",
    acento: MARCA.turquesa,
    "sobre-acento": "#00132E",
    destaque: MARCA.azulClaro,
    sucesso: "#86D6B3",
    "sucesso-suave": "#0D3A38",
    aviso: "#EBCF6B",
    "aviso-suave": "#3A3212",
    erro: "#FF9D8F",
    "sobre-erro": "#2A0906",
    "erro-suave": "#4A1A17",
    foco: MARCA.azulClaro,
  },
};

// ---------------------------------------------------------------------------
// Letra, espaço, forma, sombra e movimento (iguais nos dois temas)
// ---------------------------------------------------------------------------

export const LETRA = {
  familia: "'Ubuntu', system-ui, -apple-system, 'Segoe UI', sans-serif",
} as const;

/**
 * Escala de tipo fechada (SISTEMA_DESIGN §3): texto corrido nunca abaixo de
 * 17 px. `abertura` é fluido, para títulos de abertura no telemóvel e no
 * computador. [tamanho, entrelinha, espaçamento entre letras, peso].
 */
export const ESCALA_TIPO = {
  legenda: ["0.875rem", "1.45", "0", "400"],
  corpo: ["1.0625rem", "1.6", "0", "400"],
  "corpo-g": ["1.25rem", "1.55", "0", "400"],
  "titulo-p": ["1.5rem", "1.3", "-0.01em", "500"],
  "titulo-m": ["2rem", "1.2", "-0.015em", "500"],
  "titulo-g": ["3rem", "1.1", "-0.02em", "500"],
  abertura: ["clamp(2.5rem, 1.6rem + 3.6vw, 4.5rem)", "1.05", "-0.025em", "500"],
} as const;


export const RAIO = {
  // Caixas de selecção: quadradas de cantos suaves. Um círculo leria como rádio.
  pequeno: "6px",
  controlo: "12px",
  cartao: "16px",
  pilula: "999px",
} as const;

/** Sombras raras e suaves; no escuro a elevação é a cor da superfície. */
export const SOMBRA: Record<Tema, { "1": string; "2": string }> = {
  claro: {
    "1": "0 1px 2px rgb(0 33 81 / 0.06), 0 4px 16px -8px rgb(0 33 81 / 0.10)",
    "2": "0 2px 6px rgb(0 33 81 / 0.08), 0 16px 40px -16px rgb(0 33 81 / 0.22)",
  },
  escuro: { "1": "none", "2": "0 16px 40px -16px rgb(0 0 0 / 0.55)" },
};

/** Alturas mínimas de alvo de toque (WCAG 2.5.8 e acima; PESQUISA_UX §3). */
export const ALVO = { app: "44px", consola: "32px", crianca: "72px" } as const;

// ---------------------------------------------------------------------------
// Geração do CSS e do tema do Tailwind
// ---------------------------------------------------------------------------

/** "#0064A8" -> "0 100 168", para o Tailwind aplicar opacidade (`bg-accao/10`). */
export function canais(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

const blocoCores = (tema: Tema, recuo: string) =>
  NOMES_COR.map((nome) => `${recuo}--cor-${nome}: ${canais(CORES[tema][nome])};`).join("\n");

const blocoSombras = (tema: Tema, recuo: string) =>
  Object.entries(SOMBRA[tema])
    .map(([n, v]) => `${recuo}--sombra-${n}: ${v};`)
    .join("\n");

export function gerarCss(): string {
  const comuns = [
    `  --letra: ${LETRA.familia};`,
    ...Object.entries(RAIO).map(([n, v]) => `  --raio-${n}: ${v};`),
    ...Object.entries(ALVO).map(([n, v]) => `  --alvo-${n}: ${v};`),
    "  --duracao-feedback: 100ms;",
    "  --duracao-transicao: 250ms;",
    "  --duracao-entrada: 400ms;",
    "  --curva-padrao: cubic-bezier(0.2, 0, 0, 1);",
  ].join("\n");
  const escuro = (recuo: string) => [blocoCores("escuro", recuo), blocoSombras("escuro", recuo)].join("\n");
  return [
    "/* GERADO por `npm run tokens` a partir de src/design/tokens.ts. Não editar à mão. */",
    "",
    ":root {",
    "  color-scheme: light;",
    blocoCores("claro", "  "),
    blocoSombras("claro", "  "),
    comuns,
    "}",
    "",
    "/* Tema escuro: o do sistema, salvo escolha explícita da pessoa. */",
    "@media (prefers-color-scheme: dark) {",
    '  :root:not([data-tema="claro"]) {',
    "    color-scheme: dark;",
    escuro("    "),
    "  }",
    "}",
    "",
    ':root[data-tema="escuro"] {',
    "  color-scheme: dark;",
    escuro("  "),
    "}",
    "",
    "/* Zona escura dentro de uma página clara (ex.: uma faixa marinho no Site). */",
    ".tema-escuro {",
    "  color-scheme: dark;",
    escuro("  "),
    "}",
    "",
  ].join("\n");
}

/** Só a camada semântica chega ao Tailwind (SISTEMA_DESIGN §3). */
export const temaTailwind = {
  colors: Object.fromEntries(NOMES_COR.map((n) => [n, `rgb(var(--cor-${n}) / <alpha-value>)`])),
  fontSize: Object.fromEntries(
    Object.entries(ESCALA_TIPO).map(([n, [tamanho, entrelinha, espacamento, peso]]) => [
      n,
      [tamanho, { lineHeight: entrelinha, letterSpacing: espacamento, fontWeight: peso }],
    ]),
  ),
  borderRadius: Object.fromEntries(Object.keys(RAIO).map((n) => [n, `var(--raio-${n})`])),
  boxShadow: {
    "nivel-1": "var(--sombra-1)",
    "nivel-2": "var(--sombra-2)",
    // Reforça o contorno de um campo com erro sem mudar a largura da borda.
    "contorno-erro": "0 0 0 1px rgb(var(--cor-erro))",
  },
  minHeight: Object.fromEntries(Object.keys(ALVO).map((n) => [`alvo-${n}`, `var(--alvo-${n})`])),
  minWidth: Object.fromEntries(Object.keys(ALVO).map((n) => [`alvo-${n}`, `var(--alvo-${n})`])),
  // Margem para a barra do iPhone (zona segura): pelo menos 1rem.
  spacing: { "seguro-inferior": "max(1rem, env(safe-area-inset-bottom))" },
  transitionDuration: { feedback: "100ms", transicao: "250ms", entrada: "400ms" },
  transitionTimingFunction: { padrao: "cubic-bezier(0.2, 0, 0, 1)" },
} as const;
