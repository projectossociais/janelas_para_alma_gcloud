import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// O formulário de contacto grava na API própria. O que importa testar é o
// caminho do erro: nunca mostrar "registada" quando a gravação falha
// (CLAUDE.md, "Nunca mostrar sucesso antes de verificar error/excepção").
//
// A candidatura a voluntário (mesmo componente) já usava uma Edge Function
// que nunca gravava nada (W-16, docs/BACKLOG.md) — corrigida para chamar
// voluntariadoApi.candidatar, atrás de uma exigência de sessão (o endpoint
// real exige-a; ver api/app/routers/voluntariado.py).

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("react-router-dom")>();
  return { ...original, useNavigate: () => navigateMock };
});

const enviar = vi.fn();
const candidatar = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  contactMessagesApi: { enviar: (...a: unknown[]) => enviar(...a) },
  voluntariadoApi: { candidatar: (...a: unknown[]) => candidatar(...a) },
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));

let mockIsLoggedIn = true;
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoggedIn: mockIsLoggedIn }),
}));

vi.mock("@/components/ProgramModal", () => ({ default: () => null }));

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

import ContactSection from "./ContactSection";

async function abrirEPreencherContacto(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Envie-nos uma mensagem/i }));
  await user.type(await screen.findByPlaceholderText("O seu nome"), "Ana Silva");
  await user.type(screen.getByPlaceholderText("email@exemplo.com"), "ana@example.com");
  await user.type(screen.getByPlaceholderText("Como podemos ajudar?"), "Tenho uma dúvida sobre o rastreio.");
  await user.click(screen.getByRole("button", { name: /Enviar Mensagem/i }));
}

async function abrirBeneficios(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Voluntariado/i }));
  await user.click(await screen.findByRole("button", { name: /Quero ser um Kamba/i }));
}

describe("ContactSection — formulário de contacto", () => {
  beforeEach(() => {
    enviar.mockReset();
    candidatar.mockReset();
    navigateMock.mockReset();
    toast.mockReset();
    mockIsLoggedIn = true;
  });

  it("nunca mostra sucesso quando a API falha ao gravar", async () => {
    enviar.mockRejectedValue(Object.assign(new Error("Serviço indisponível"), { status: 500 }));
    const user = userEvent.setup();
    render(<ContactSection />, { wrapper: MemoryRouter });

    await abrirEPreencherContacto(user);

    await waitFor(() => expect(enviar).toHaveBeenCalledWith(
      "Ana Silva",
      "ana@example.com",
      "Tenho uma dúvida sobre o rastreio.",
    ));
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Erro ao enviar", variant: "destructive" }),
    );
    expect(toast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/registada/i) }),
    );
  });

  it("mostra sucesso só depois de a API confirmar a gravação", async () => {
    enviar.mockResolvedValue({ id: "msg-1" });
    const user = userEvent.setup();
    render(<ContactSection />, { wrapper: MemoryRouter });

    await abrirEPreencherContacto(user);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Mensagem registada!" })),
    );
  });
});

describe("ContactSection — candidatura a voluntário (\"Quero ser um Kamba\")", () => {
  beforeEach(() => {
    enviar.mockReset();
    candidatar.mockReset();
    navigateMock.mockReset();
    toast.mockReset();
    mockIsLoggedIn = true;
  });

  it("sem sessão, nunca abre o formulário — só redirecciona para o login", async () => {
    mockIsLoggedIn = false;
    const user = userEvent.setup();
    render(<ContactSection />, { wrapper: MemoryRouter });

    await abrirBeneficios(user);

    expect(navigateMock).toHaveBeenCalledWith("/auth?next=/junte-se");
    expect(screen.queryByText("Formulário de Inscrição")).not.toBeInTheDocument();
    expect(candidatar).not.toHaveBeenCalled();
  });

  it("com sessão, candidata-se com motivação e telefone, nunca nome ou email", async () => {
    candidatar.mockResolvedValue({ id: "cand-1", status: "pendente" });
    const user = userEvent.setup();
    render(<ContactSection />, { wrapper: MemoryRouter });

    await abrirBeneficios(user);
    expect(navigateMock).not.toHaveBeenCalled();

    await user.type(await screen.findByPlaceholderText("+244 9XX XXX XXX"), "+244900000000");
    await user.type(screen.getByPlaceholderText("Porque queres ser um Kamba?"), "Quero ajudar.");
    await user.click(screen.getByRole("button", { name: /Inscrever-me como Kamba/i }));

    await waitFor(() => expect(candidatar).toHaveBeenCalledWith("Quero ajudar.", "+244900000000"));
    expect(screen.queryByPlaceholderText("O teu nome")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Inscrição submetida com sucesso!" }),
      ),
    );
  });

  it("uma falha da API (ex.: já tem candidatura pendente) nunca mostra sucesso", async () => {
    candidatar.mockRejectedValue(
      Object.assign(new Error("já tem uma candidatura pendente ou aprovada"), { status: 409 }),
    );
    const user = userEvent.setup();
    render(<ContactSection />, { wrapper: MemoryRouter });

    await abrirBeneficios(user);
    await user.type(await screen.findByPlaceholderText("Porque queres ser um Kamba?"), "Quero ajudar.");
    await user.click(screen.getByRole("button", { name: /Inscrever-me como Kamba/i }));

    await waitFor(() => expect(candidatar).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Erro ao submeter",
        description: "já tem uma candidatura pendente ou aprovada",
        variant: "destructive",
      }),
    );
    expect(toast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/sucesso/i) }),
    );
  });
});
