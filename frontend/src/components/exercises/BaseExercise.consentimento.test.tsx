import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import BaseExercise from "./BaseExercise";
import ptAO from "@/i18n/locales/pt-AO.json";

// Exercício desbloqueado (acesso pago confirmado), mas sem consentimento para
// dados de saúde: o exercício não pode ser montado, para ninguém fazer um teste
// que a API depois recusaria gravar (Lei 22/11, art. 14.º).
const garantir = vi.fn(() => Promise.resolve(false));
vi.mock("@/contexts/ConsentimentoSaudeContext", () => ({
  useConsentimentoSaude: () => ({
    consentido: false,
    carregando: false,
    garantir: () => garantir(),
    retirar: () => Promise.resolve(),
  }),
}));
vi.mock("@/contexts/AcessoExerciciosContext", () => ({
  useAcessoExercicios: () => ({ temAcesso: () => true, loading: false }),
}));
vi.mock("@/components/exercises/useAcaoDesbloqueio", () => ({
  useAcaoDesbloqueio: () => ({ tipoPara: () => null, executar: () => undefined }),
}));

describe("BaseExercise sem consentimento para dados de saúde", () => {
  it("não monta o exercício e oferece pedir a autorização", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <BaseExercise title="Teste" description="d" exercicioId="figure8" grupo="trial" tipo="teste">
          <p>conteúdo do exercício</p>
        </BaseExercise>
      </MemoryRouter>,
    );
    expect(screen.queryByText("conteúdo do exercício")).not.toBeInTheDocument();
    expect(screen.getByText(ptAO.ConsentimentoSaude.antesDeComecar)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: ptAO.ConsentimentoSaude.lerEAceitar }));
    expect(garantir).toHaveBeenCalledTimes(1);
  });
});
