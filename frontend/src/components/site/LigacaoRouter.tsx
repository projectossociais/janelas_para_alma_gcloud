import { forwardRef } from "react";
import { Link } from "react-router-dom";
import type { LigacaoProps } from "@/design/Ligacao";

/**
 * Adaptador do `Link` do react-router para o sistema de design
 * (`ProvedorLigacao`). Caminhos internos navegam sem recarregar a página;
 * âncoras (`#...`), contactos (`tel:`, `mailto:`) e endereços externos ficam
 * num <a> normal.
 */
const EXTERNO = /^(#|[a-z][a-z0-9+.-]*:)/i;

export const LigacaoRouter = forwardRef<HTMLAnchorElement, LigacaoProps>(({ href, ...props }, ref) =>
  EXTERNO.test(href) ? <a ref={ref} href={href} {...props} /> : <Link ref={ref} to={href} {...props} />,
);
LigacaoRouter.displayName = "LigacaoRouter";
