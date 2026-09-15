import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// --- mocks: RequireAdmin depende só de useAuth (sessão da API própria) ---
// Antes desta migração dependia de useSupabaseRole -- este teste existe
// precisamente para fixar que a porta do painel admin nunca mais volta a
// perguntar ao Supabase (ver docs/BACKLOG.md).

const useAuthMock = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

import RequireAdmin from "./RequireAdmin";

function renderComRota() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <div>Conteúdo do painel</div>
            </RequireAdmin>
          }
        />
        <Route path="/auth" element={<div>Página de login</div>} />
        <Route path="/" element={<div>Página inicial</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAdmin", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  it("mostra um spinner enquanto a sessão ainda está a ser verificada", () => {
    useAuthMock.mockReturnValue({ loading: true, isLoggedIn: false, isAdmin: false });
    const { container } = renderComRota();

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.queryByText("Conteúdo do painel")).not.toBeInTheDocument();
  });

  it("sem sessão, manda para /auth -- nunca mostra o painel", () => {
    useAuthMock.mockReturnValue({ loading: false, isLoggedIn: false, isAdmin: false });
    renderComRota();

    expect(screen.getByText("Página de login")).toBeInTheDocument();
    expect(screen.queryByText("Conteúdo do painel")).not.toBeInTheDocument();
  });

  it("com sessão mas sem ser admin, manda para / -- nunca mostra o painel", () => {
    useAuthMock.mockReturnValue({ loading: false, isLoggedIn: true, isAdmin: false });
    renderComRota();

    expect(screen.getByText("Página inicial")).toBeInTheDocument();
    expect(screen.queryByText("Conteúdo do painel")).not.toBeInTheDocument();
  });

  it("com sessão de admin, mostra o painel", () => {
    useAuthMock.mockReturnValue({ loading: false, isLoggedIn: true, isAdmin: true });
    renderComRota();

    expect(screen.getByText("Conteúdo do painel")).toBeInTheDocument();
  });
});
