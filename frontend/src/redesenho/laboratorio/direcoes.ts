/**
 * Laboratório de identidade (Sprint 7, Fase 1 -- docs/REDESENHO_FRONTEND.md):
 * três direcções visuais completas, em código, para o dono do projecto
 * escolher com os olhos. Só existe em desenvolvimento (`/_laboratorio`).
 *
 * Cada direcção define tokens (cor, forma, letra, movimento) para os dois
 * temas. A direcção escolhida passa depois a ser o design system do site.
 */

export type IdDireccao = "clara" | "viva" | "humana";
export type Tema = "claro" | "escuro";

export interface Paleta {
  fundo: string;
  superficie: string;
  superficieAlt: string;
  tinta: string;
  tintaSuave: string;
  primaria: string;
  sobrePrimaria: string;
  acento: string;
  sobreAcento: string;
  linha: string;
  sucesso: string;
}

export interface Direccao {
  id: IdDireccao;
  nome: string;
  ideia: string;
  paraQuem: string;
  letraTitulo: string;
  letraTexto: string;
  pesoTitulo: number;
  espacamentoTitulo: string;
  raio: string;
  raioBotao: string;
  /**
   * Mola das animações: rígida e rápida (viva) ou suave (clara). Sempre com
   * amortecimento perto do crítico (damping ≈ 2·√stiffness), nunca a ressaltar.
   */
  mola: { stiffness: number; damping: number };
  cores: Record<Tema, Paleta>;
  titulo: string;
  subtitulo: string;
}

export const FONTES_GOOGLE =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400",
    "family=Bricolage+Grotesque:opsz,wght@12..96,400..800",
    "family=Inter:wght@400..700",
    "family=Fraunces:opsz,wght@9..144,400..700",
    "family=Figtree:wght@400..700",
  ].join("&") +
  "&display=swap";

export const DIRECCOES: Record<IdDireccao, Direccao> = {
  clara: {
    id: "clara",
    nome: "A · Clara",
    ideia:
      "A legibilidade é a marca. Letra Atkinson Hyperlegible, desenhada para pessoas com baixa visão; muito espaço, calma, anéis que lembram a íris a focar.",
    paraQuem: "Pais preocupados e profissionais de saúde: transmite rigor e tranquilidade.",
    letraTitulo: "'Atkinson Hyperlegible', system-ui, sans-serif",
    letraTexto: "'Atkinson Hyperlegible', system-ui, sans-serif",
    pesoTitulo: 700,
    espacamentoTitulo: "-0.02em",
    raio: "18px",
    raioBotao: "14px",
    mola: { stiffness: 170, damping: 26 },
    titulo: "Ver bem começa por saber.",
    subtitulo:
      "Um rastreio de estrabismo em dois minutos, no telemóvel. Gratuito, e sem guardar nenhuma fotografia.",
    cores: {
      claro: {
        fundo: "#F7F5F0",
        superficie: "#FFFFFF",
        superficieAlt: "#EEF1F8",
        tinta: "#0E1B2C",
        tintaSuave: "#4A5566",
        primaria: "#1D3FBF",
        sobrePrimaria: "#FFFFFF",
        acento: "#C43A17",
        sobreAcento: "#FFFFFF",
        linha: "#E2DDD2",
        sucesso: "#12725A",
      },
      escuro: {
        fundo: "#0B1220",
        superficie: "#121B2E",
        superficieAlt: "#18233B",
        tinta: "#F1F4F9",
        tintaSuave: "#A7B1C2",
        primaria: "#94ACFF",
        sobrePrimaria: "#0B1220",
        acento: "#FF8A66",
        sobreAcento: "#1A0A04",
        linha: "#243049",
        sucesso: "#5FD3AE",
      },
    },
  },
  viva: {
    id: "viva",
    nome: "B · Viva",
    ideia:
      "Energia angolana. Letra geométrica com carácter, cores quentes dos tecidos (terra, ocre, índigo) e padrões inspirados no samakaka; movimento com ritmo.",
    paraQuem: "Famílias e crianças: convida a voltar todos os dias para treinar.",
    letraTitulo: "'Bricolage Grotesque', system-ui, sans-serif",
    letraTexto: "'Inter', system-ui, sans-serif",
    pesoTitulo: 800,
    espacamentoTitulo: "-0.035em",
    raio: "28px",
    raioBotao: "999px",
    // Rápida mas amortecida (sem ressalto): ressaltar em ecrãs de tarefa
    // distrai as crianças (docs/PESQUISA_UX.md §3, movimento).
    mola: { stiffness: 320, damping: 34 },
    titulo: "Olhos alinhados, futuro à vista.",
    subtitulo:
      "Descubra em dois minutos se o seu filho precisa de ir ao oftalmologista — e treine a visão em casa, a brincar.",
    cores: {
      claro: {
        fundo: "#FFF6EA",
        superficie: "#FFFFFF",
        superficieAlt: "#FFE9CC",
        tinta: "#1F1406",
        tintaSuave: "#5E4A33",
        primaria: "#B8341A",
        sobrePrimaria: "#FFFFFF",
        acento: "#2E2A8C",
        sobreAcento: "#FFFFFF",
        linha: "#F1D9B8",
        sucesso: "#1B7A4B",
      },
      escuro: {
        fundo: "#170F05",
        superficie: "#23180A",
        superficieAlt: "#2F2110",
        tinta: "#FFF3E2",
        tintaSuave: "#D9C3A5",
        primaria: "#FF8A5B",
        sobrePrimaria: "#1F0A02",
        acento: "#A9A4FF",
        sobreAcento: "#0E0C33",
        linha: "#3A2A14",
        sucesso: "#6FDDA3",
      },
    },
  },
  humana: {
    id: "humana",
    nome: "C · Humana",
    ideia:
      "Uma clínica de confiança. Serifa editorial nos títulos e texto limpo, tons de papel e verde profundo, muito espaço para fotografia real de famílias angolanas.",
    paraQuem: "Quem decide pagar e as clínicas parceiras: transmite cuidado e credibilidade.",
    letraTitulo: "'Fraunces', Georgia, serif",
    letraTexto: "'Figtree', system-ui, sans-serif",
    pesoTitulo: 560,
    espacamentoTitulo: "-0.02em",
    raio: "10px",
    raioBotao: "10px",
    mola: { stiffness: 140, damping: 22 },
    titulo: "Cuidar dos olhos de quem mais amamos.",
    subtitulo:
      "Rastreio de estrabismo, treinos em casa e consulta com clínicas parceiras em Luanda — no mesmo sítio, com calma.",
    cores: {
      claro: {
        fundo: "#F4F1EA",
        superficie: "#FFFDF8",
        superficieAlt: "#E8EFE9",
        tinta: "#1B2A24",
        tintaSuave: "#55635C",
        primaria: "#1F5C4A",
        sobrePrimaria: "#FFFFFF",
        acento: "#9A6428",
        sobreAcento: "#FFFFFF",
        linha: "#DDD6C8",
        sucesso: "#1F5C4A",
      },
      escuro: {
        fundo: "#0F1714",
        superficie: "#16211D",
        superficieAlt: "#1D2B26",
        tinta: "#EEF2EC",
        tintaSuave: "#A9B8B0",
        primaria: "#7CC4A8",
        sobrePrimaria: "#0B1612",
        acento: "#E0A95A",
        sobreAcento: "#1A1003",
        linha: "#28362F",
        sucesso: "#7CC4A8",
      },
    },
  },
};

/** Variáveis CSS de uma direcção/tema, para aplicar num contentor. */
export function variaveis(d: Direccao, tema: Tema): Record<string, string> {
  const c = d.cores[tema];
  return {
    "--r-fundo": c.fundo,
    "--r-sup": c.superficie,
    "--r-sup-alt": c.superficieAlt,
    "--r-tinta": c.tinta,
    "--r-suave": c.tintaSuave,
    "--r-prim": c.primaria,
    "--r-sobre-prim": c.sobrePrimaria,
    "--r-acento": c.acento,
    "--r-sobre-acento": c.sobreAcento,
    "--r-linha": c.linha,
    "--r-sucesso": c.sucesso,
    "--r-raio": d.raio,
    "--r-raio-botao": d.raioBotao,
    "--r-letra-titulo": d.letraTitulo,
    "--r-letra-texto": d.letraTexto,
  };
}

/** Luminância relativa (WCAG 2.x) de uma cor #RRGGBB. */
export function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Contraste WCAG entre duas cores (1 a 21). */
export function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
