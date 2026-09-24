import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { jogoApi, type PerfilJogadorPublico } from "@/lib/apiClient";
import { useProfile } from "@/contexts/ProfileContext";

interface CarteiraJogoContextType {
  /** Perfil de jogo (moedas, diamantes, estatísticas). `null` sem sessão ou antes de carregar. */
  perfil: PerfilJogadorPublico | null;
  aCarregar: boolean;
  /** O último carregamento falhou (a barra mostra 0; quem precisa avisa o jogador). */
  erro: boolean;
  /** Volta a pedir o perfil à API. */
  recarregar: () => Promise<void>;
  /** Substitui o perfil pelo que a API acabou de devolver (compra, recompensa...). */
  definirPerfil: (perfil: PerfilJogadorPublico) => void;
  /** Uso interno de `useCarteiraJogo` -- ver o comentário do provider. */
  pedirCarregamento: () => void;
}

const CarteiraJogoContext = createContext<CarteiraJogoContextType | undefined>(undefined);

/**
 * Carteira do jogo (moedas e diamantes), partilhada entre o Lobby, o jogo, a
 * Loja e o Perfil -- uma compra ou recompensa aparece logo na barra de
 * qualquer página, sem cada uma ter o seu próprio pedido e o seu próprio
 * saldo desactualizado.
 *
 * Carregamento preguiçoso: o provider vive na raiz da app, mas só pede
 * `/jogo/perfil` quando uma página do jogo usa `useCarteiraJogo`. Esse
 * endpoint cria o perfil de jogo na primeira leitura -- pedi-lo em qualquer
 * página criaria um perfil para toda a gente que só abriu a página inicial.
 *
 * O saldo aqui é só espelho: quem decide quanto se ganha ou gasta é sempre a
 * API (JogoService / LojaJogoService).
 */
export const CarteiraJogoProvider = ({ children }: { children: ReactNode }) => {
  const { profile } = useProfile();
  const utilizadorId = profile?.id ?? null;
  const [pedido, setPedido] = useState(false);
  const [perfil, setPerfil] = useState<PerfilJogadorPublico | null>(null);
  const [aCarregar, setACarregar] = useState(false);
  const [erro, setErro] = useState(false);
  // Evita que a resposta de um pedido antigo (ex.: antes de terminar sessão)
  // sobreponha o saldo de outra conta.
  const pedidoAtual = useRef(0);

  const recarregar = useCallback(async () => {
    const numero = ++pedidoAtual.current;
    if (!utilizadorId) {
      setPerfil(null);
      setACarregar(false);
      return;
    }
    setACarregar(true);
    setErro(false);
    try {
      const novo = await jogoApi.obterPerfil();
      if (numero === pedidoAtual.current) setPerfil(novo);
    } catch (err) {
      if (numero === pedidoAtual.current) setErro(true);
      // Sem bloquear o jogo -- a barra mostra 0 e o jogador continua a jogar.
      console.error("Falha ao carregar a carteira do jogo:", err);
    } finally {
      if (numero === pedidoAtual.current) setACarregar(false);
    }
  }, [utilizadorId]);

  useEffect(() => {
    if (!utilizadorId) {
      pedidoAtual.current++;
      setPerfil(null);
      setACarregar(false);
      return;
    }
    if (pedido) void recarregar();
  }, [pedido, utilizadorId, recarregar]);

  const definirPerfil = useCallback((novo: PerfilJogadorPublico) => {
    pedidoAtual.current++;
    setPerfil(novo);
    setErro(false);
    setACarregar(false);
  }, []);

  const pedirCarregamento = useCallback(() => setPedido(true), []);

  return (
    <CarteiraJogoContext.Provider value={{ perfil, aCarregar, erro, recarregar, definirPerfil, pedirCarregamento }}>
      {children}
    </CarteiraJogoContext.Provider>
  );
};

export const useCarteiraJogo = () => {
  const ctx = useContext(CarteiraJogoContext);
  if (!ctx) throw new Error("useCarteiraJogo deve ser usado dentro de CarteiraJogoProvider");
  const { pedirCarregamento } = ctx;
  useEffect(() => {
    pedirCarregamento();
  }, [pedirCarregamento]);
  return ctx;
};
