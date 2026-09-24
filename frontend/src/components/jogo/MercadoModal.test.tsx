import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const obterPerfil = vi.fn();
const obterMercado = vi.fn();
const comprarAjudaMercado = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  jogoApi: {
    obterPerfil: (...a: unknown[]) => obterPerfil(...a),
    obterMercado: (...a: unknown[]) => obterMercado(...a),
    comprarAjudaMercado: (...a: unknown[]) => comprarAjudaMercado(...a),
  },
  mensagemDeErroApi: (_err: unknown, fallback: string) => fallback,
}));

let mockProfile: { id: string } | null = { id: "u1" };
vi.mock("@/contexts/ProfileContext", () => ({ useProfile: () => ({ profile: mockProfile }) }));

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }));

import MercadoModal from "./MercadoModal";
import { CarteiraJogoProvider, useCarteiraJogo } from "@/contexts/CarteiraJogoContext";

const Saldo = () => {
  const { perfil } = useCarteiraJogo();
  return <span data-testid="saldo">{perfil?.diamantes ?? "-"}</span>;
};

const Envoltorio = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>
    <CarteiraJogoProvider>
      <Saldo />
      {children}
    </CarteiraJogoProvider>
  </MemoryRouter>
);

const AGORA_SERVIDOR = "2026-09-24T12:00:00Z";
const VENDEDORES = [
  { id: "tio-ze", custo_diamantes: 5, precisao: 0.5, disponivel_em: null },
  { id: "mana-fefa", custo_diamantes: 12, precisao: 0.7, disponivel_em: null },
  { id: "dona-maria", custo_diamantes: 25, precisao: 0.85, disponivel_em: null },
  { id: "kota-beto", custo_diamantes: 45, precisao: 0.95, disponivel_em: null },
];
const PERFIL = { moedas: 0, diamantes: 30, partidas_jogadas: 0, patamar_maximo_alcancado: 0 };

const abrir = (props: Partial<Parameters<typeof MercadoModal>[0]> = {}) => {
  const onAjudaComprada = vi.fn();
  render(
    <MercadoModal
      open
      onOpenChange={() => {}}
      perguntaId="pergunta-1"
      opcoesExcluidas={["A", "D"]}
      onAjudaComprada={onAjudaComprada}
      {...props}
    />,
    { wrapper: Envoltorio }
  );
  return { onAjudaComprada };
};

describe("MercadoModal", () => {
  beforeEach(() => {
    mockProfile = { id: "u1" };
    obterPerfil.mockReset().mockResolvedValue(PERFIL);
    obterMercado.mockReset().mockResolvedValue({ agora: AGORA_SERVIDOR, vendedores: VENDEDORES });
    comprarAjudaMercado.mockReset();
    toastError.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lista os vendedores com nome, custo e nível de certeza vindos da API", async () => {
    abrir();

    const kota = await screen.findByTestId("vendedor-kota-beto");
    expect(within(kota).getByText("Kota Beto")).toBeInTheDocument();
    expect(within(kota).getByText("45")).toBeInTheDocument();
    expect(within(kota).getByText(/Muito alta · 95%/)).toBeInTheDocument();
    expect(within(screen.getByTestId("vendedor-tio-ze")).getByText(/Baixa · 50%/)).toBeInTheDocument();
  });

  it("vendedor mais caro do que o saldo fica com o botão desactivado", async () => {
    abrir();
    await waitFor(() => expect(screen.getByTestId("saldo")).toHaveTextContent("30"));

    const kota = screen.getByTestId("vendedor-kota-beto");
    expect(within(kota).getByRole("button")).toBeDisabled();
    expect(within(kota).getByRole("button")).toHaveTextContent("Diamantes insuficientes");
    expect(within(screen.getByTestId("vendedor-tio-ze")).getByRole("button")).toBeEnabled();
  });

  it("vendedor bloqueado mostra o cronómetro, medido pelo relógio do servidor, e conta para baixo", async () => {
    // O dispositivo está 1h atrasado em relação ao servidor -- o cronómetro
    // tem de mostrar as 3h30 que o servidor diz faltar, não 4h30.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-24T11:00:00Z"));
    obterMercado.mockResolvedValue({
      agora: AGORA_SERVIDOR,
      vendedores: VENDEDORES.map((v) =>
        v.id === "dona-maria" ? { ...v, disponivel_em: "2026-09-24T15:30:00Z" } : v
      ),
    });
    abrir();

    const dona = await screen.findByTestId("vendedor-dona-maria");
    expect(within(dona).getByRole("timer")).toHaveTextContent("03:30:00");
    expect(within(dona).queryByRole("button")).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(within(dona).getByRole("timer")).toHaveTextContent("03:29:58");
  });

  it("comprar: envia só vendedor, pergunta e opções escondidas; mostra a fala e actualiza o saldo", async () => {
    comprarAjudaMercado.mockResolvedValue({
      vendedor_id: "mana-fefa",
      resposta_sugerida: "C",
      disponivel_em: "2026-09-24T16:00:00Z",
      perfil: { ...PERFIL, diamantes: 18 },
    });
    const { onAjudaComprada } = abrir();

    await userEvent.click(await screen.findByRole("button", { name: /Comprar resposta a Mana Fefa por 12/ }));

    await waitFor(() => expect(comprarAjudaMercado).toHaveBeenCalledWith("mana-fefa", "pergunta-1", ["A", "D"]));
    expect(await screen.findByText(/eu ia na C/)).toBeInTheDocument();
    expect(onAjudaComprada).toHaveBeenCalledWith(expect.objectContaining({ resposta_sugerida: "C" }));
    expect(screen.getByTestId("saldo")).toHaveTextContent("18");
  });

  it("sem diamantes (402): mostra erro e nunca uma sugestão", async () => {
    comprarAjudaMercado.mockRejectedValue(Object.assign(new Error("diamantes insuficientes"), { status: 402 }));
    const { onAjudaComprada } = abrir();

    await userEvent.click(await screen.findByRole("button", { name: /Tio Zé/ }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Não tem diamantes suficientes para este vendedor."));
    expect(onAjudaComprada).not.toHaveBeenCalled();
    expect(screen.queryByText(/acho que é a/)).not.toBeInTheDocument();
  });

  it("vendedor bloqueado noutro separador (409): avisa e recarrega o Mercado", async () => {
    comprarAjudaMercado.mockRejectedValue(Object.assign(new Error("bloqueado"), { status: 409 }));
    abrir();

    await userEvent.click(await screen.findByRole("button", { name: /Tio Zé/ }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Este vendedor ainda está a descansar. Tente outro."));
    await waitFor(() => expect(obterMercado).toHaveBeenCalledTimes(2));
  });

  it("sem sessão pede para entrar e não chama a API do Mercado", async () => {
    mockProfile = null;
    abrir();

    expect(await screen.findByRole("link", { name: "Entrar" })).toBeInTheDocument();
    expect(obterMercado).not.toHaveBeenCalled();
  });

  it("se o Mercado não carregar, oferece tentar outra vez", async () => {
    obterMercado.mockReset().mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({
      agora: AGORA_SERVIDOR,
      vendedores: VENDEDORES,
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    abrir();

    await userEvent.click(await screen.findByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByTestId("vendedor-tio-ze")).toBeInTheDocument();
  });
});
