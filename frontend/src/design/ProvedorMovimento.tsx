import type { ReactNode } from "react";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import { TRANSICAO } from "./movimento";

/**
 * Envolve a app (ou a montra): carrega só as funcionalidades de animação que
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
