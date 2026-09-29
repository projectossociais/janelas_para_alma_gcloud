import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import UpcomingActivities from "./UpcomingActivities";

let listarAtividadesMock = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  voluntariadoApi: { listarAtividades: (...args: unknown[]) => listarAtividadesMock(...args) },
}));

const ATIVIDADE_FUTURA = {
  id: "at-1",
  titulo: "Rastreio na Gamek",
  descricao: "Sessão de rastreio ocular gratuita para a comunidade.",
  local: "Gamek, Luanda",
  data_inicio: "2099-01-10T09:00:00.000Z",
  data_fim: null,
  vagas: 10,
  inscritos: 7,
  estado: "publicada",
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("UpcomingActivities", () => {
  beforeEach(() => {
    listarAtividadesMock = vi.fn();
  });

  it("mostra as actividades futuras devolvidas pela API, com vagas restantes", async () => {
    listarAtividadesMock.mockResolvedValue([ATIVIDADE_FUTURA]);
    render(<UpcomingActivities />);

    await screen.findByText("Rastreio na Gamek");
    expect(screen.getByText("Gamek, Luanda")).toBeInTheDocument();
    expect(screen.getByText("3 vagas disponíveis")).toBeInTheDocument();
  });

  it("esconde uma actividade já terminada -- nunca mostra o passado como próxima acção", async () => {
    listarAtividadesMock.mockResolvedValue([
      { ...ATIVIDADE_FUTURA, id: "at-passada", titulo: "Já aconteceu", data_inicio: "2020-01-01T09:00:00.000Z" },
    ]);
    const { container } = render(<UpcomingActivities />);

    await waitFor(() => expect(listarAtividadesMock).toHaveBeenCalled());
    expect(screen.queryByText("Já aconteceu")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("sem vagas restantes, mostra 'Sem vagas' em vez de um número negativo", async () => {
    listarAtividadesMock.mockResolvedValue([{ ...ATIVIDADE_FUTURA, vagas: 5, inscritos: 5 }]);
    render(<UpcomingActivities />);

    await screen.findByText("Sem vagas");
  });

  it("uma falha ao carregar não rebenta a página -- nada aparece, nunca um erro visível", async () => {
    listarAtividadesMock.mockRejectedValue(new Error("falha de rede"));
    const { container } = render(<UpcomingActivities />);

    await waitFor(() => expect(listarAtividadesMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("sem nenhuma actividade publicada, a secção não aparece", async () => {
    listarAtividadesMock.mockResolvedValue([]);
    const { container } = render(<UpcomingActivities />);

    await waitFor(() => expect(listarAtividadesMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
