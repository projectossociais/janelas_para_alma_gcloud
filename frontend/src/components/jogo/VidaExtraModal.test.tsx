import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

const obterPerfil = vi.fn();
const usarVidaExtra = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  jogoApi: {
    obterPerfil: (...a: unknown[]) => obterPerfil(...a),
    usarVidaExtra: (...a: unknown[]) => usarVidaExtra(...a),
  },
  mensagemDeErroApi: (_err: unknown, fallback: string) => fallback,
}));

vi.mock("@/contexts/ProfileContext", () => ({ useProfile: () => ({ profile: { id: "u1" } }) }));

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }));

import VidaExtraModal from "./VidaExtraModal";
import { CarteiraJogoProvider, useCarteiraJogo } from "@/contexts/CarteiraJogoContext";

const Saldo = () => {
  const { perfil } = useCarteiraJogo();
  return <span data-testid="saldo-barra">{perfil?.diamantes ?? "-"}</span>;
};

const Envoltorio = ({ children }: { children: ReactNode }) => (
  <CarteiraJogoProvider>
    <Saldo />
    {children}
  </CarteiraJogoProvider>
);

const PERFIL = { moedas: 0, diamantes: 50, partidas_jogadas: 0, patamar_maximo_alcancado: 0 };

const abrir = (oferta = { custo: 20, restantes: 2 }, tempoEsgotado = false) => {
  const onVidaUsada = vi.fn();
  const onEncerrar = vi.fn();
  render(
    <VidaExtraModal oferta={oferta} tempoEsgotado={tempoEsgotado} onVidaUsada={onVidaUsada} onEncerrar={onEncerrar} />,
    { wrapper: Envoltorio }
  );
  return { onVidaUsada, onEncerrar };
};

describe("VidaExtraModal", () => {
  beforeEach(() => {
    obterPerfil.mockReset().mockResolvedValue(PERFIL);
    usarVidaExtra.mockReset();
    toastError.mockReset();
  });

  it("mostra o custo, o saldo e as vidas restantes", async () => {
    abrir();
    expect(await screen.findByRole("heading", { name: "Vida Extra" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("saldo-vida-extra")).toHaveTextContent("50"));
    expect(screen.getByLabelText("Vidas extra restantes nesta partida: 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Usar Vida Extra \(20 diamantes\)/ })).toBeEnabled();
  });

  it("diz se foi o tempo que esgotou", async () => {
    abrir(undefined, true);
    expect(await screen.findByText("Oh não! O tempo esgotou.")).toBeInTheDocument();
  });

  it("usar: paga pela API, actualiza o saldo e devolve a vida ao jogo", async () => {
    const vida = {
      perfil: { ...PERFIL, diamantes: 30 },
      pergunta_id: "p1",
      opcao_falhada: "A",
      vidas_restantes: 1,
    };
    usarVidaExtra.mockResolvedValue(vida);
    const { onVidaUsada, onEncerrar } = abrir();
    await waitFor(() => expect(screen.getByTestId("saldo-vida-extra")).toHaveTextContent("50"));

    await userEvent.click(screen.getByRole("button", { name: /Usar Vida Extra/ }));

    await waitFor(() => expect(onVidaUsada).toHaveBeenCalledWith(vida));
    expect(screen.getByTestId("saldo-barra")).toHaveTextContent("30");
    expect(onEncerrar).not.toHaveBeenCalled();
  });

  it("sem diamantes na API (402): avisa, recarrega o saldo e não continua a partida", async () => {
    usarVidaExtra.mockRejectedValue(Object.assign(new Error("diamantes insuficientes"), { status: 402 }));
    const { onVidaUsada } = abrir();
    await waitFor(() => expect(screen.getByTestId("saldo-vida-extra")).toHaveTextContent("50"));

    await userEvent.click(screen.getByRole("button", { name: /Usar Vida Extra/ }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Não tem diamantes suficientes para a Vida Extra."));
    expect(onVidaUsada).not.toHaveBeenCalled();
    await waitFor(() => expect(obterPerfil).toHaveBeenCalledTimes(2));
  });

  it("outro erro da API: mensagem de erro, nunca continua", async () => {
    usarVidaExtra.mockRejectedValue(new Error("rede"));
    const { onVidaUsada } = abrir();
    await waitFor(() => expect(screen.getByTestId("saldo-vida-extra")).toHaveTextContent("50"));

    await userEvent.click(screen.getByRole("button", { name: /Usar Vida Extra/ }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Não foi possível usar a Vida Extra. Nenhum diamante foi gasto.")
    );
    expect(onVidaUsada).not.toHaveBeenCalled();
  });

  it("saldo abaixo do custo: botão desactivado com aviso, só resta encerrar", async () => {
    obterPerfil.mockResolvedValue({ ...PERFIL, diamantes: 19 });
    const { onEncerrar } = abrir();

    await waitFor(() => expect(screen.getByRole("button", { name: "Diamantes insuficientes" })).toBeDisabled());
    await userEvent.click(screen.getByRole("button", { name: "Encerrar partida" }));
    expect(onEncerrar).toHaveBeenCalled();
    expect(usarVidaExtra).not.toHaveBeenCalled();
  });

  it("sem onSair, fechar o modal conta como encerrar", async () => {
    const { onEncerrar } = abrir();
    await userEvent.keyboard("{Escape}");
    expect(onEncerrar).toHaveBeenCalled();
  });

  describe("com onSair (o jogo)", () => {
    const abrirComSaida = () => {
      const onEncerrar = vi.fn();
      const onSair = vi.fn();
      render(
        <VidaExtraModal
          oferta={{ custo: 20, restantes: 2 }}
          tempoEsgotado={false}
          onVidaUsada={vi.fn()}
          onEncerrar={onEncerrar}
          onSair={onSair}
        />,
        { wrapper: Envoltorio }
      );
      return { onEncerrar, onSair };
    };

    it("o × sai do jogo (onSair), não mostra o resultado (onEncerrar)", async () => {
      const { onEncerrar, onSair } = abrirComSaida();
      await userEvent.click(await screen.findByRole("button", { name: "Close" }));
      expect(onSair).toHaveBeenCalledTimes(1);
      expect(onEncerrar).not.toHaveBeenCalled();
    });

    it("Esc também sai do jogo", async () => {
      const { onEncerrar, onSair } = abrirComSaida();
      await screen.findByRole("heading", { name: "Vida Extra" });
      await userEvent.keyboard("{Escape}");
      expect(onSair).toHaveBeenCalledTimes(1);
      expect(onEncerrar).not.toHaveBeenCalled();
    });

    it("o botão 'Encerrar partida' continua a mostrar o resultado, não sai", async () => {
      const { onEncerrar, onSair } = abrirComSaida();
      await userEvent.click(await screen.findByRole("button", { name: "Encerrar partida" }));
      expect(onEncerrar).toHaveBeenCalledTimes(1);
      expect(onSair).not.toHaveBeenCalled();
    });
  });
});
