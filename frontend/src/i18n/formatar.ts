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
    : d.toLocaleString("pt-PT");
}
