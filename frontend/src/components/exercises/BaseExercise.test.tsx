import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BaseExercise from "./BaseExercise";
import ptAO from "@/i18n/locales/pt-AO.json";
import enUS from "@/i18n/locales/en-US.json";

// O botão "Ver vídeo explicativo" foi retirado dos exercícios (2026-09-28,
// decisão do produto: não há vídeos). Estes testes falham se voltar a
// aparecer na casca, com o exercício desbloqueado -- o único estado em que
// ele aparecia, por isso um teste só com o ecrã bloqueado não provaria nada.

vi.mock("@/contexts/AcessoExerciciosContext", () => ({
  useAcessoExercicios: () => ({ temAcesso: () => true, loading: false }),
}));
vi.mock("@/components/exercises/useAcaoDesbloqueio", () => ({
  useAcaoDesbloqueio: () => ({ tipoPara: () => null, executar: () => undefined, aIniciarTrial: false }),
}));

const IDS = [
  "figure8",
  "cerebro",
  "relax",
  "estereopsia",
  "ambliopia",
  "sacadas-convergencia",
  "convergence",
  "flexibilidade-acomodativa",
] as const;

describe("BaseExercise (casca dos exercícios)", () => {
  it.each(IDS)("%s desbloqueado: cabeçalho só com título, descrição e Sair", (id) => {
    render(
      <MemoryRouter>
        <BaseExercise title="Título" description="Descrição" exercicioId={id} grupo="trial" tipo="teste">
          <p>conteúdo</p>
        </BaseExercise>
      </MemoryRouter>,
    );

    expect(screen.getByText("conteúdo")).toBeInTheDocument();
    expect(screen.queryByText(/v[ií]deo/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /v[ií]deo|explicativo/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sair/i })).toBeInTheDocument();
  });

  it("não há chave de tradução do botão de vídeo nos ficheiros PT e EN", () => {
    for (const locale of [ptAO, enUS] as Record<string, Record<string, string>>[]) {
      expect(locale.ExercicioVideo).toBeUndefined();
      const textos = Object.values(locale.BaseExercise ?? {}).concat(Object.values(locale.Visao ?? {}));
      expect(textos.some((x) => /v[ií]deo/i.test(x) && /explicativo|explainer/i.test(x))).toBe(false);
    }
  });
});
