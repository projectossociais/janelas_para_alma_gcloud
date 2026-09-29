import { motion, useReducedMotion } from "motion/react";
import type { IdDireccao } from "./direcoes";

/**
 * A: anéis concêntricos que "respiram" como uma íris a focar.
 * Só usa as cores do tema (variáveis CSS), nunca cores soltas.
 */
const AneisIris = () => {
  const reduzido = useReducedMotion();
  // Do exterior para o interior: anéis na cor primária, cada vez mais densos
  // até à pupila. As superfícies do tema eram quase iguais ao fundo e os
  // anéis desapareciam.
  const aneis = [
    { r: 188, fill: "var(--r-prim)", opacity: 0.07 },
    { r: 150, fill: "var(--r-prim)", opacity: 0.12 },
    { r: 118, fill: "var(--r-prim)", opacity: 0.2 },
    { r: 88, fill: "var(--r-prim)", opacity: 0.35 },
  ];
  return (
    <svg viewBox="0 0 400 400" className="h-full w-full" aria-hidden>
      {aneis.map((a, i) => (
        <motion.circle
          key={a.r}
          cx="200"
          cy="200"
          r={a.r}
          fill={a.fill}
          fillOpacity={a.opacity ?? 1}
          stroke="var(--r-prim)"
          strokeOpacity={0.25}
          strokeWidth={1.5}
          animate={reduzido ? undefined : { scale: [1, 1.025, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
          style={{ transformOrigin: "200px 200px" }}
        />
      ))}
      <motion.circle
        cx="200"
        cy="200"
        r="58"
        fill="var(--r-prim)"
        animate={reduzido ? undefined : { r: [58, 42, 58] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <circle cx="224" cy="176" r="13" fill="var(--r-sup)" />
      <circle cx="182" cy="222" r="5" fill="var(--r-sup)" opacity="0.7" />
      <motion.circle
        cx="200"
        cy="200"
        r="168"
        fill="none"
        stroke="var(--r-acento)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="90 966"
        animate={reduzido ? undefined : { rotate: 360 }}
        transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: "200px 200px" }}
      />
    </svg>
  );
};

/** B: mosaico de losangos e ziguezagues inspirado no samakaka, a deslizar devagar. */
const PadraoSamakaka = () => {
  const reduzido = useReducedMotion();
  return (
    <div className="relative h-full w-full overflow-hidden" aria-hidden>
      <motion.svg
        viewBox="0 0 480 480"
        className="absolute inset-0 h-[140%] w-[140%]"
        animate={reduzido ? undefined : { x: [0, -60, 0], y: [0, -40, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      >
        <defs>
          <pattern id="samakaka" width="96" height="96" patternUnits="userSpaceOnUse">
            <rect width="96" height="96" fill="var(--r-sup-alt)" />
            <path d="M48 6 L90 48 L48 90 L6 48 Z" fill="var(--r-prim)" />
            <path d="M48 26 L70 48 L48 70 L26 48 Z" fill="var(--r-fundo)" />
            <circle cx="48" cy="48" r="8" fill="var(--r-acento)" />
            <path d="M0 0 L12 12 L0 24 M96 0 L84 12 L96 24 M0 72 L12 84 L0 96 M96 72 L84 84 L96 96" stroke="var(--r-acento)" strokeWidth="4" fill="none" />
          </pattern>
        </defs>
        <rect width="480" height="480" fill="url(#samakaka)" />
      </motion.svg>
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--r-fundo)] via-transparent to-transparent" />
    </div>
  );
};

/** C: forma orgânica que muda devagar, a enquadrar uma fotografia (reservada). */
const FormaOrganica = () => {
  const reduzido = useReducedMotion();
  const formas = [
    "58% 42% 38% 62% / 52% 44% 56% 48%",
    "42% 58% 62% 38% / 46% 58% 42% 54%",
    "52% 48% 44% 56% / 60% 40% 60% 40%",
  ];
  return (
    <div className="relative flex h-full w-full items-center justify-center" aria-hidden>
      <motion.div
        className="absolute h-[88%] w-[88%] bg-[var(--r-sup-alt)]"
        animate={reduzido ? { borderRadius: formas[0] } : { borderRadius: [...formas, formas[0]] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="relative flex h-[70%] w-[70%] items-end justify-center overflow-hidden bg-[var(--r-prim)]"
        animate={reduzido ? { borderRadius: formas[1] } : { borderRadius: [formas[1], formas[2], formas[0], formas[1]] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="mb-[18%] max-w-[70%] text-center text-sm text-[var(--r-sobre-prim)] opacity-80">
          Fotografia real de uma família angolana
        </span>
      </motion.div>
    </div>
  );
};

export const Decoracao = ({ id }: { id: IdDireccao }) =>
  id === "clara" ? <AneisIris /> : id === "viva" ? <PadraoSamakaka /> : <FormaOrganica />;
