import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// Mesma correcção do W-16 (docs/BACKLOG.md) que ContactSection.test.tsx --
// este formulário (página /kamba) tinha o mesmo bug: candidatava-se via uma
// Edge Function do Supabase que nunca gravava nada. Corrigido para chamar
// voluntariadoApi.candidatar, atrás de uma exigência de sessão.

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("react-router-dom")>();
  return { ...original, useNavigate: () => navigateMock };
});

const candidatar = vi.fn();
vi.mock("@/lib/apiClient", () => ({
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

vi.mock("@/components/kamba/KambaHeroCarousel", () => ({
  default: ({ onOpenForm }: { onOpenForm: () => void }) => (
    <button onClick={onOpenForm}>Quero ser um Kamba</button>
  ),
}));

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

import VolunteerSection from "./VolunteerSection";

describe("VolunteerSection — candidatura a voluntário", () => {
  beforeEach(() => {
    candidatar.mockReset();
    navigateMock.mockReset();
    toast.mockReset();
    mockIsLoggedIn = true;
  });

  it("sem sessão, nunca abre o formulário — só redirecciona para o login", async () => {
    mockIsLoggedIn = false;
    const user = userEvent.setup();
    render(<VolunteerSection />, { wrapper: MemoryRouter });

    await user.click(screen.getByRole("button", { name: /Quero ser um Kamba/i }));

    expect(navigateMock).toHaveBeenCalledWith("/auth?next=/kamba");
    expect(screen.queryByText("Formulário de Inscrição")).not.toBeInTheDocument();
    expect(candidatar).not.toHaveBeenCalled();
  });

  it("com sessão, candidata-se com motivação e telefone, nunca nome ou email", async () => {
    candidatar.mockResolvedValue({ id: "cand-1", status: "pendente" });
    const user = userEvent.setup();
    render(<VolunteerSection />, { wrapper: MemoryRouter });

    await user.click(screen.getByRole("button", { name: /Quero ser um Kamba/i }));
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

  it("uma falha da API nunca mostra sucesso", async () => {
    candidatar.mockRejectedValue(
      Object.assign(new Error("já tem uma candidatura pendente ou aprovada"), { status: 409 }),
    );
    const user = userEvent.setup();
    render(<VolunteerSection />, { wrapper: MemoryRouter });

    await user.click(screen.getByRole("button", { name: /Quero ser um Kamba/i }));
    await user.type(
      await screen.findByPlaceholderText("Porque queres ser um Kamba?"),
      "Quero ajudar.",
    );
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

  it("candidata-se sem telefone (opcional)", async () => {
    candidatar.mockResolvedValue({ id: "cand-1", status: "pendente" });
    const user = userEvent.setup();
    render(<VolunteerSection />, { wrapper: MemoryRouter });

    await user.click(screen.getByRole("button", { name: /Quero ser um Kamba/i }));
    await user.type(
      await screen.findByPlaceholderText("Porque queres ser um Kamba?"),
      "Quero ajudar.",
    );
    await user.click(screen.getByRole("button", { name: /Inscrever-me como Kamba/i }));

    await waitFor(() => expect(candidatar).toHaveBeenCalledWith("Quero ajudar.", undefined));
  });
});
