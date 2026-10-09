import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";
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
