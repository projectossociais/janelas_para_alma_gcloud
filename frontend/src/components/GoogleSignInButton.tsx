import { useEffect, useRef } from "react";

interface GoogleCredentialResponse {
  credential: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const TENTATIVAS_MAXIMAS = 20;
const INTERVALO_TENTATIVA_MS = 150;

interface GoogleSignInButtonProps {
  onCredential: (credential: string) => void;
}

/**
 * Botão oficial "Entrar com a Google" (Google Identity Services). O script
 * (`index.html`) carrega com `async defer` -- pode ainda não estar pronto no
 * primeiro render, por isso tenta de novo por um curto período em vez de
 * assumir que `window.google` já existe.
 *
 * Sem `VITE_GOOGLE_CLIENT_ID` configurado, não mostra nada em vez de um
 * botão partido -- degradação honesta (CLAUDE.md, "nunca mostrar sucesso
 * antes de verificar", aplicado aqui a "nunca mostrar um botão que não
 * funciona").
 */
const GoogleSignInButton = ({ onCredential }: GoogleSignInButtonProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !containerRef.current) return;

    let cancelado = false;
    let tentativas = 0;

    const tentarInicializar = () => {
      if (cancelado) return;
      if (!window.google?.accounts?.id) {
        if (tentativas++ < TENTATIVAS_MAXIMAS) {
          window.setTimeout(tentarInicializar, INTERVALO_TENTATIVA_MS);
        }
        return;
      }
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => onCredential(response.credential),
      });
      if (containerRef.current) {
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "outline",
          size: "large",
          width: 320,
          text: "continue_with",
          locale: "pt-PT",
        });
      }
    };

    tentarInicializar();
    return () => {
      cancelado = true;
    };
  }, [onCredential]);

  if (!GOOGLE_CLIENT_ID) return null;

  return <div ref={containerRef} className="flex justify-center" />;
};

export default GoogleSignInButton;
