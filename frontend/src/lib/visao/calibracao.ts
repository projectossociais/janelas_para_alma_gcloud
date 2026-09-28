/**
 * Calibração do ecrã com um cartão de banco (norma ISO/IEC 7810 ID-1):
 * o utilizador ajusta uma moldura no ecrã até ter o tamanho do cartão
 * encostado, e daí sai quantos píxeis CSS tem um milímetro neste ecrã.
 *
 * Guardado em localStorage (por aparelho) e, com sessão, também no perfil.
 * Sem cartão, usa-se o valor nominal do CSS (96 px por polegada), que em
 * telemóveis e portáteis pode falhar bastante -- por isso fica marcado como
 * não calibrado e os resultados avisam que são pouco fiáveis.
 */

export const CARTAO_LARGURA_MM = 85.6;
export const CARTAO_ALTURA_MM = 53.98;
/** 96 px CSS por polegada / 25,4 mm por polegada. */
export const PX_POR_MM_NOMINAL = 96 / 25.4;
/** Limites de sanidade (coincidem com a validação da API). */
export const PX_POR_MM_MIN = 0.5;
export const PX_POR_MM_MAX = 50;

const CHAVE_STORAGE = "jpa.visao.calibracao";

export interface Calibracao {
  pxPorMm: number;
  /** false = "não tenho cartão": valor nominal, resultados pouco fiáveis. */
  calibrado: boolean;
}

/** px/mm a partir da largura (px CSS) da moldura ajustada ao cartão. */
export const pxPorMmDaLarguraDoCartao = (larguraPx: number): number => larguraPx / CARTAO_LARGURA_MM;

export const pxPorMmValido = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= PX_POR_MM_MIN && v <= PX_POR_MM_MAX;

export const SEM_CARTAO: Calibracao = { pxPorMm: PX_POR_MM_NOMINAL, calibrado: false };

export function lerCalibracao(): Calibracao | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE_STORAGE);
    if (!bruto) return null;
    const dados = JSON.parse(bruto) as Partial<Calibracao>;
    if (!pxPorMmValido(dados.pxPorMm)) return null;
    return { pxPorMm: dados.pxPorMm, calibrado: dados.calibrado === true };
  } catch {
    return null;
  }
}

export function guardarCalibracao(c: Calibracao): void {
  try {
    window.localStorage.setItem(CHAVE_STORAGE, JSON.stringify(c));
  } catch {
    // modo privado / armazenamento bloqueado: a calibração fica só nesta visita
  }
}
