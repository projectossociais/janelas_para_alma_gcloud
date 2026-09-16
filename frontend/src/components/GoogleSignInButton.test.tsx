import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import GoogleSignInButton from "./GoogleSignInButton";

const ORIGINAL_ENV = { ...import.meta.env };

describe("GoogleSignInButton", () => {
  afterEach(() => {
    Object.assign(import.meta.env, ORIGINAL_ENV);
    delete window.google;
    vi.restoreAllMocks();
  });

  it("não renderiza nada sem VITE_GOOGLE_CLIENT_ID configurado", () => {
    (import.meta.env as Record<string, string>).VITE_GOOGLE_CLIENT_ID = "";
    const { container } = render(<GoogleSignInButton onCredential={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("inicializa o Google Identity Services e desenha o botão quando disponível", async () => {
    (import.meta.env as Record<string, string>).VITE_GOOGLE_CLIENT_ID = "client-id-de-teste";
    const initialize = vi.fn();
    const renderButton = vi.fn();
    window.google = { accounts: { id: { initialize, renderButton } } };

    render(<GoogleSignInButton onCredential={vi.fn()} />);

    await waitFor(() => expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: "client-id-de-teste" }),
    ));
    expect(renderButton).toHaveBeenCalled();
  });

  it("chama onCredential com o token quando o Google devolve uma credencial", async () => {
    (import.meta.env as Record<string, string>).VITE_GOOGLE_CLIENT_ID = "client-id-de-teste";
    let callbackCapturado: ((r: { credential: string }) => void) | undefined;
    window.google = {
      accounts: {
        id: {
          initialize: ({ callback }) => {
            callbackCapturado = callback;
          },
          renderButton: vi.fn(),
        },
      },
    };
    const onCredential = vi.fn();
    render(<GoogleSignInButton onCredential={onCredential} />);

    await waitFor(() => expect(callbackCapturado).toBeDefined());
    callbackCapturado?.({ credential: "id-token-de-teste" });

    expect(onCredential).toHaveBeenCalledWith("id-token-de-teste");
  });

  it("espera o script do Google carregar antes de inicializar", async () => {
    (import.meta.env as Record<string, string>).VITE_GOOGLE_CLIENT_ID = "client-id-de-teste";
    const initialize = vi.fn();
    render(<GoogleSignInButton onCredential={vi.fn()} />);

    // Ainda não existe window.google -- não deve rebentar, só continuar a tentar.
    expect(initialize).not.toHaveBeenCalled();

    window.google = { accounts: { id: { initialize, renderButton: vi.fn() } } };
    await waitFor(() => expect(initialize).toHaveBeenCalled(), { timeout: 1000 });
  });
});
