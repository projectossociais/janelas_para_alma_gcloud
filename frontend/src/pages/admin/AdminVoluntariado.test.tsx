import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const listarCandidaturas = vi.fn();
const aprovarCandidatura = vi.fn();
const rejeitarCandidatura = vi.fn();
const listarTodasAsAtividades = vi.fn();
const publicarAtividade = vi.fn();
const cancelarAtividade = vi.fn();
const arquivarAtividade = vi.fn();
const apagarAtividade = vi.fn();
const listarInscritos = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  voluntariadoApi: {
    listarCandidaturas: (...a: unknown[]) => listarCandidaturas(...a),
    aprovarCandidatura: (...a: unknown[]) => aprovarCandidatura(...a),
    rejeitarCandidatura: (...a: unknown[]) => rejeitarCandidatura(...a),
    listarTodasAsAtividades: (...a: unknown[]) => listarTodasAsAtividades(...a),
    publicarAtividade: (...a: unknown[]) => publicarAtividade(...a),
    cancelarAtividade: (...a: unknown[]) => cancelarAtividade(...a),
    arquivarAtividade: (...a: unknown[]) => arquivarAtividade(...a),
    apagarAtividade: (...a: unknown[]) => apagarAtividade(...a),
    listarInscritos: (...a: unknown[]) => listarInscritos(...a),
  },
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

import AdminVoluntariado from "./AdminVoluntariado";

const CANDIDATURA_PENDENTE = {
  id: "cand-1",
  utilizador_id: "user-1",
  utilizador_email: "ana@example.com",
  utilizador_nome: "Ana",
  motivacao: "Quero ajudar",
  telefone: null,
  status: "pendente",
  decidido_por: null,
  decidido_em: null,
  created_at: "2026-01-01T00:00:00.000Z",
};

const ATIVIDADE = {
  id: "ativ-1",
  titulo: "Rastreio comunitário",
  descricao: "Ajudar no rastreio",
  local: "Luanda",
  data_inicio: "2026-02-01T09:00:00.000Z",
  data_fim: null,
  vagas: 10,
  inscritos: 3,
  estado: "publicada",
  criado_por: "admin-1",
  created_at: "2026-01-01T00:00:00.000Z",
};

function renderPage() {
  return render(<AdminVoluntariado />, { wrapper: MemoryRouter });
}

describe("AdminVoluntariado", () => {
  beforeEach(() => {
    listarCandidaturas.mockReset().mockResolvedValue([]);
    aprovarCandidatura.mockReset();
    rejeitarCandidatura.mockReset();
    listarTodasAsAtividades.mockReset().mockResolvedValue([]);
    publicarAtividade.mockReset();
    cancelarAtividade.mockReset();
    arquivarAtividade.mockReset();
    apagarAtividade.mockReset();
    listarInscritos.mockReset().mockResolvedValue([]);
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("mostra candidaturas pendentes com acções de aprovar/rejeitar", async () => {
    listarCandidaturas.mockResolvedValue([CANDIDATURA_PENDENTE]);
    renderPage();

    expect(await screen.findByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Quero ajudar")).toBeInTheDocument();
  });

  it("aprova uma candidatura e recarrega a lista", async () => {
    listarCandidaturas
      .mockResolvedValueOnce([CANDIDATURA_PENDENTE])
      .mockResolvedValueOnce([{ ...CANDIDATURA_PENDENTE, status: "aprovada" }]);
    aprovarCandidatura.mockResolvedValue({ ...CANDIDATURA_PENDENTE, status: "aprovada" });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /Aprovar/i }));

    await waitFor(() => expect(aprovarCandidatura).toHaveBeenCalledWith("cand-1"));
    expect(toastSuccess).toHaveBeenCalledWith("Candidatura aprovada. Já é voluntário activo.");
  });

  it("nunca mostra sucesso se rejeitar falhar", async () => {
    listarCandidaturas.mockResolvedValue([CANDIDATURA_PENDENTE]);
    rejeitarCandidatura.mockRejectedValue(Object.assign(new Error("falhou"), { status: 500 }));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /Rejeitar/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("falhou"));
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("publica uma actividade nova", async () => {
    publicarAtividade.mockResolvedValue(ATIVIDADE);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: /Actividades/i }));
    await user.type(screen.getByLabelText("Título"), "Rastreio comunitário");
    await user.type(screen.getByLabelText("Local"), "Luanda");
    await user.type(screen.getByLabelText("Descrição"), "Ajudar no rastreio");
    const dataInicio = screen.getByLabelText("Data de início");
    await user.type(dataInicio, "2026-02-01T09:00");

    await user.click(screen.getByRole("button", { name: /Publicar actividade/i }));

    await waitFor(() => expect(publicarAtividade).toHaveBeenCalled());
    expect(toastSuccess).toHaveBeenCalledWith(
      "Actividade publicada. Os voluntários activos foram notificados por email."
    );
  });

  it("mostra as actividades existentes e o botão de ver inscritos", async () => {
    listarTodasAsAtividades.mockResolvedValue([ATIVIDADE]);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: /Actividades/i }));
    expect(await screen.findByText("Rastreio comunitário")).toBeInTheDocument();

    listarInscritos.mockResolvedValue([
      { id: "insc-1", atividade_id: "ativ-1", atividade_titulo: "Rastreio comunitário", atividade_data_inicio: ATIVIDADE.data_inicio, atividade_local: "Luanda", utilizador_id: "user-1", utilizador_email: "ana@example.com", utilizador_nome: "Ana", estado: "inscrito", created_at: "2026-01-01T00:00:00.000Z" },
    ]);
    await user.click(screen.getByRole("button", { name: /Inscritos/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("ana@example.com")).toBeInTheDocument();
  });

  describe("filtros de actividades (gestão com muitas actividades)", () => {
    const PUBLICADA_PASSADA = {
      ...ATIVIDADE,
      id: "ativ-passada",
      titulo: "Rastreio já feito",
      data_inicio: "2020-01-01T09:00:00.000Z",
      estado: "publicada",
    };
    const CANCELADA_FUTURA = {
      ...ATIVIDADE,
      id: "ativ-cancelada",
      titulo: "Rastreio cancelado",
      data_inicio: "2099-01-01T09:00:00.000Z",
      estado: "cancelada",
    };

    it("filtra por estado -- só mostra as canceladas", async () => {
      listarTodasAsAtividades.mockResolvedValue([PUBLICADA_PASSADA, CANCELADA_FUTURA]);
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("tab", { name: /Actividades/i }));
      expect(await screen.findByText("Rastreio já feito")).toBeInTheDocument();
      expect(screen.getByText("Rastreio cancelado")).toBeInTheDocument();

      // Dois selects sem label -- o primeiro é o de estado (ver AdminVoluntariado.tsx).
      await user.click(screen.getAllByRole("combobox")[0]);
      await user.click(await screen.findByRole("option", { name: "Canceladas" }));

      expect(screen.queryByText("Rastreio já feito")).not.toBeInTheDocument();
      expect(screen.getByText("Rastreio cancelado")).toBeInTheDocument();
    });

    it("filtra por período -- só mostra as que já aconteceram", async () => {
      listarTodasAsAtividades.mockResolvedValue([PUBLICADA_PASSADA, CANCELADA_FUTURA]);
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("tab", { name: /Actividades/i }));
      expect(await screen.findByText("Rastreio já feito")).toBeInTheDocument();

      await user.click(screen.getAllByRole("combobox")[1]);
      await user.click(await screen.findByRole("option", { name: "Já aconteceram" }));

      expect(screen.getByText("Rastreio já feito")).toBeInTheDocument();
      expect(screen.queryByText("Rastreio cancelado")).not.toBeInTheDocument();
    });

    it("mostra aviso distinto quando os filtros não têm nenhum resultado (não confunde com 'sem actividades')", async () => {
      listarTodasAsAtividades.mockResolvedValue([PUBLICADA_PASSADA]);
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("tab", { name: /Actividades/i }));
      await screen.findByText("Rastreio já feito");

      await user.click(screen.getAllByRole("combobox")[0]);
      await user.click(await screen.findByRole("option", { name: "Canceladas" }));

      expect(screen.getByText("Nenhuma actividade corresponde aos filtros.")).toBeInTheDocument();
      expect(screen.queryByText("Nenhuma actividade ainda.")).not.toBeInTheDocument();
    });
  });

  describe("arquivar e apagar (a lista não pode crescer sem fim)", () => {
    it("arquivar esconde a actividade do filtro 'Todos os estados' por omissão", async () => {
      arquivarAtividade.mockResolvedValue({ ...ATIVIDADE, estado: "arquivada" });
      listarTodasAsAtividades.mockResolvedValueOnce([ATIVIDADE]).mockResolvedValueOnce([
        { ...ATIVIDADE, estado: "arquivada" },
      ]);
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("tab", { name: /Actividades/i }));
      await screen.findByText("Rastreio comunitário");

      await user.click(screen.getByRole("button", { name: /Arquivar/i }));

      await waitFor(() => expect(arquivarAtividade).toHaveBeenCalledWith("ativ-1"));
      await waitFor(() => expect(screen.queryByText("Rastreio comunitário")).not.toBeInTheDocument());
    });

    it("o filtro 'Arquivadas' continua a mostrar a actividade arquivada", async () => {
      listarTodasAsAtividades.mockResolvedValue([{ ...ATIVIDADE, estado: "arquivada" }]);
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("tab", { name: /Actividades/i }));
      expect(screen.queryByText("Rastreio comunitário")).not.toBeInTheDocument();

      await user.click(screen.getAllByRole("combobox")[0]);
      await user.click(await screen.findByRole("option", { name: "Arquivadas" }));

      expect(await screen.findByText("Rastreio comunitário")).toBeInTheDocument();
    });

    it("apagar pede confirmação antes de chamar a API", async () => {
      apagarAtividade.mockResolvedValue(undefined);
      listarTodasAsAtividades.mockResolvedValue([ATIVIDADE]);
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("tab", { name: /Actividades/i }));
      await screen.findByText("Rastreio comunitário");

      await user.click(screen.getByRole("button", { name: /Apagar/i }));
      expect(apagarAtividade).not.toHaveBeenCalled();

      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Apagar" }));

      await waitFor(() => expect(apagarAtividade).toHaveBeenCalledWith("ativ-1"));
    });

    it("uma actividade com inscrições nunca é apagada em silêncio -- mostra o erro da API", async () => {
      apagarAtividade.mockRejectedValue(
        Object.assign(new Error("esta actividade tem inscrições -- arquive em vez de apagar"), { status: 409 }),
      );
      listarTodasAsAtividades.mockResolvedValue([ATIVIDADE]);
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("tab", { name: /Actividades/i }));
      await screen.findByText("Rastreio comunitário");

      await user.click(screen.getByRole("button", { name: /Apagar/i }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Apagar" }));

      await waitFor(() =>
        expect(toastError).toHaveBeenCalledWith("esta actividade tem inscrições -- arquive em vez de apagar"),
      );
      expect(screen.getByText("Rastreio comunitário")).toBeInTheDocument();
    });
  });
});
