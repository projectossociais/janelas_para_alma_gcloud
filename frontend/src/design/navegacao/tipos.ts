/** Um destino de navegação. O texto vem sempre de quem usa (traduzido). */
export interface Destino {
  rotulo: string;
  href: string;
  /** A página actual (ou uma das suas filhas): marca `aria-current`. */
  activo?: boolean;
  filhos?: DestinoFilho[];
}

export interface DestinoFilho {
  rotulo: string;
  /** Uma linha a explicar o destino, no painel do computador. */
  descricao?: string;
  href: string;
  activo?: boolean;
}
