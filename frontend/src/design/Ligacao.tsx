import { createContext, forwardRef, useContext, type AnchorHTMLAttributes, type ComponentType, type ReactNode, type RefAttributes } from "react";

/**
 * Ligação do sistema de design. Os componentes de navegação (cabeçalho, menu,
 * rodapé, barra de separadores) criam ligações, mas não devem depender do
 * router: a app injecta o seu componente uma vez (`ProvedorLigacao`, ex.: um
 * adaptador do `Link` do react-router) e todos o usam. Sem provedor, é um <a>.
 */
export interface LigacaoProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children?: ReactNode;
}

type ComponenteLigacao = ComponentType<LigacaoProps & RefAttributes<HTMLAnchorElement>>;

const ContextoLigacao = createContext<ComponenteLigacao | null>(null);

export const ProvedorLigacao = ({ componente, children }: { componente: ComponenteLigacao; children: ReactNode }) => (
  <ContextoLigacao.Provider value={componente}>{children}</ContextoLigacao.Provider>
);

export const Ligacao = forwardRef<HTMLAnchorElement, LigacaoProps>((props, ref) => {
  const Componente = useContext(ContextoLigacao);
  return Componente ? <Componente ref={ref} {...props} /> : <a ref={ref} {...props} />;
});
Ligacao.displayName = "Ligacao";
