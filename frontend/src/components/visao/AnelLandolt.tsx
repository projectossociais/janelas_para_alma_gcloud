import type { Direccao } from "@/lib/visao/escada";

interface AnelLandoltProps {
  /** Abertura (gap) em píxeis CSS. O diâmetro exterior é 5x a abertura. */
  aberturaPx: number;
  direccao: Direccao;
  /** Cor do anel (preto por omissão; cinzento no contraste). */
  cor?: string;
}

/**
 * Anel de Landolt em SVG. Numa grelha em que a abertura mede 1: círculo de
 * raio 2 com traço 1 (diâmetro exterior 5, interior 3) e um rectângulo
 * branco de largura 1 a tapar o traço -- a abertura. Rodado em múltiplos de
 * 45 graus: 0 = direita, 2 = cima, 4 = esquerda, 6 = baixo.
 *
 * Desenhado sempre sobre o palco branco (ver `PalcoVisual`), por isso o
 * rectângulo é branco puro, não uma cor do tema.
 */
const AnelLandolt = ({ aberturaPx, direccao, cor = "#000" }: AnelLandoltProps) => {
  const lado = aberturaPx * 5;
  return (
    <svg
      width={lado}
      height={lado}
      viewBox="-2.5 -2.5 5 5"
      aria-hidden
      shapeRendering="geometricPrecision"
      style={{ display: "block" }}
    >
      {/* SVG roda no sentido dos ponteiros; o negativo põe 2 = cima. */}
      <g transform={`rotate(${-direccao * 45})`}>
        <circle cx={0} cy={0} r={2} fill="none" stroke={cor} strokeWidth={1} />
        <rect x={1.2} y={-0.5} width={1.6} height={1} fill="#fff" />
      </g>
    </svg>
  );
};

export default AnelLandolt;
