import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

import Parceiros from "./Parceiros";

describe("Parceiros — endereço antigo da marcação", () => {
  it("/parceiros?agendar=optiotica segue para a página nova de marcação (links antigos e emails)", async () => {
    render(
      <MemoryRouter initialEntries={["/parceiros?agendar=optiotica"]}>
        <Routes>
          <Route path="/parceiros" element={<Parceiros />} />
          <Route path="/marcar-consulta" element={<p>Marcar consulta</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Marcar consulta")).toBeInTheDocument();
  });
});
