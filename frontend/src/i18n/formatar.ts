import i18n from "./index";
import { IDIOMA_EN } from "./idiomas";

/**
 * Datas no formato do idioma activo. O português mantém exactamente o
 * formato que o site sempre teve (`pt-PT`, "23/09/2026"); o inglês usa o
 * formato americano por extenso ("September 23, 2026"), como pede o AP.
 *
 * Valores em Kwanza (Kz/AOA) não passam por aqui: não se convertem nem se
 * reformatam.
 */
type Data = Date | string | number;

const emIngles = () => i18n.language === IDIOMA_EN;

export function formatarData(data: Data): string {
  const d = new Date(data);
  return emIngles()
    ? d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : d.toLocaleDateString("pt-PT");
}

export function formatarDataHora(data: Data): string {
  const d = new Date(data);
  return emIngles()
    ? d.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : // Sem segundos, como em inglês: num relatório ou num aviso são só ruído.
      d.toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Número decimal com `casas` casas, vírgula em português, ponto em inglês. */
export function formatarDecimal(n: number, casas: number): string {
  return n.toLocaleString(emIngles() ? "en-US" : "pt-PT", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

/** Separador decimal do idioma activo. */
export const separadorDecimal = (): string => (emIngles() ? "." : ",");

/** Dia e mês curtos ("23/09" em português, "Sep 23" em inglês). */
export function formatarDiaCurto(data: Data): string {
  const d = new Date(data);
  return emIngles()
    ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
}
