import type { ReactNode } from "react";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import { TRANSICAO } from "./movimento";

/**
 * Envolve cada arquétipo de página (LayoutSite, LayoutEntrada, LayoutTarefa,
 * LayoutApp) e a montra. Sem ele, um `m.div` não anima: fica parado no estado
 * inicial (ex.: invisível, com `opacity: 0`). Não está na raiz da app porque o
 * `strict` rebentaria com o laboratório antigo, que usa `motion.*`.
 *
 * Carrega só as funcionalidades de animação que
 * usamos (`domAnimation`, bem mais leve do que o motor completo) e aplica a
 * preferência de movimento reduzido do sistema a todas as animações
 * (`reducedMotion="user"`: sem deslocamentos nem escalas, só opacidade).
 * `strict` garante que ninguém importa o `motion.div` completo por engano:
 * dentro daqui usa-se `m.div`.
 */
export const ProvedorMovimento = ({ children }: { children: ReactNode }) => (
  <LazyMotion features={domAnimation} strict>
    <MotionConfig reducedMotion="user" transition={TRANSICAO.desvanecer}>
      {children}
    </MotionConfig>
  </LazyMotion>
);
