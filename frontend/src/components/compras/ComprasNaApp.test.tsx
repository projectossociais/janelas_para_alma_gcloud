import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

// Dentro da app nativa: compras pela loja, nunca por transferência, e nada
// aparece como comprado antes de a API o confirmar (CLAUDE.md §6).

const obterPerfil = vi.fn();
const obterLojaDiamantes = vi.fn();
const listarMeusPedidosLoja = vi.fn();
const acesso = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  jogoApi: {
    obterPerfil: (...a: unknown[]) => obterPerfil(...a),
    obterLojaDiamantes: (...a: unknown[]) => obterLojaDiamantes(...a),
    listarMeusPedidosLoja: (...a: unknown[]) => listarMeusPedidosLoja(...a),
  },
  exerciciosApi: { acesso: (...a: unknown[]) => acesso(...a) },
  mensagemDeErroApi: (_err: unknown, fallback: string) => fallback,
}));

const comprarNaLoja = vi.fn();
const precoNaLoja = vi.fn();
const restaurarCompras = vi.fn();
vi.mock("@/lib/comprasLoja", async () => {
  const real = await vi.importActual<typeof import("@/lib/comprasLoja")>("@/lib/comprasLoja");
  return {
    ...real,
    comprasPelaLoja: () => true,
    comprasConfiguradas: () => true,
    precoNaLoja: (...a: unknown[]) => precoNaLoja(...a),
    comprarNaLoja: (...a: unknown[]) => comprarNaLoja(...a),
    restaurarCompras: (...a: unknown[]) => restaurarCompras(...a),
    esperarPelaApi: <T,>(ler: () => Promise<T>, pronto: (v: T) => boolean) =>
      real.esperarPelaApi(ler, pronto, { tentativas: 3, intervaloMs: 0 }),
  };
});

vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/BackButton", () => ({ default: () => null }));

const PERFIL_UTILIZADOR = { id: "u1", nome_completo: "Ana", email: "ana@example.com", avatar_url: null };
vi.mock("@/contexts/ProfileContext", () => ({ useProfile: () => ({ profile: PERFIL_UTILIZADOR }) }));

let estadoAcesso = "trial_terminado";
const refetch = vi.fn();
vi.mock("@/contexts/AcessoExerciciosContext", () => ({
  useAcessoExercicios: () => ({ acesso: { estado: estadoAcesso }, refetch: () => refetch() }),
}));

const toastSonner = { error: vi.fn(), success: vi.fn(), info: vi.fn() };
vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => toastSonner.error(...a),
    success: (...a: unknown[]) => toastSonner.success(...a),
    info: (...a: unknown[]) => toastSonner.info(...a),
  },
}));
const toastUi = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ toast: (...a: unknown[]) => toastUi(...a) }));

import LojaDiamantes from "@/pages/jogo/LojaDiamantes";
import PremiumNaApp from "./PremiumNaApp";
import { CarteiraJogoProvider } from "@/contexts/CarteiraJogoContext";

const Envoltorio = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>
    <CarteiraJogoProvider>{children}</CarteiraJogoProvider>
  </MemoryRouter>
);

const PACOTES = [
  { id: "pequeno", diamantes: 50, bonus: 0, total_diamantes: 50, preco_kz: 500, preco_moedas: 2000 },
];
const PERFIL = { moedas: 100, diamantes: 10, partidas_jogadas: 2, patamar_maximo_alcancado: 3 };

beforeEach(() => {
  for (const f of [obterPerfil, obterLojaDiamantes, listarMeusPedidosLoja, acesso, comprarNaLoja, precoNaLoja,
    restaurarCompras, refetch, toastUi, toastSonner.error, toastSonner.success, toastSonner.info]) {
    f.mockReset();
  }
  estadoAcesso = "trial_terminado";
  obterLojaDiamantes.mockResolvedValue({ pacotes: PACOTES, pagamento_simulado: false });
  listarMeusPedidosLoja.mockResolvedValue([]);
  precoNaLoja.mockResolvedValue("US$0,99");
});

describe("Loja de Diamantes na app", () => {
  it("vende pela loja, sem Kwanzas nem transferência", async () => {
    obterPerfil.mockResolvedValue(PERFIL);
    render(<LojaDiamantes />, { wrapper: Envoltorio });

    const pacote = await screen.findByTestId("pacote-pequeno");
    expect(await within(pacote).findByRole("button", { name: /US\$0,99/ })).toBeInTheDocument();
    expect(within(pacote).queryByText(/Kz/)).not.toBeInTheDocument();
    expect(screen.getByText(/App Store ou Google Play/)).toBeInTheDocument();
  });

  it("só celebra quando a API já tem os diamantes", async () => {
    obterPerfil
      .mockResolvedValueOnce(PERFIL) // carteira ao abrir
      .mockResolvedValueOnce(PERFIL) // webhook ainda não chegou
      .mockResolvedValue({ ...PERFIL, diamantes: 60 });
    comprarNaLoja.mockResolvedValue("comprado");
    render(<LojaDiamantes />, { wrapper: Envoltorio });

    await userEvent.click(await screen.findByRole("button", { name: /US\$0,99/ }));

    await waitFor(() => expect(toastSonner.success).toHaveBeenCalledTimes(1));
    expect(comprarNaLoja).toHaveBeenCalledWith("u1", "jpa_diamantes_pequeno");
    expect(toastSonner.info).not.toHaveBeenCalled();
  });

  it("se a API não confirmar a tempo, avisa que está a confirmar -- nunca sucesso", async () => {
    obterPerfil.mockResolvedValue(PERFIL);
    comprarNaLoja.mockResolvedValue("comprado");
    render(<LojaDiamantes />, { wrapper: Envoltorio });

    await userEvent.click(await screen.findByRole("button", { name: /US\$0,99/ }));

    await waitFor(() => expect(toastSonner.info).toHaveBeenCalledTimes(1));
    expect(toastSonner.success).not.toHaveBeenCalled();
  });

  it("desistir na folha da loja não mostra nada", async () => {
    obterPerfil.mockResolvedValue(PERFIL);
    comprarNaLoja.mockResolvedValue("cancelado");
    render(<LojaDiamantes />, { wrapper: Envoltorio });

    await userEvent.click(await screen.findByRole("button", { name: /US\$0,99/ }));

    await waitFor(() => expect(comprarNaLoja).toHaveBeenCalled());
    expect(toastSonner.success).not.toHaveBeenCalled();
    expect(toastSonner.info).not.toHaveBeenCalled();
    expect(toastSonner.error).not.toHaveBeenCalled();
  });
});

describe("Premium na app", () => {
  const renderPremium = () =>
    render(
      <MemoryRouter>
        <PremiumNaApp onVoltar={() => undefined} />
      </MemoryRouter>
    );

  it("mostra o preço da loja, os termos da subscrição e o restaurar compras", async () => {
    renderPremium();
    expect(await screen.findByText(/US\$0,99/)).toBeInTheDocument();
    expect(precoNaLoja).toHaveBeenCalledWith("u1", "jpa_premium_mensal", true);
    expect(screen.getByText(/renovação automática/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Restaurar compras/ })).toBeInTheDocument();
  });

  it("só diz que o Premium está activo depois de a API o confirmar", async () => {
    comprarNaLoja.mockResolvedValue("comprado");
    acesso.mockResolvedValueOnce({ estado: "trial_terminado" }).mockResolvedValue({ estado: "premium" });
    renderPremium();

    await userEvent.click(await screen.findByRole("button", { name: /Subscrever/ }));

    await waitFor(() => expect(toastUi).toHaveBeenCalledWith({ title: "Premium activado. Bom treino!" }));
    expect(acesso).toHaveBeenCalledTimes(2);
    expect(refetch).toHaveBeenCalled();
  });

  it("sem confirmação da API, não diz que activou", async () => {
    comprarNaLoja.mockResolvedValue("comprado");
    acesso.mockResolvedValue({ estado: "trial_terminado" });
    renderPremium();

    await userEvent.click(await screen.findByRole("button", { name: /Subscrever/ }));

    await waitFor(() => expect(toastUi).toHaveBeenCalledTimes(1));
    expect(toastUi.mock.calls[0][0].title).toMatch(/ainda não chegou/);
  });

  it("com o Premium já activo, não oferece nova subscrição", () => {
    estadoAcesso = "premium";
    renderPremium();
    expect(screen.getByText(/O Premium está activo/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Subscrever/ })).not.toBeInTheDocument();
  });
});
