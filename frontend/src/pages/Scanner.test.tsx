import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Bug real: "Carregar Fotografia" nunca chamava a API de rastreio e mostrava
// sempre um diagnóstico de estrabismo tirado de Math.random() — um resultado
// clínico que ninguém calculou. A correcção remove essa opção por completo;
// este teste garante que não volta a aparecer.

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: vi.fn(), refreshSession: vi.fn() },
    storage: { from: vi.fn() },
    from: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/components/EyeLandmarkOverlay", () => ({
  default: () => null,
}));

vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/BackButton", () => ({ default: () => null }));

import Scanner from "./Scanner";

describe("Scanner", () => {
  it("não oferece upload de fotografia única — só a captura guiada por câmara", () => {
    render(
      <MemoryRouter>
        <Scanner />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/Carregar Fotografia/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Escolher ficheiro/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Usar Câmara/i })).toBeInTheDocument();
  });
});
