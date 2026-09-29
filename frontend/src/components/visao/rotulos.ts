import i18n from "@/i18n";
import { formatarDecimal } from "@/i18n/formatar";
import { DISTANCIA_LONGE_MM, DISTANCIA_OMISSAO_MM } from "@/lib/visao/geometria";

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

/** Limiar com a sua unidade, pronto a mostrar. */
export const limiarFormatado = (
  limiar: number | null,
  unidade: string | null,
  sinais: Record<string, unknown> | null,
): string => {
  if (sinais && typeof sinais.astigmatismo === "boolean")
    return sinais.astigmatismo ? i18n.t("Visao.astigmatismoSinalCurto") : i18n.t("Visao.astigmatismoSemSinalCurto");
  if (limiar === null) return "—";
  switch (unidade) {
    case "logmar":
      return `logMAR ${formatarDecimal(limiar, 2)}`;
    case "log_cs":
      return `log CS ${formatarDecimal(limiar, 2)}`;
    case "arcsec":
      return `${limiar}″`;
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
