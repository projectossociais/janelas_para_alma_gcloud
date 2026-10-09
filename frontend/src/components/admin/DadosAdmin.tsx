import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";

/**
 * O que se mostra no lugar dos dados enquanto não os há: "A carregar…" ou o
 * erro com "Tentar de novo". Com dados, mostra `children`.
 */
export const EstadoDadosAdmin = ({
  aCarregar,
  erro,
  aoTentarDeNovo,
  temDados,
  children,
}: {
  aCarregar: boolean;
  erro: string | null;
  aoTentarDeNovo: () => void;
  temDados: boolean;
  children: ReactNode;
}) => {
  if (erro)
    return (
      <Aviso
        variante="erro"
        anunciar
        titulo="Não foi possível carregar"
        accao={
          <Botao variante="secundario" onClick={aoTentarDeNovo}>
            <RefreshCw aria-hidden />
            Tentar de novo
          </Botao>
        }
      >
        {erro}
      </Aviso>
    );
  if (aCarregar && !temDados)
    return (
      <p role="status" className="text-corpo text-tinta-suave">
        A carregar…
      </p>
    );
  return <>{children}</>;
};
