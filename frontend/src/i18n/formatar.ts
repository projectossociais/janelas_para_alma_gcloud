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

const SO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Converte para `Date`. Uma data sem hora ("2026-09-12", como `data_evento`)
 * é um dia do calendário, não um instante: o JavaScript lê-a como meia-noite
 * UTC, o que nos fusos a oeste de UTC (Américas) ainda é o dia anterior.
 * Por isso constrói-se à meia-noite local — mostra sempre o mesmo dia.
 */
function paraData(data: Data): Date {
  if (typeof data === "string") {
    const m = SO_DATA.exec(data);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(data);
}

export function formatarData(data: Data): string {
  const d = paraData(data);
  return emIngles()
    ? d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : d.toLocaleDateString("pt-PT");
}

export function formatarDataHora(data: Data): string {
  const d = paraData(data);
  return emIngles()
    ? d.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : d.toLocaleString("pt-PT");
}

/**
 * Hora de uma consulta: sempre no fuso de Luanda e em 24h, seja qual for o
 * fuso do computador de quem vê -- as clínicas definem o horário em hora de
 * Luanda, e um browser noutro fuso mostrava horas fora do expediente.
 */
export function formatarHorarioConsulta(data: Data): string {
  const d = paraData(data);
  return d.toLocaleString(emIngles() ? "en-US" : "pt-PT", {
    timeZone: "Africa/Luanda",
    weekday: "long",
    day: "numeric",
    month: emIngles() ? "long" : "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
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
  const d = paraData(data);
  return emIngles()
    ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
}
