import type { RespostaOpcaoJogo } from "@/lib/apiClient";

const OPCOES: readonly RespostaOpcaoJogo[] = ["A", "B", "C", "D"];

/**
 * A "opinião do público" simulada, só para o jogo sem servidor (convidados e
 * site inglês; com sessão, a sondagem vem de `jogoApi.opiniaoPublico`).
 *
 * A opção certa fica entre 55% e 75%; o resto reparte-se pelas outras três de
 * forma plausível, nunca a 0%, e a soma é sempre 100 (garantias com testes).
 * Extraída sem alterações de `JogoCuriosidades.tsx`; `aleatorio` entra por
 * parâmetro só para os testes serem determinísticos.
 */
export function gerarOpiniaoPublico(
  correta: RespostaOpcaoJogo,
  aleatorio: () => number = Math.random,
): Record<RespostaOpcaoJogo, number> {
  const percentagemCorreta = 55 + Math.floor(aleatorio() * 21);
  const restantes = OPCOES.filter((o) => o !== correta);
  const pesos = restantes.map(() => aleatorio() + 0.1);
  const somaPesos = pesos.reduce((a, b) => a + b, 0);
  const disponivel = 100 - percentagemCorreta;
  const valores = pesos.map((p) => Math.max(1, Math.round((p / somaPesos) * disponivel)));
  valores[0] += disponivel - valores.reduce((a, b) => a + b, 0);

  const resultado = { A: 0, B: 0, C: 0, D: 0 } as Record<RespostaOpcaoJogo, number>;
  resultado[correta] = percentagemCorreta;
  restantes.forEach((opcao, i) => {
    resultado[opcao] = valores[i];
  });
  return resultado;
}
