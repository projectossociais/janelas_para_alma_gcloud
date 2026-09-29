import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { EscolherOlho } from "./AssistenteTreino";
import type { SessaoExercicioPublica } from "@/lib/apiClient";

// Perfil "Não sei" (Fase 4.1): recomenda primeiro o Teste de Acuidade e, com
// o teste feito, sugere o olho com o pior resultado -- sem o gravar sozinho.

const setProfile = vi.fn();
vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: { olho_mais_fraco: "nao_sei" }, setProfile: (...a: unknown[]) => setProfile(...a) }),
}));
const atualizar = vi.fn();
vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/apiClient")>()),
  perfilApi: { atualizar: (...a: unknown[]) => atualizar(...a) },
}));

const acuidade = (olho: string, limiar: number | null) =>
  ({ exercicio_id: "figure8", olho, limiar, created_at: "2026-09-28T10:00:00Z" }) as SessaoExercicioPublica;

const abrir = (historico: SessaoExercicioPublica[], aoEscolher = vi.fn()) => {
  render(
    <MemoryRouter>
      <EscolherOlho historico={historico} aoEscolher={aoEscolher} />
    </MemoryRouter>,
  );
  return aoEscolher;
};

describe("EscolherOlho com \"Não sei\"", () => {
  beforeEach(() => {
    atualizar.mockReset();
    setProfile.mockReset();
  });

  it("sem Teste de Acuidade, recomenda fazê-lo primeiro e não deixa o treino arrancar", () => {
    const aoEscolher = abrir([]);
    expect(screen.getByText("Primeiro, descubra qual é o olho mais fraco")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fazer o Teste de Acuidade" })).toHaveAttribute("href", "/exercicios/acuidade");
    expect(aoEscolher).not.toHaveBeenCalled();
    expect(atualizar).not.toHaveBeenCalled();
  });

  it("com o teste feito, sugere o olho de pior resultado e só grava depois de confirmar", async () => {
    atualizar.mockResolvedValue({ olho_mais_fraco: "esquerdo" });
    const aoEscolher = abrir([acuidade("direito", 0.1), acuidade("esquerdo", 0.4)]);

    expect(screen.getByText("O Teste de Acuidade indica o olho esquerdo")).toBeInTheDocument();
    expect(atualizar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Treinar o olho esquerdo/ }));
    await waitFor(() => expect(aoEscolher).toHaveBeenCalledWith("esquerdo"));
    expect(atualizar).toHaveBeenCalledWith({ olho_mais_fraco: "esquerdo" });
  });

  it("se a gravação falhar, não arranca o treino e mostra o erro", async () => {
    atualizar.mockRejectedValue(new Error("500"));
    const aoEscolher = abrir([acuidade("direito", null), acuidade("esquerdo", 0.2)]);
    fireEvent.click(screen.getByRole("button", { name: /Treinar o olho direito/ }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(aoEscolher).not.toHaveBeenCalled();
  });

  it("com os dois olhos iguais no teste, não sugere nenhum e recomenda a consulta", () => {
    abrir([acuidade("direito", 0.2), acuidade("esquerdo", 0.2)]);
    expect(screen.getByText(/os dois olhos tiveram o mesmo resultado/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Treinar o/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Repetir o Teste de Acuidade" })).toBeInTheDocument();
  });
});
