import { motion, useReducedMotion } from "motion/react";
import { MARCA, SIMBOLO } from "../marca/marca";
import { Simbolo } from "../marca/Simbolo";
import type { IdDireccao, Tema } from "./direcoes";

/**
 * Decoração da abertura de cada direcção. Todas nascem do manual da marca
 * (docs/MARCA.md): o símbolo, a lente do olho e a janela. Nada de formas
 * inventadas que não pertençam à marca.
 */

/** A: o símbolo grande, que entra desalinhado e se alinha uma vez. */
const SimboloAlinhado = ({ tema }: { tema: Tema }) => (
  <div className="flex h-full w-full items-center justify-center bg-[var(--r-sup-alt)]">
    <Simbolo fundo={tema} alinhar className="w-[78%]" />
  </div>
);

// Lente do olho do logótipo, reduzida a um losango de pontas curvas.
const LENTE = "M4 40 C24 14 72 14 92 40 C72 66 24 66 4 40 Z";

/** B: padrão de lentes nas cores da marca, sobre marinho, a deslizar devagar. */
const PadraoLentes = () => {
  const reduzido = useReducedMotion();
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: MARCA.marinho }} aria-hidden>
      <motion.svg
        viewBox="0 0 480 480"
        className="absolute inset-0 h-[140%] w-[140%]"
        animate={reduzido ? undefined : { x: [0, -48, 0], y: [0, -32, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      >
        <defs>
          <pattern id="lentes" width="96" height="80" patternUnits="userSpaceOnUse">
            <path d={LENTE} fill="none" stroke={MARCA.turquesa} strokeWidth="5" />
            <circle cx="48" cy="40" r="11" fill={MARCA.azul} />
            <circle cx="48" cy="40" r="5" fill={SIMBOLO.pupila} />
          </pattern>
          <pattern id="lentes-alt" width="96" height="80" patternUnits="userSpaceOnUse" x="48" y="40">
            <circle cx="48" cy="40" r="4" fill={MARCA.dourado} />
          </pattern>
        </defs>
        <rect width="480" height="480" fill="url(#lentes)" />
        <rect width="480" height="480" fill="url(#lentes-alt)" />
      </motion.svg>
      <div
        className="absolute inset-x-0 bottom-0 h-1/2"
        style={{ background: `linear-gradient(to top, ${MARCA.marinho}, transparent)` }}
      />
      <p className="absolute bottom-6 left-6 right-6 text-2xl font-bold leading-tight" style={{ color: MARCA.lima }}>
        Treinar todos os dias,
        <br />
        <span style={{ color: MARCA.creme }}>a brincar.</span>
      </p>
    </div>
  );
};

/**
 * C: fotografia real a preto e branco (como na pág. 2 do manual) dentro da
 * moldura da janela do símbolo. Aqui ainda sem fotografia: é um lugar marcado.
 */
const JanelaFotografia = ({ tema }: { tema: Tema }) => {
  const reduzido = useReducedMotion();
  return (
    <div className="relative flex h-full w-full items-center justify-center" aria-hidden>
      <div className="relative aspect-square w-[82%]">
        {/* A fotografia fica dentro da janela, com folga igual à do olho no símbolo. */}
        <div className="absolute inset-[8%] overflow-hidden">
          <motion.div
            className="h-full w-full"
            style={{ background: "linear-gradient(135deg, #6a6a6a, #1c1c1c)", filter: "grayscale(1)" }}
            initial={reduzido ? false : { scale: 1.08 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.6, ease: "easeOut" }}
          />
          <span className="absolute inset-x-5 top-5 text-sm text-white/70">
            Fotografia real, a preto e branco: uma família angolana
          </span>
          <p className="absolute bottom-5 left-5 right-5 text-2xl font-light leading-snug text-white">
            Um olhar alinhado,
            <br />
            <span style={{ color: MARCA.lima }}>uma vida transformada.</span>
          </p>
        </div>
        {/* A moldura da janela, com a espessura relativa e a opacidade do símbolo. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            border: "clamp(10px, 2.2vw, 22px) solid",
            borderColor: tema === "claro" ? SIMBOLO.moldura.claro : SIMBOLO.moldura.escuro,
            opacity: SIMBOLO.molduraOpacidade,
          }}
        />
      </div>
    </div>
  );
};

export const Decoracao = ({ id, tema }: { id: IdDireccao; tema: Tema }) =>
  id === "clara" ? <SimboloAlinhado tema={tema} /> : id === "viva" ? <PadraoLentes /> : <JanelaFotografia tema={tema} />;
