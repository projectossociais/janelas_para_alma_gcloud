/**
 * Regras do Apoio Financeiro (valores e texto que segue para a API).
 *
 * O site não cobra cartões: quem doa transfere para a conta do projecto e
 * envia o comprovativo. "Mensal" é um compromisso -- o doador cria uma
 * transferência permanente no banco; nada é cobrado automaticamente.
 */

export type FrequenciaDoacao = "unica" | "mensal";

/**
 * Valores sugeridos, em Kz. Diferentes por frequência: quem doa uma vez
 * costuma dar mais de uma só vez; o mensal é um valor que se repete todos
 * os meses, por isso começa mais baixo.
 */
export const VALORES_DOACAO_KZ: Record<FrequenciaDoacao, readonly number[]> = {
  unica: [10_000, 25_000, 50_000, 100_000, 250_000, 500_000],
  mensal: [2_500, 5_000, 10_000, 15_000, 25_000, 50_000],
};

/** `?modo=unica|mensal` (links "Doar Uma Vez" / "Doar Mensalmente" do menu). */
export function frequenciaDoModo(modo: string | null): FrequenciaDoacao | null {
  return modo === "unica" || modo === "mensal" ? modo : null;
}

export const VALOR_MINIMO_KZ = 1_000;

/** 25000 -> "25.000" (milhares com ponto, como no resto do site). */
export const agruparMilhares = (valor: number): string =>
  valor.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Lê o campo "Outro valor": aceita "25000", "25.000" ou "25 000". Tudo o resto é `null`. */
export function lerValorKz(texto: string): number | null {
  const limpo = texto.replace(/[.\s]/g, "");
  if (!/^\d{1,9}$/.test(limpo)) return null;
  const valor = Number(limpo);
  return valor > 0 ? valor : null;
}

/**
 * Texto para a equipa, sempre em português: "Mensal · 25.000 Kz · Multicaixa Express".
 * Os rótulos chegam já traduzidos para português por quem chama (`tPt`).
 */
export function detalhesDoDonativo(rotulos: {
  frequencia: string;
  valorKz: number;
  metodo: string;
  nota?: string;
}): string {
  const partes = [rotulos.frequencia, `${agruparMilhares(rotulos.valorKz)} Kz`, rotulos.metodo];
  const nota = rotulos.nota?.trim();
  return partes.join(" · ") + (nota ? ` · ${nota}` : "");
}
