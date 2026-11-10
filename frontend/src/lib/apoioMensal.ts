/**
 * Níveis do apoio mensal (Kamba Mensal). Os mesmos limites vivem na API
 * (`apoio_mensal_service.py`), que é quem decide: aqui só servem para mostrar
 * e validar antes de enviar.
 */
export const NIVEIS_APOIO_MENSAL = [
  { valor: 5000, impacto: "ApoioMensal.nivel1Impacto" },
  { valor: 15000, impacto: "ApoioMensal.nivel2Impacto" },
  { valor: 30000, impacto: "ApoioMensal.nivel3Impacto" },
] as const;

export const VALOR_MENSAL_MINIMO_KZ = 1000;
export const VALOR_MENSAL_MAXIMO_KZ = 10_000_000;

/**
 * Lê um valor escrito pela pessoa ("10.000", "10 000", "10000 Kz") e devolve
 * os Kwanzas inteiros, ou `null` se não for um número dentro dos limites.
 * Só aceita inteiros: os separadores de milhar (ponto, espaço) são ignorados.
 */
export function lerValorMensal(texto: string): number | null {
  const limpo = texto.replace(/kz/gi, "").replace(/[\s.]/g, "").trim();
  if (!/^\d+$/.test(limpo)) return null;
  const valor = Number(limpo);
  if (valor < VALOR_MENSAL_MINIMO_KZ || valor > VALOR_MENSAL_MAXIMO_KZ) return null;
  return valor;
}

/** "15.000 Kz" -- Kwanzas com separador de milhar português, em qualquer idioma (o Kz não se converte). */
export const formatarKz = (valor: number): string => `${String(valor).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} Kz`;
