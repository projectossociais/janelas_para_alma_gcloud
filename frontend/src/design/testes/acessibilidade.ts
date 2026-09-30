import axe from "axe-core";

/**
 * Corre o axe-core sobre um elemento renderizado e devolve as violações numa
 * forma legível (`regra: descrição (n elementos)`), para `expect(...).toEqual([])`.
 *
 * Desligadas de propósito, porque o jsdom não as consegue avaliar:
 * - `color-contrast`: não há layout nem cores calculadas. O contraste é
 *   garantido pelos testes dos tokens (`tokens.test.ts`);
 * - `region`: um componente isolado não está dentro de um landmark.
 */
export async function violacoesAcessibilidade(elemento: Element): Promise<string[]> {
  const resultado = await axe.run(elemento, {
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
  });
  return resultado.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);
}
