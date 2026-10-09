import { useCallback, useEffect, useRef, useState, type DependencyList, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Aviso } from "@/design/componentes/Aviso";
import { Botao } from "@/design/componentes/Botao";
import { mensagemDeErroApi } from "@/lib/apiClient";

/**
 * Dados de uma página do admin, com os três estados separados: a carregar,
 * erro, e os dados. Até 2026-10-09 as páginas guardavam só os dados: uma
 * falha deixava a lista vazia e o ecrã dizia "Sem utilizadores." ou mostrava
 * 0 em todas as métricas -- um número inventado num painel de decisão.
 */
export function useDadosAdmin<T>(carregar: () => Promise<T>, mensagemErro: string, deps: DependencyList) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const pedido = useRef(0);

  const recarregar = useCallback(async () => {
    const meu = ++pedido.current;
    setACarregar(true);
    setErro(null);
    try {
      const resposta = await carregar();
      if (meu === pedido.current) setDados(resposta);
    } catch (err) {
      // Um pedido antigo (ex.: período anterior) que falha depois não apaga o actual.
      if (meu === pedido.current) {
        setDados(null);
        setErro(mensagemDeErroApi(err, mensagemErro));
      }
    } finally {
      if (meu === pedido.current) setACarregar(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { dados, erro, aCarregar, recarregar, setDados };
}

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
