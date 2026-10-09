import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { violacoesAcessibilidade } from "@/design/testes/acessibilidade";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const useAuthMock = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

const aMinhaClinica = vi.fn();
const meusAgendamentos = vi.fn();
const minhaDisponibilidade = vi.fn();
const adicionarDisponibilidade = vi.fn();
const removerDisponibilidade = vi.fn();
const obterTeleconsulta = vi.fn();
const iniciarTeleconsulta = vi.fn();
const concluirTeleconsulta = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  clinicasApi: {
    aMinhaClinica: (...a: unknown[]) => aMinhaClinica(...a),
    meusAgendamentos: (...a: unknown[]) => meusAgendamentos(...a),
    minhaDisponibilidade: (...a: unknown[]) => minhaDisponibilidade(...a),
    adicionarDisponibilidade: (...a: unknown[]) => adicionarDisponibilidade(...a),
    removerDisponibilidade: (...a: unknown[]) => removerDisponibilidade(...a),
    obterTeleconsulta: (...a: unknown[]) => obterTeleconsulta(...a),
    iniciarTeleconsulta: (...a: unknown[]) => iniciarTeleconsulta(...a),
    concluirTeleconsulta: (...a: unknown[]) => concluirTeleconsulta(...a),
  },
  linkDaSalaVideo: (sala: string) => `https://meet.jit.si/${sala}`,
  mensagemDeErroApi: (_err: unknown, fallback: string) => fallback,
}));

vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() } }));

import DashboardPro from "./DashboardPro";

describe("DashboardPro", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({ loading: false, isLoggedIn: true, user: { name: "Ana" } });
    aMinhaClinica.mockReset();
    meusAgendamentos.mockReset();
    minhaDisponibilidade.mockReset();
    adicionarDisponibilidade.mockReset();
    removerDisponibilidade.mockReset();
    obterTeleconsulta.mockReset();
    iniciarTeleconsulta.mockReset();
    concluirTeleconsulta.mockReset();
    toastError.mockReset();
    minhaDisponibilidade.mockResolvedValue([]);
  });

  it("sem clínica associada, nunca mostra o painel", async () => {
    aMinhaClinica.mockResolvedValue(null);
    render(<DashboardPro />, { wrapper: MemoryRouter });

    await waitFor(() => expect(aMinhaClinica).toHaveBeenCalled());
    expect(screen.queryByText("Pedidos de consulta")).not.toBeInTheDocument();
  });

  // Caso real (2026-10-09): "Teleconsultas agendadas" contava todas as
  // consultas confirmadas -- presenciais e já passadas incluídas.
  it("conta os pedidos por confirmar e só as teleconsultas confirmadas ainda por acontecer", async () => {
    aMinhaClinica.mockResolvedValue({ id: "clinica-1", nome: "Óptica Optioptika" });
    obterTeleconsulta.mockResolvedValue(null);
    meusAgendamentos.mockResolvedValue([
      { id: "1", estado: "pendente", nome: "Ana Silva", email: "ana@example.com", telefone: "+244900000000" },
      { id: "2", estado: "pendente", nome: "Bruno", email: "bruno@example.com", telefone: "+244900000001" },
      { id: "3", estado: "confirmada", modalidade: "online", horario_inicio: "2099-01-04T09:00:00.000Z", nome: "Carla", email: "c@example.com", telefone: "1" },
      { id: "4", estado: "confirmada", modalidade: "presencial", horario_inicio: "2099-01-05T09:00:00.000Z", nome: "Dino", email: "d@example.com", telefone: "2" },
      { id: "5", estado: "confirmada", modalidade: "online", horario_inicio: "2020-01-05T09:00:00.000Z", nome: "Eva", email: "e@example.com", telefone: "3" },
    ]);

    render(<DashboardPro />, { wrapper: MemoryRouter });

    expect(await screen.findByText("Ana Silva")).toBeInTheDocument();
    const metrica = (rotulo: string) => screen.getByText(rotulo).parentElement as HTMLElement;
    expect(metrica("Pedidos por confirmar")).toHaveTextContent("2");
    expect(metrica("Teleconsultas agendadas")).toHaveTextContent("1");
  });

  // Caso real (2026-10-09): a lista não dizia quando era a consulta.
  it("cada consulta diz quando é, em hora de Luanda", async () => {
    aMinhaClinica.mockResolvedValue({ id: "clinica-1", nome: "Óptica Optioptika" });
    meusAgendamentos.mockResolvedValue([
      { id: "1", estado: "pendente", modalidade: "presencial", horario_inicio: "2099-01-04T09:00:00.000Z", nome: "Ana Silva", email: "a@example.com", telefone: "1" },
    ]);
    render(<DashboardPro />, { wrapper: MemoryRouter });
    expect(await screen.findByText(/10:00 \(hora de Luanda\)/)).toBeInTheDocument();
  });

  it("não chama 'Dr.' a toda a equipa", async () => {
    aMinhaClinica.mockResolvedValue({ id: "clinica-1", nome: "Óptica Optioptika" });
    meusAgendamentos.mockResolvedValue([]);
    render(<DashboardPro />, { wrapper: MemoryRouter });
    expect(await screen.findByText("Bem-vindo(a), Ana. Óptica Optioptika.")).toBeInTheDocument();
    expect(screen.queryByText(/Dr/)).not.toBeInTheDocument();
  });

  it("uma falha ao carregar os agendamentos mostra erro, nunca rebenta o ecrã", async () => {
    aMinhaClinica.mockResolvedValue({ id: "clinica-1", nome: "Óptica Optioptika" });
    meusAgendamentos.mockRejectedValue(new Error("falha de rede"));

    render(<DashboardPro />, { wrapper: MemoryRouter });

    expect(await screen.findAllByText("Óptica Optioptika", { exact: false })).not.toHaveLength(0);
    // O erro fica escrito na página, nunca "Ainda sem pedidos de consulta."
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("Ainda sem pedidos de consulta.")).not.toBeInTheDocument();
  });

  it("mostra a disponibilidade já guardada e permite adicionar um novo horário", async () => {
    aMinhaClinica.mockResolvedValue({ id: "clinica-1", nome: "Óptica Optioptika" });
    meusAgendamentos.mockResolvedValue([]);
    minhaDisponibilidade.mockResolvedValue([
      { id: "disp-1", clinica_id: "clinica-1", dia_semana: 0, hora_inicio: "08:00:00", hora_fim: "12:00:00", modalidade: "presencial" },
    ]);
    adicionarDisponibilidade.mockResolvedValue({
      id: "disp-2",
      clinica_id: "clinica-1",
      dia_semana: 0,
      hora_inicio: "08:00:00",
      hora_fim: "12:00:00",
      modalidade: "presencial",
    });
    const user = userEvent.setup();

    render(<DashboardPro />, { wrapper: MemoryRouter });

    expect(await screen.findByText("08:00 — 12:00")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Adicionar horário/i }));

    await waitFor(() => expect(adicionarDisponibilidade).toHaveBeenCalled());
  });

  it("consulta online confirmada mostra o link da sala e permite iniciar/concluir", async () => {
    aMinhaClinica.mockResolvedValue({ id: "clinica-1", nome: "Óptica Optioptika" });
    meusAgendamentos.mockResolvedValue([
      { id: "ag-1", estado: "confirmada", modalidade: "online", nome: "Ana Silva", email: "ana@example.com", telefone: "+244900000000" },
    ]);
    obterTeleconsulta.mockResolvedValue({
      id: "tele-1",
      agendamento_id: "ag-1",
      sala_video: "janelas-para-alma-abc123",
      estado: "agendada",
      iniciada_em: null,
      concluida_em: null,
      recomendacao_clinica: null,
    });
    iniciarTeleconsulta.mockResolvedValue({
      id: "tele-1",
      agendamento_id: "ag-1",
      sala_video: "janelas-para-alma-abc123",
      estado: "em_curso",
      iniciada_em: "2027-01-04T09:00:00.000Z",
      concluida_em: null,
      recomendacao_clinica: null,
    });
    concluirTeleconsulta.mockResolvedValue({
      id: "tele-1",
      agendamento_id: "ag-1",
      sala_video: "janelas-para-alma-abc123",
      estado: "concluida",
      iniciada_em: "2027-01-04T09:00:00.000Z",
      concluida_em: "2027-01-04T09:20:00.000Z",
      recomendacao_clinica: "Usar óculos com grau X.",
    });
    const user = userEvent.setup();

    render(<DashboardPro />, { wrapper: MemoryRouter });

    const linkSala = await screen.findByRole("link", { name: /Entrar na sala/i });
    expect(linkSala).toHaveAttribute("href", "https://meet.jit.si/janelas-para-alma-abc123");

    await user.click(screen.getByRole("button", { name: /Iniciar consulta/i }));
    await waitFor(() => expect(iniciarTeleconsulta).toHaveBeenCalledWith("ag-1"));

    const textarea = await screen.findByPlaceholderText(/Escreva a recomendação clínica/i);
    await user.type(textarea, "Usar óculos com grau X.");
    await user.click(screen.getByRole("button", { name: /Concluir e enviar recomendação/i }));

    await waitFor(() => expect(concluirTeleconsulta).toHaveBeenCalledWith("ag-1", "Usar óculos com grau X."));
    expect(await screen.findByText(/Usar óculos com grau X\./)).toBeInTheDocument();
  });

  it("remover um horário tem nome e pede confirmação", async () => {
    aMinhaClinica.mockResolvedValue({ id: "clinica-1", nome: "Óptica Optioptika" });
    meusAgendamentos.mockResolvedValue([]);
    minhaDisponibilidade.mockResolvedValue([
      { id: "disp-1", clinica_id: "clinica-1", dia_semana: 0, hora_inicio: "08:00:00", hora_fim: "12:00:00", modalidade: "presencial" },
    ]);
    removerDisponibilidade.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<DashboardPro />, { wrapper: MemoryRouter });

    await user.click(await screen.findByRole("button", { name: "Remover o horário de Segunda-feira, 08:00–12:00 (Presencial)" }));
    expect(removerDisponibilidade).not.toHaveBeenCalled();
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Remover" }));
    await waitFor(() => expect(removerDisponibilidade).toHaveBeenCalledWith("disp-1"));
  });

  it("um horário que acaba antes de começar não se envia", async () => {
    aMinhaClinica.mockResolvedValue({ id: "clinica-1", nome: "Óptica Optioptika" });
    meusAgendamentos.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<DashboardPro />, { wrapper: MemoryRouter });

    const fim = await screen.findByLabelText("Hora de fim");
    await user.clear(fim);
    await user.type(fim, "07:00");
    expect(fim).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: /Adicionar horário/i })).toBeDisabled();
  });

  it("sem violações de acessibilidade", async () => {
    aMinhaClinica.mockResolvedValue({ id: "clinica-1", nome: "Óptica Optioptika" });
    meusAgendamentos.mockResolvedValue([
      { id: "1", estado: "pendente", modalidade: "presencial", horario_inicio: "2099-01-04T09:00:00.000Z", nome: "Ana Silva", email: "a@example.com", telefone: "1" },
    ]);
    const { container } = render(<DashboardPro />, { wrapper: MemoryRouter });
    await screen.findByText("Ana Silva");
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
