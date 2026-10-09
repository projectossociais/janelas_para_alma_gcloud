import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import userEvent from "@testing-library/user-event";

// papel: "profissional" é auto-registável sem verificação nenhuma -- este
// guard nunca decide pelo papel, só por GET /clinica/eu devolver uma
// clínica real (ligação criada por um admin).

const useAuthMock = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

const aMinhaClinica = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  clinicasApi: { aMinhaClinica: (...a: unknown[]) => aMinhaClinica(...a) },
}));

import RequireClinica from "./RequireClinica";

function renderComRota() {
  return render(
    <MemoryRouter initialEntries={["/dashboard-pro"]}>
      <Routes>
        <Route
          path="/dashboard-pro"
          element={
            <RequireClinica>{(clinica) => <div>Portal de {clinica.nome}</div>}</RequireClinica>
          }
        />
        <Route path="/auth" element={<div>Página de login</div>} />
        <Route path="/" element={<div>Página inicial</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireClinica", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    aMinhaClinica.mockReset();
  });

  it("sem sessão, manda para /auth -- nunca chama a API", async () => {
    useAuthMock.mockReturnValue({ loading: false, isLoggedIn: false });
    renderComRota();

    expect(await screen.findByText("Página de login")).toBeInTheDocument();
    expect(aMinhaClinica).not.toHaveBeenCalled();
  });

  it("com sessão mas sem clínica associada, manda para / -- nunca mostra o portal", async () => {
    useAuthMock.mockReturnValue({ loading: false, isLoggedIn: true });
    aMinhaClinica.mockResolvedValue(null);
    renderComRota();

    expect(await screen.findByText("Página inicial")).toBeInTheDocument();
  });

  it("com sessão e clínica associada, mostra o portal", async () => {
    useAuthMock.mockReturnValue({ loading: false, isLoggedIn: true });
    aMinhaClinica.mockResolvedValue({ id: "clinica-1", nome: "Óptica Optioptika" });
    renderComRota();

    expect(await screen.findByText("Portal de Óptica Optioptika")).toBeInTheDocument();
  });

  // Uma falha de rede não é "sem acesso": diz que não conseguiu verificar e deixa
  // tentar de novo (antes mandava para a página inicial sem explicação). E o
  // portal continua a nunca abrir sem a API confirmar a clínica.
  it("uma falha de rede nunca mostra o portal: diz que não conseguiu verificar e deixa tentar de novo", async () => {
    useAuthMock.mockReturnValue({ loading: false, isLoggedIn: true });
    aMinhaClinica.mockRejectedValueOnce(new Error("falha de rede")).mockResolvedValueOnce({ id: "c1", nome: "Óptica Optioptika" });
    renderComRota();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/Portal de/)).not.toBeInTheDocument();
    expect(screen.queryByText("Página inicial")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Portal de Óptica Optioptika")).toBeInTheDocument();
  });

  it("403 da API é 'sem acesso': manda para / sem mostrar o portal", async () => {
    useAuthMock.mockReturnValue({ loading: false, isLoggedIn: true });
    aMinhaClinica.mockRejectedValue(Object.assign(new Error("proibido"), { status: 403 }));
    renderComRota();

    await waitFor(() => expect(screen.getByText("Página inicial")).toBeInTheDocument());
    expect(screen.queryByText(/Portal de/)).not.toBeInTheDocument();
  });
});
