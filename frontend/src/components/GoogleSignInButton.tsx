import { useEffect, useId, useRef } from "react";

// Formas mínimas do Google Identity Services que usamos -- a biblioteca
// carrega globalmente via <script> em index.html, não como módulo importável.
interface CredencialGoogle {
  credential: string;
}

interface GoogleAccountsId {
  initialize: (config: { client_id: string; callback: (resposta: CredencialGoogle) => void }) => void;
  renderButton: (elemento: HTMLElement, opcoes: Record<string, string>) => void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

interface GoogleSignInButtonProps {
  onCredential: (idToken: string) => void;
}

/** Botão "Continuar com o Google" — usa o Google Identity Services (carregado
 *  em index.html), nunca um redireccionamento para fora do site. Sem
 *  `VITE_GOOGLE_CLIENT_ID` configurado, não renderiza nada (em vez de um
 *  botão partido). */
const GoogleSignInButton = ({ onCredential }: GoogleSignInButtonProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementId = useId();
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!clientId || !containerRef.current) return;

    let cancelado = false;
    // O <script> do Google carrega de forma assíncrona (async defer) --
    // pode ainda não estar pronto quando este efeito corre. Espera por ele
    // em vez de assumir que já existe.
    const tentarInicializar = () => {
      if (cancelado) return;
      const accountsId = window.google?.accounts?.id;
      if (!accountsId || !containerRef.current) {
        setTimeout(tentarInicializar, 100);
        return;
      }
      accountsId.initialize({
        client_id: clientId,
        callback: (resposta) => onCredential(resposta.credential),
      });
      accountsId.renderButton(containerRef.current, {
        theme: "outline",
        size: "large",
        width: "336",
        text: "continue_with",
      });
    };
    tentarInicializar();

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (!clientId) return null;

  return <div ref={containerRef} id={elementId} className="flex justify-center" />;
};

export default GoogleSignInButton;
