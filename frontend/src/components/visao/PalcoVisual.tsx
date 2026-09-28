import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * O "palco" onde se desenham os estímulos: fundo branco e optótipos pretos
 * **sempre**, também em modo escuro. As cores fixas (não tokens do tema) são
 * de propósito -- o contraste do estímulo faz parte da medição.
 */
const PalcoVisual = ({
  children,
  className,
  rotulo,
}: {
  children: ReactNode;
  className?: string;
  /** Nome acessível do estímulo (ex.: "Anel com uma abertura"). */
  rotulo?: string;
}) => (
  <div
    role={rotulo ? "img" : undefined}
    aria-label={rotulo}
    className={cn(
      "flex min-h-[150px] w-full items-center justify-center overflow-hidden rounded-xl border border-border",
      className,
    )}
    style={{ backgroundColor: "#ffffff", color: "#000000", colorScheme: "light" }}
    data-palco-visual
  >
    {children}
  </div>
);

export default PalcoVisual;
