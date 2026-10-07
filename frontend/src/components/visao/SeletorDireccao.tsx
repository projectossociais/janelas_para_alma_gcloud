import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { EyeOff } from "lucide-react";
import { Botao } from "@/design/componentes/Botao";
import type { Direccao } from "@/lib/visao/escada";

interface SeletorDireccaoProps {
  /** `null` = "Não vejo". */
  aoResponder: (direccao: Direccao | null) => void;
  desactivado?: boolean;
}

const DIRECCOES: readonly Direccao[] = [0, 1, 2, 3, 4, 5, 6, 7];
const CHAVES_DIRECCAO = [
  "Visao.direccao0",
  "Visao.direccao1",
  "Visao.direccao2",
  "Visao.direccao3",
  "Visao.direccao4",
  "Visao.direccao5",
  "Visao.direccao6",
  "Visao.direccao7",
] as const;

// Teclado numérico / setas: o 8 é cima, o 6 é direita... (como no ecrã).
const TECLAS: Record<string, Direccao> = {
  ArrowRight: 0,
  ArrowUp: 2,
  ArrowLeft: 4,
  ArrowDown: 6,
  "6": 0,
  "9": 1,
  "8": 2,
  "7": 3,
  "4": 4,
  "1": 5,
  "2": 6,
  "3": 7,
};

const R_EXT = 100;
const R_INT = 46;

/** Sector de anel centrado no ângulo da direcção (y do ecrã para baixo). */
function caminhoSector(d: Direccao): string {
  const centro = (d * Math.PI) / 4;
  const a0 = centro - Math.PI / 8;
  const a1 = centro + Math.PI / 8;
  const p = (r: number, a: number) => `${(r * Math.cos(a)).toFixed(2)} ${(-r * Math.sin(a)).toFixed(2)}`;
  return `M ${p(R_INT, a0)} L ${p(R_EXT, a0)} A ${R_EXT} ${R_EXT} 0 0 0 ${p(R_EXT, a1)} L ${p(R_INT, a1)} A ${R_INT} ${R_INT} 0 0 1 ${p(R_INT, a0)} Z`;
}

/** Pequeno anel de referência dentro de cada sector, com a abertura nesse lado. */
function posicaoIcone(d: Direccao) {
  const a = (d * Math.PI) / 4;
  const r = (R_EXT + R_INT) / 2;
  return { x: r * Math.cos(a), y: -r * Math.sin(a) };
}

/**
 * Resposta dos testes com anéis: um anel grande dividido em 8 sectores
 * (toque no lado da abertura) + "Não vejo". Cada sector é um botão com
 * nome acessível; setas e teclado numérico também respondem.
 */
const SeletorDireccao = ({ aoResponder, desactivado = false }: SeletorDireccaoProps) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (desactivado) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key in TECLAS) {
        e.preventDefault();
        aoResponder(TECLAS[e.key]);
      } else if (e.key === "0" || e.key === "5") {
        e.preventDefault();
        aoResponder(null);
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoResponder, desactivado]);

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        viewBox="-104 -104 208 208"
        className="h-52 w-52 max-w-full sm:h-64 sm:w-64"
        role="group"
        aria-label={t("Visao.escolhaOLadoDaAbertura")}
      >
        {DIRECCOES.map((d) => {
          const { x, y } = posicaoIcone(d);
          return (
            <g
              key={d}
              role="button"
              tabIndex={desactivado ? -1 : 0}
              aria-label={t(CHAVES_DIRECCAO[d])}
              aria-disabled={desactivado}
              className="group cursor-pointer outline-none"
              onClick={() => !desactivado && aoResponder(d)}
              onKeyDown={(e) => {
                if (!desactivado && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  aoResponder(d);
                }
              }}
            >
              <path
                d={caminhoSector(d)}
                className="fill-accao-suave stroke-superficie transition-colors group-hover:fill-accao/25 group-focus-visible:fill-accao/40 group-active:fill-accao/50"
                strokeWidth={3}
              />
              <g transform={`translate(${x} ${y}) rotate(${-d * 45})`} className="pointer-events-none">
                {/* Arco com a abertura à direita (antes de rodar). */}
                <path
                  d="M 8.16 -3.8 A 9 9 0 1 0 8.16 3.8"
                  fill="none"
                  className="stroke-tinta"
                  strokeWidth={4}
                />
              </g>
            </g>
          );
        })}
      </svg>
      <Botao
        type="button"
        variante="secundario"
        tamanho="g"
        disabled={desactivado}
        onClick={() => aoResponder(null)}
        className="min-w-40"
      >
        <EyeOff className="h-4 w-4" />
        {t("Visao.naoVejo")}
      </Botao>
    </div>
  );
};

export default SeletorDireccao;
