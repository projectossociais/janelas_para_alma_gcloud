import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { FORMAS, type Forma } from "@/lib/visao/estereograma";

const CHAVES_FORMA: Record<Forma, string> = {
  circulo: "Visao.formaCirculo",
  quadrado: "Visao.formaQuadrado",
  triangulo: "Visao.formaTriangulo",
  estrela: "Visao.formaEstrela",
};

/** Ícone de cada forma para os botões de resposta. */
export const IconeForma = ({ forma }: { forma: Forma }) => {
  const comum = { className: "fill-current", "aria-hidden": true } as const;
  return (
    <svg viewBox="-12 -12 24 24" className="h-8 w-8">
      {forma === "circulo" && <circle r={10} {...comum} />}
      {forma === "quadrado" && <rect x={-9} y={-9} width={18} height={18} {...comum} />}
      {forma === "triangulo" && <polygon points="0,-10 10,8 -10,8" {...comum} />}
      {forma === "estrela" && (
        <polygon
          points={Array.from({ length: 10 }, (_, i) => {
            const r = i % 2 ? 4.5 : 10.5;
            const a = (i * Math.PI) / 5 - Math.PI / 2;
            return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
          }).join(" ")}
          {...comum}
        />
      )}
    </svg>
  );
};

/**
 * As quatro formas de resposta dos estereogramas (Teste de Estereopsia,
 * Pontes de Fusão): ícone e nome, numa grelha.
 */
export const BotoesForma = ({ aoEscolher, desactivado }: { aoEscolher: (i: number) => void; desactivado?: boolean }) => {
  const { t } = useTranslation();
  return (
    <div className="grid w-full max-w-md grid-cols-2 gap-2 sm:grid-cols-4">
      {FORMAS.map((f, i) => (
        <Button
          key={f}
          size="lg"
          variant="outline"
          className="h-auto flex-col gap-1 py-3"
          disabled={desactivado}
          onClick={() => aoEscolher(i)}
        >
          <IconeForma forma={f} />
          <span className="text-xs">{t(CHAVES_FORMA[f])}</span>
        </Button>
      ))}
    </div>
  );
};
