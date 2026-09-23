/**
 * Idiomas do site e detecção do idioma activo.
 *
 * O idioma decide-se só pela rota: `/en` e `/en/*` são inglês, tudo o resto é
 * português. Não há detecção pelo idioma do browser nem redireccionamento
 * automático -- decisão deliberada, para cada URL ter sempre um único idioma
 * (o que o Google indexa é o que o visitante vê).
 */

export const IDIOMA_PT = "pt-AO";
export const IDIOMA_EN = "en-US";

export type Idioma = typeof IDIOMA_PT | typeof IDIOMA_EN;

export const IDIOMAS: readonly Idioma[] = [IDIOMA_PT, IDIOMA_EN];

/** Prefixo das rotas em inglês. O português vive na raiz. */
export const PREFIXO_EN = "/en";

/**
 * A versão inglesa só existe com `VITE_ENABLE_EN=true`. Lido em cada chamada
 * (e não uma vez ao carregar o módulo) para os testes poderem ligar e desligar
 * a flag com `vi.stubEnv`.
 */
export function inglesAtivo(): boolean {
  return import.meta.env.VITE_ENABLE_EN === "true";
}

/** `true` para `/en` e `/en/...`; `false` para `/english`, `/enviar`, etc. */
export function eRotaInglesa(pathname: string): boolean {
  return pathname === PREFIXO_EN || pathname.startsWith(`${PREFIXO_EN}/`);
}

/**
 * Idioma de uma rota. Com a flag desligada é sempre português: as rotas
 * `/en/*` nem sequer existem (caem no 404), e o 404 é uma página portuguesa.
 */
export function idiomaDaRota(pathname: string, enAtivo = inglesAtivo()): Idioma {
  return enAtivo && eRotaInglesa(pathname) ? IDIOMA_EN : IDIOMA_PT;
}
