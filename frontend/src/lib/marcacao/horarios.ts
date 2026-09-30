/**
 * Horários da marcação de consulta, sempre na hora de Luanda.
 *
 * A consulta é em Luanda (ou com uma clínica de Luanda, por vídeo): um pai em
 * Lisboa ou com o telemóvel noutro fuso tem de ver a mesma hora que a clínica.
 * Por isso nada aqui usa o fuso do aparelho; tudo passa por `FUSO_LUANDA`.
 */
export const FUSO_LUANDA = "Africa/Luanda";

export interface Horario {
  inicio: string;
  fim: string;
}

export interface DiaComHorarios {
  /** "2026-10-06", o dia em Luanda. */
  chave: string;
  horarios: Horario[];
}

const partes = (iso: string, idioma: string, opcoes: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(idioma, { timeZone: FUSO_LUANDA, ...opcoes }).format(new Date(iso));

/** O dia em Luanda, como "AAAA-MM-DD" (o formato en-CA é exactamente esse). */
export const chaveDoDia = (iso: string) => partes(iso, "en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });

/** Agrupa por dia de Luanda, por ordem, sem perder nem repetir nenhum horário. */
export function agruparPorDia(horarios: readonly Horario[]): DiaComHorarios[] {
  const dias = new Map<string, Horario[]>();
  for (const h of [...horarios].sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio))) {
    const chave = chaveDoDia(h.inicio);
    const lista = dias.get(chave) ?? [];
    lista.push(h);
    dias.set(chave, lista);
  }
  return [...dias].map(([chave, lista]) => ({ chave, horarios: lista }));
}

/** "09:30" */
export const formatarHora = (iso: string, idioma: string) =>
  partes(iso, idioma, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Para a pastilha do dia: "seg." e "6/10". */
export const formatarDiaCurto = (iso: string, idioma: string) => ({
  semana: partes(iso, idioma, { weekday: "short" }),
  data: partes(iso, idioma, { day: "numeric", month: "numeric" }),
});

/** "segunda-feira, 6 de outubro" */
export const formatarDiaLongo = (iso: string, idioma: string) =>
  partes(iso, idioma, { weekday: "long", day: "numeric", month: "long" });
