import i18n from "@/i18n";
import { formatarDecimal } from "@/i18n/formatar";
import { DISTANCIA_LONGE_MM, DISTANCIA_OMISSAO_MM } from "@/lib/visao/geometria";
import { eResumoSentido, type ResumoSentido, type Sentido } from "@/lib/visao/pontes";

/** Nome curto de cada exercício (id histórico -> nome actual). */
export const nomeDoExercicio = (id: string): string => {
  switch (id) {
    case "figure8":
      return i18n.t("Visao.acuidadeTitulo");
    case "cerebro":
      return i18n.t("Visao.contrasteTitulo");
    case "relax":
      return i18n.t("Visao.astigmatismoTitulo");
    case "estereopsia":
      return i18n.t("Visao.estereoTitulo");
    case "ambliopia":
      return i18n.t("Visao.aneisTitulo");
    case "sacadas-convergencia":
      return i18n.t("Visao.contrasteBlocosTitulo");
    case "convergence":
      return i18n.t("Visao.convergenciaTitulo");
    case "flexibilidade-acomodativa":
      return i18n.t("Visao.pertoLongeTitulo");
    default:
      return id;
  }
};

export const nomeDoOlho = (olho: string | null): string =>
  olho === "direito"
    ? i18n.t("Visao.olhoDireito")
    : olho === "esquerdo"
      ? i18n.t("Visao.olhoEsquerdo")
      : olho === "ambos"
        ? i18n.t("Visao.doisOlhos")
        : "—";

/** Uma procura em dioptrias prismáticas ("18 Δ"). */
export const rotuloDelta = (delta: number): string => i18n.t("Visao.pontesDelta", { delta: formatarDecimal(delta, delta % 1 ? 1 : 0) });

export const nomeDoSentido = (s: Sentido) =>
  s === "convergencia" ? i18n.t("Visao.pontesConvergencia") : i18n.t("Visao.pontesDivergencia");

/** Rotura e recuperação de um sentido, já formatadas ("18 Δ", "acima de 25 Δ", "—"). */
const partesPontes = (r: ResumoSentido) => ({
  rotura:
    r.rotura !== null
      ? rotuloDelta(r.rotura)
      : r.limiteEcra && r.maximo !== null
        ? i18n.t("Visao.pontesAcimaDe", { delta: rotuloDelta(r.maximo) })
        : "—",
  recuperacao: r.recuperacao !== null ? rotuloDelta(r.recuperacao) : "—",
});

/**
 * Pontes de Fusão, um sentido: "Convergência: rotura 18 Δ, recuperação 12 Δ".
 * Sem rotura mas com o limite do ecrã atingido: "rotura acima de 25 Δ".
 */
export const rotuloSentidoPontes = (sentido: Sentido, r: ResumoSentido): string =>
  i18n.t("Visao.pontesResumoSentido", { sentido: nomeDoSentido(sentido), ...partesPontes(r) });

/** O mesmo sem o nome do sentido: "rotura 18 Δ, recuperação 12 Δ". */
export const rotuloRoturaRecuperacao = (r: ResumoSentido): string => i18n.t("Visao.clinicoPontesValores", partesPontes(r));

/** Os sentidos medidos numa sessão das Pontes de Fusão, numa linha. */
export const rotuloPontes = (pontes: unknown): string | null => {
  if (!pontes || typeof pontes !== "object") return null;
  const p = pontes as Partial<Record<Sentido, unknown>>;
  const partes = (["convergencia", "divergencia"] as const)
    .filter((s) => eResumoSentido(p[s]) && (p[s] as ResumoSentido).rampas > 0)
    .map((s) => rotuloSentidoPontes(s, p[s] as ResumoSentido));
  return partes.length ? partes.join(" · ") : null;
};

/** Limiar com a sua unidade, pronto a mostrar. */
export const limiarFormatado = (
  limiar: number | null,
  unidade: string | null,
  sinais: Record<string, unknown> | null,
): string => {
  // Desafio da Agulha (id `estereopsia`, desde 2026-10-21): acertos com os dois olhos e com um.
  if (sinais?.modo === "agulha") {
    const j = sinais.jogador as { acertos_dois?: unknown; acertos_um?: unknown } | undefined;
    return i18n.t("Visao.agulhaLimiarCurto", { dois: j?.acertos_dois ?? "–", um: j?.acertos_um ?? "–" });
  }
  // Fio de Missangas (id `cerebro`, desde 2026-10-21): ponto mais próximo de convergência.
  if (sinais?.modo === "fio_missangas")
    return limiar === null ? i18n.t("Visao.fioLimiarAlem") : i18n.t("Visao.fioLimiarCurto", { cm: formatarDecimal(limiar, limiar % 1 ? 1 : 0) });
  // Luz nos Olhos (id `relax`, desde 2026-10-21): desvio estimado pelo reflexo.
  if (sinais?.modo === "luz_olhos")
    return limiar ? i18n.t("Visao.luzLimiarCurto", { delta: limiar }) : i18n.t("Visao.luzSemDesvioCurto");
  if (sinais && typeof sinais.astigmatismo === "boolean")
    return sinais.astigmatismo ? i18n.t("Visao.astigmatismoSinalCurto") : i18n.t("Visao.astigmatismoSemSinalCurto");
  if (unidade === "dioptrias_prismaticas") return rotuloPontes(sinais?.pontes) ?? (limiar === null ? "—" : rotuloDelta(limiar));
  // Kianda com óculos 3D: contraste do olho forte que o olho fraco aguentou.
  if (unidade === "razao_contraste")
    return limiar === null ? "—" : i18n.t("Visao.kiandaLimiarCurto", { contraste: `${Math.round(limiar * 100)}%` });
  if (limiar === null) return "—";
  switch (unidade) {
    case "logmar":
      return `logMAR ${formatarDecimal(limiar, 2)}`;
    case "log_cs":
      return `log CS ${formatarDecimal(limiar, 2)}`;
    case "arcsec":
      return `${limiar}″`;
    case "graus":
      return `${formatarDecimal(limiar, limiar % 1 ? 1 : 0)}°`;
    case "segundos":
      return i18n.t("Visao.segundosCurto", { valor: formatarDecimal(limiar, limiar % 1 ? 1 : 0) });
    default:
      return formatarDecimal(limiar, 2);
  }
};

/** Rótulo de uma distância ("Braço esticado (60 cm)", "1 metro", "45 cm"). */
export const rotuloDistancia = (mm: number): string =>
  mm === DISTANCIA_OMISSAO_MM
    ? i18n.t("Visao.distanciaBraco")
    : mm === DISTANCIA_LONGE_MM
      ? i18n.t("Visao.distanciaUmMetro")
      : i18n.t("Visao.distanciaCm", { cm: Math.round(mm / 10) });
