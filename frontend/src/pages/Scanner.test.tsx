import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Scanner from "./Scanner";

// O que importa aqui: a migração do guard de sessão (Supabase -> AuthContext
// próprio) nunca deixa a UI do scanner aparecer sem sessão confirmada, e
// nunca fica presa a meio (loading) nem redirecciona por engano com sessão
// válida. Ver CLAUDE.md secção 0 -- Supabase Auth já não existe.

vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

let mockAuth: { isLoggedIn: boolean; loading: boolean } = { isLoggedIn: false, loading: false };
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuth,
}));

const renderScanner = () =>
  render(
    <MemoryRouter initialEntries={["/scanner"]}>
      <Routes>
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/auth" element={<div>ecra-de-login</div>} />
      </Routes>
    </MemoryRouter>
  );

describe("Scanner — guarda de sessão", () => {
  it("sem sessão, redirecciona para /auth e nunca mostra a UI do scanner", async () => {
    mockAuth = { isLoggedIn: false, loading: false };
    renderScanner();

    await waitFor(() => expect(screen.getByText("ecra-de-login")).toBeInTheDocument());
    expect(screen.queryByText(/Área de Rastreio Visual/i)).not.toBeInTheDocument();
  });

  it("com sessão, mostra a UI do scanner sem redireccionar", async () => {
    mockAuth = { isLoggedIn: true, loading: false };
    renderScanner();

    expect(await screen.findByText(/Área de Rastreio Visual/i)).toBeInTheDocument();
    expect(screen.queryByText("ecra-de-login")).not.toBeInTheDocument();
  });

  it("enquanto a sessão ainda está a ser verificada, não mostra o scanner nem redirecciona cedo demais", () => {
    mockAuth = { isLoggedIn: false, loading: true };
    renderScanner();

    expect(screen.queryByText(/Área de Rastreio Visual/i)).not.toBeInTheDocument();
    expect(screen.queryByText("ecra-de-login")).not.toBeInTheDocument();
  });
});
