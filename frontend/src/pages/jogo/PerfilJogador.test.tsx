import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("react-router-dom")>();
  return { ...original, useNavigate: () => navigateMock };
});

const obterPerfil = vi.fn();
const obterEstatisticas = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  jogoApi: {
    obterPerfil: (...a: unknown[]) => obterPerfil(...a),
    obterEstatisticas: (...a: unknown[]) => obterEstatisticas(...a),
  },
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/BackButton", () => ({ default: () => null }));

const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockUseAuth() }));

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: { id: "u1", nome_completo: "Ana Jogadora", email: "ana@example.com", avatar_url: null } }),
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }));

import PerfilJogador from "./PerfilJogador";
import { CarteiraJogoProvider } from "@/contexts/CarteiraJogoContext";

const Envoltorio = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>
    <CarteiraJogoProvider>{children}</CarteiraJogoProvider>
  </MemoryRouter>
);

const PERFIL = {
  moedas: 1200,
  diamantes: 7,
  partidas_jogadas: 12,
  patamar_maximo_alcancado: 10,
  melhor_sequencia: 8,
  patamares_superados_total: 31,
  moedas_ganhas_total: 1550,
};

const CATEGORIAS = [
  { categoria: "anatomia_ocular", respostas: 10, acertos: 8, taxa_acerto: 0.8 },
  { categoria: "doencas_estrabismo", respostas: 4, acertos: 1, taxa_acerto: 0.25 },
  { categoria: "prevencao_cuidados", respostas: 0, acertos: 0, taxa_acerto: 0 },
  { categoria: "estilo_vida_visao", respostas: 3, acertos: 3, taxa_acerto: 1 },
  { categoria: "ciencia_ocular", respostas: 0, acertos: 0, taxa_acerto: 0 },
  { categoria: "curiosidades_visuais", respostas: 2, acertos: 1, taxa_acerto: 0.5 },
];

const ESTATISTICAS = {
  perfil: PERFIL,
  nivel: { numero: 2, id: "aprendiz", patamares_total: 31, minimo: 16, proximo_minimo: 46, progresso: 0.5 },
  categorias: CATEGORIAS,
};

describe("PerfilJogador", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    obterPerfil.mockReset().mockResolvedValue(PERFIL);
    obterEstatisticas.mockReset();
    toastError.mockReset();
  });

  it("redireciona para /auth quando não há sessão", async () => {
    mockUseAuth.mockReturnValue({ isLoggedIn: false, loading: false });
    render(<PerfilJogador />, { wrapper: Envoltorio });

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/auth"));
    expect(obterEstatisticas).not.toHaveBeenCalled();
  });

  it("não redireciona enquanto o AuthContext ainda está a carregar", async () => {
    mockUseAuth.mockReturnValue({ isLoggedIn: false, loading: true });
    render(<PerfilJogador />, { wrapper: Envoltorio });

    await new Promise((r) => setTimeout(r, 50));
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("mostra o nome, o crachá do nível e o progresso até ao seguinte", async () => {
    mockUseAuth.mockReturnValue({ isLoggedIn: true, loading: false });
    obterEstatisticas.mockResolvedValue(ESTATISTICAS);
    render(<PerfilJogador />, { wrapper: Envoltorio });

    const cracha = await screen.findByTestId("cracha-nivel");
    expect(screen.getByRole("heading", { name: "Ana Jogadora" })).toBeInTheDocument();
    expect(within(cracha).getByText("Nível 2")).toBeInTheDocument();
    expect(within(cracha).getByText("Aprendiz")).toBeInTheDocument();
    expect(within(cracha).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
    expect(within(cracha).getByText(/Faltam 15 patamares para o próximo nível \(31 superados\)/)).toBeInTheDocument();
  });

  it("no último nível, diz que é o nível máximo", async () => {
    mockUseAuth.mockReturnValue({ isLoggedIn: true, loading: false });
    obterEstatisticas.mockResolvedValue({
      ...ESTATISTICAS,
      nivel: { numero: 5, id: "mestre_visao", patamares_total: 200, minimo: 151, proximo_minimo: null, progresso: 1 },
    });
    render(<PerfilJogador />, { wrapper: Envoltorio });

    const cracha = await screen.findByTestId("cracha-nivel");
    expect(within(cracha).getByText("Mestre da Visão")).toBeInTheDocument();
    expect(within(cracha).getByText(/Nível máximo! 200 patamares superados/)).toBeInTheDocument();
  });

  it("mostra as estatísticas gerais: moedas ganhas, melhor sequência, partidas e melhor resultado", async () => {
    mockUseAuth.mockReturnValue({ isLoggedIn: true, loading: false });
    obterEstatisticas.mockResolvedValue(ESTATISTICAS);
    render(<PerfilJogador />, { wrapper: Envoltorio });

    expect(await screen.findByText("1.550")).toBeInTheDocument();
    expect(screen.getByText("Moedas ganhas")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("Melhor sequência")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Kz 50.000")).toBeInTheDocument(); // patamar 10
  });

  it("mostra as 6 categorias com acertos e taxa de sucesso", async () => {
    mockUseAuth.mockReturnValue({ isLoggedIn: true, loading: false });
    obterEstatisticas.mockResolvedValue(ESTATISTICAS);
    render(<PerfilJogador />, { wrapper: Envoltorio });

    expect(await screen.findByText("Estatísticas por categoria")).toBeInTheDocument();
    const cartoes = screen.getAllByTestId(/^categoria-/);
    expect(cartoes).toHaveLength(6);
    expect(within(screen.getByTestId("categoria-anatomia_ocular")).getByText("Anatomia Ocular")).toBeInTheDocument();
    expect(screen.getByLabelText("Anatomia Ocular: 8 certas em 10 (80%)")).toHaveTextContent("8/10 · 80%");
    expect(screen.getByLabelText("Estilo de Vida e Visão: 3 certas em 3 (100%)")).toBeInTheDocument();
    expect(within(screen.getByTestId("categoria-ciencia_ocular")).getByText("Sem respostas")).toBeInTheDocument();
  });

  it("um jogador sem respostas vê o convite para jogar", async () => {
    mockUseAuth.mockReturnValue({ isLoggedIn: true, loading: false });
    obterEstatisticas.mockResolvedValue({
      ...ESTATISTICAS,
      categorias: CATEGORIAS.map((c) => ({ ...c, respostas: 0, acertos: 0, taxa_acerto: 0 })),
    });
    render(<PerfilJogador />, { wrapper: Envoltorio });

    expect(await screen.findByText(/Jogue uma partida para ver os seus pontos fortes/)).toBeInTheDocument();
  });

  it("actualiza a barra da carteira com o saldo que veio com as estatísticas", async () => {
    mockUseAuth.mockReturnValue({ isLoggedIn: true, loading: false });
    obterEstatisticas.mockResolvedValue({ ...ESTATISTICAS, perfil: { ...PERFIL, diamantes: 99 } });
    render(<PerfilJogador />, { wrapper: Envoltorio });

    await waitFor(() => expect(screen.getByRole("link", { name: /^Diamantes/ })).toHaveTextContent("99"));
  });

  it("se a API falhar, mostra erro e deixa tentar outra vez", async () => {
    mockUseAuth.mockReturnValue({ isLoggedIn: true, loading: false });
    obterEstatisticas
      .mockRejectedValueOnce(Object.assign(new Error("falhou"), { status: 500 }))
      .mockResolvedValueOnce(ESTATISTICAS);
    render(<PerfilJogador />, { wrapper: Envoltorio });

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("falhou"));
    expect(screen.getByRole("link", { name: /Jogar agora/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByTestId("cracha-nivel")).toBeInTheDocument();
  });
});
