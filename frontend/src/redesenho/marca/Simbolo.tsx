import { motion, useReducedMotion } from "motion/react";
import { SIMBOLO } from "./marca";

/**
 * O símbolo da marca (olho dentro de uma janela), com os traçados exactos do
 * manual (pág. 4). Não redesenhar nem mudar cores: só a moldura troca entre
 * o fundo claro e o escuro, como no manual.
 *
 * `alinhar`: o olho entra desviado e alinha-se na janela, uma única vez --
 * é a ideia da marca ("Um Olhar Alinhado") em movimento. Com movimento
 * reduzido aparece logo alinhado.
 */
export const Simbolo = ({
  fundo = "claro",
  alinhar = false,
  className,
  titulo,
}: {
  fundo?: "claro" | "escuro";
  alinhar?: boolean;
  className?: string;
  titulo?: string;
}) => {
  const reduzido = useReducedMotion();
  const anima = alinhar && !reduzido;
  return (
    <svg
      viewBox="195 343 522 394"
      className={className}
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
    >
      <motion.g
        initial={anima ? { x: -46, y: 18, rotate: -9 } : false}
        animate={{ x: 0, y: 0, rotate: 0 }}
        transition={{ type: "spring", stiffness: 60, damping: 14, delay: 0.5 }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      >
        <path
          transform="matrix(1,0,0,-1,243.5393,540.1823)"
          d="M0 0 43.982-43.981C88.926-88.927 148.683-113.678 212.243-113.678 275.803-113.678 335.559-88.927 380.504-43.981L424.486 0 380.108 44.379C335.27 89.218 275.654 113.91 212.244 113.91 148.832 113.91 89.217 89.218 44.379 44.379ZM212.243-142.395C141.012-142.395 74.045-114.655 23.676-64.288L-40.611 0 24.074 64.684C127.832 168.442 296.656 168.441 400.413 64.684L465.098 0 400.809-64.288C350.441-114.655 283.474-142.395 212.243-142.395"
          fill={SIMBOLO.lente}
        />
        <motion.g
          initial={anima ? { x: -22 } : false}
          animate={{ x: 0 }}
          transition={{ type: "spring", stiffness: 50, damping: 12, delay: 0.7 }}
        >
          <circle cx="455.78" cy="540.18" r="65.47" fill={SIMBOLO.iris} />
          <circle cx="455.78" cy="540.18" r="36.26" fill={SIMBOLO.pupila} />
          <circle cx="432.44" cy="516.84" r="12.91" fill={SIMBOLO.brilho} opacity={SIMBOLO.brilhoOpacidade} />
        </motion.g>
      </motion.g>
      <path
        d="M297.834 375.194H627.445V704.806H297.834ZM651.376 351.264H273.904V728.737H651.376Z"
        fillRule="evenodd"
        fill={SIMBOLO.moldura[fundo]}
        opacity={SIMBOLO.molduraOpacidade}
      />
    </svg>
  );
};
