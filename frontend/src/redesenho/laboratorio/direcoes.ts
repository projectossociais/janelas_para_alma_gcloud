/**
 * Laboratório de identidade (Sprint 7, Fase 1 -- docs/REDESENHO_FRONTEND.md):
 * três direcções visuais completas, em código, para o dono do projecto
 * escolher com os olhos. Só existe em desenvolvimento (`/_laboratorio`).
 *
 * Desde 2026-09-29 as três partem do manual da marca ("Um Olhar Alinhado",
 * docs/MARCA.md): o logótipo, a paleta e a letra Ubuntu são fixos. As
 * direcções diferem só em como os usam (proporção de cor, peso da letra,
 * forma, movimento). Cores fora da paleta são só tons derivados dela
 * (superfícies, linhas) e o vermelho funcional de erro.
 */
import { MARCA } from "../marca/marca";

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
  /** Vermelho funcional: só erros, sempre com ícone e texto. Não é da marca. */
  erro: string;
  /** Palavra destacada nos títulos grandes (como "Visual" na capa do manual). */
  destaque: string;
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
  /** Abertura em azul-marinho mesmo no tema claro (como a capa do manual). */
  aberturaEscura: boolean;
  cores: Record<Tema, Paleta>;
  titulo: string;
  /** Palavra do título pintada com `destaque`. */
  palavraDestaque: string;
  subtitulo: string;
}

// Ubuntu é a letra de texto do manual e está no Google Fonts (licença Ubuntu
// Font Licence). A LT Renovate do logótipo só entra como traçado no SVG do
// logótipo até a licença estar confirmada (docs/MARCA.md §4).
export const FONTES_GOOGLE =
  "https://fonts.googleapis.com/css2?family=Ubuntu:ital,wght@0,300;0,400;0,500;0,700;1,400&display=swap";

const UBUNTU = "'Ubuntu', system-ui, sans-serif";

// Tons comuns derivados do marinho (texto secundário e fundos escuros).
const MARINHO_SUAVE = "#3E5474";
const MARINHO_FUNDO = "#00132E";
const ERRO_CLARO = "#B42318";
const ERRO_ESCURO = "#FF9D8F";

export const DIRECCOES: Record<IdDireccao, Direccao> = {
  clara: {
    id: "clara",
    nome: "A · Clínica",
    ideia:
      "O azul do logótipo como cor de acção e muito branco. O símbolo alinha-se ao abrir a página. Turquesa só no símbolo e em pequenos sinais.",
    paraQuem: "Pais preocupados e profissionais de saúde: rigor e tranquilidade.",
    letraTitulo: UBUNTU,
    letraTexto: UBUNTU,
    pesoTitulo: 500,
    espacamentoTitulo: "-0.02em",
    raio: "14px",
    raioBotao: "12px",
    mola: { stiffness: 170, damping: 26 },
    aberturaEscura: false,
    titulo: "Ver bem começa por saber.",
    palavraDestaque: "saber.",
    subtitulo:
      "Um rastreio de estrabismo em dois minutos, no telemóvel. Gratuito, e sem guardar nenhuma fotografia.",
    cores: {
      claro: {
        fundo: "#F5F8FC",
        superficie: "#FFFFFF",
        superficieAlt: "#E6F1FC",
        tinta: MARCA.marinho,
        tintaSuave: MARINHO_SUAVE,
        primaria: MARCA.azul,
        sobrePrimaria: "#FFFFFF",
        acento: MARCA.turquesa,
        sobreAcento: MARCA.marinho,
        linha: "#D3DFEC",
        sucesso: MARCA.verde,
        erro: ERRO_CLARO,
        destaque: MARCA.azul,
      },
      escuro: {
        fundo: MARINHO_FUNDO,
        superficie: MARCA.marinho,
        superficieAlt: "#0B2E63",
        tinta: "#EEF4FA",
        tintaSuave: "#AFC2D9",
        primaria: MARCA.azulClaro,
        sobrePrimaria: MARINHO_FUNDO,
        acento: MARCA.turquesa,
        sobreAcento: MARINHO_FUNDO,
        linha: "#1D3D6B",
        sucesso: MARCA.lima,
        erro: ERRO_ESCURO,
        destaque: MARCA.azulClaro,
      },
    },
  },
  viva: {
    id: "viva",
    nome: "B · Viva",
    ideia:
      "A capa do manual: abertura em azul-marinho com a palavra-chave em lima, botões em forma de cápsula, dourado para o que se celebra e um padrão feito da lente do logótipo.",
    paraQuem: "Famílias e crianças: convida a voltar todos os dias para treinar.",
    letraTitulo: UBUNTU,
    letraTexto: UBUNTU,
    pesoTitulo: 700,
    espacamentoTitulo: "-0.03em",
    raio: "24px",
    raioBotao: "999px",
    // Rápida mas amortecida (sem ressalto): ressaltar em ecrãs de tarefa
    // distrai as crianças (docs/PESQUISA_UX.md §3, movimento).
    mola: { stiffness: 320, damping: 34 },
    aberturaEscura: true,
    titulo: "Um olhar alinhado, uma vida transformada.",
    palavraDestaque: "alinhado,",
    subtitulo:
      "Descubra em dois minutos se o seu filho precisa de ir ao oftalmologista, e treine a visão em casa, a brincar.",
    cores: {
      claro: {
        fundo: MARCA.creme,
        superficie: "#FFFFFF",
        superficieAlt: "#F0F6D2",
        tinta: MARCA.marinho,
        tintaSuave: MARINHO_SUAVE,
        primaria: MARCA.marinho,
        sobrePrimaria: MARCA.creme,
        acento: MARCA.dourado,
        sobreAcento: MARCA.marinho,
        linha: "#E2E9C4",
        sucesso: MARCA.verde,
        erro: ERRO_CLARO,
        destaque: MARCA.azul,
      },
      escuro: {
        fundo: MARCA.marinho,
        superficie: "#0A2D62",
        superficieAlt: "#133A75",
        tinta: MARCA.creme,
        tintaSuave: "#C5D2E0",
        primaria: MARCA.lima,
        sobrePrimaria: MARCA.marinho,
        acento: MARCA.dourado,
        sobreAcento: MARCA.marinho,
        linha: "#24497F",
        sucesso: MARCA.lima,
        erro: "#FFA597",
        destaque: MARCA.lima,
      },
    },
  },
  humana: {
    id: "humana",
    nome: "C · Humana",
    ideia:
      "Creme e verde da paleta, títulos grandes em Ubuntu Light como na página final do manual, e fotografia real a preto e branco dentro da janela do logótipo.",
    paraQuem: "Quem decide pagar e as clínicas parceiras: cuidado e credibilidade.",
    letraTitulo: UBUNTU,
    letraTexto: UBUNTU,
    pesoTitulo: 300,
    espacamentoTitulo: "-0.01em",
    raio: "6px",
    raioBotao: "6px",
    mola: { stiffness: 140, damping: 22 },
    aberturaEscura: false,
    titulo: "Cuidar dos olhos de quem mais amamos.",
    palavraDestaque: "olhos",
    subtitulo:
      "Rastreio de estrabismo, treinos em casa e consulta com clínicas parceiras em Luanda, no mesmo sítio e com calma.",
    cores: {
      claro: {
        fundo: MARCA.creme,
        superficie: "#FFFFFF",
        superficieAlt: "#E9F1EA",
        tinta: MARCA.marinho,
        tintaSuave: MARINHO_SUAVE,
        primaria: MARCA.verde,
        sobrePrimaria: "#FFFFFF",
        acento: MARCA.azul,
        sobreAcento: "#FFFFFF",
        linha: "#DDE6D6",
        sucesso: MARCA.verde,
        erro: ERRO_CLARO,
        destaque: MARCA.verde,
      },
      escuro: {
        fundo: MARINHO_FUNDO,
        superficie: "#062245",
        superficieAlt: "#0C2E55",
        tinta: MARCA.creme,
        tintaSuave: "#BCC9D6",
        primaria: "#9FD8BE",
        sobrePrimaria: MARINHO_FUNDO,
        acento: MARCA.dourado,
        sobreAcento: MARINHO_FUNDO,
        linha: "#1E3E62",
        sucesso: "#9FD8BE",
        erro: ERRO_ESCURO,
        destaque: MARCA.lima,
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
    "--r-erro": c.erro,
    "--r-destaque": c.destaque,
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
