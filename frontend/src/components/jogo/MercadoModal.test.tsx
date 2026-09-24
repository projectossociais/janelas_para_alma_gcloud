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
  { id: "estudante-medicina", custo_diamantes: 5, precisao: 0.5, disponivel_em: null },
  { id: "enfermeira-oftalmica", custo_diamantes: 12, precisao: 0.7, disponivel_em: null },
  { id: "optometrista", custo_diamantes: 25, precisao: 0.85, disponivel_em: null },
  { id: "oftalmologista", custo_diamantes: 45, precisao: 0.9, disponivel_em: null },
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

    const helena = await screen.findByTestId("vendedor-oftalmologista");
    expect(within(helena).getByText("Dra. Helena")).toBeInTheDocument();
    expect(within(helena).getByText("45")).toBeInTheDocument();
    expect(within(helena).getByText(/Muito alta · 90%/)).toBeInTheDocument();
    expect(within(screen.getByTestId("vendedor-estudante-medicina")).getByText(/Baixa · 50%/)).toBeInTheDocument();
  });

  it("Consultório: nome, profissão e frase de cada profissional de saúde ocular", async () => {
    abrir();

    expect(await screen.findByRole("heading", { name: "Consultório" })).toBeInTheDocument();
    const estudante = screen.getByTestId("vendedor-estudante-medicina");
    expect(within(estudante).getByText("Estudante João")).toBeInTheDocument();
    expect(within(estudante).getByText("Estudante de Medicina")).toBeInTheDocument();
    expect(within(estudante).getByText(/Ainda estou a aprender, mas lembro-me de ler sobre isso\./)).toBeInTheDocument();
    const marta = screen.getByTestId("vendedor-enfermeira-oftalmica");
    expect(within(marta).getByText("Enfermeira Marta")).toBeInTheDocument();
    expect(within(marta).getByText("Enfermeira Oftálmica")).toBeInTheDocument();
    expect(within(marta).getByText(/No consultório vemos muitos casos práticos assim\./)).toBeInTheDocument();
    const paulo = screen.getByTestId("vendedor-optometrista");
    expect(within(paulo).getByText("Dr. Paulo")).toBeInTheDocument();
    expect(within(paulo).getByText("Optometrista")).toBeInTheDocument();
    expect(within(paulo).getByText(/Deixe-me analisar a sua acuidade visual\./)).toBeInTheDocument();
    const helena = screen.getByTestId("vendedor-oftalmologista");
    expect(within(helena).getByText("Dra. Helena")).toBeInTheDocument();
    expect(within(helena).getByText("Oftalmologista Especialista")).toBeInTheDocument();
    expect(
      within(helena).getByText(/Com os meus anos de experiência clínica, o diagnóstico é claro\./)
    ).toBeInTheDocument();
  });

  it("mostra a certeza que a API calculou para esta pergunta, tal como vem (sem arredondar à base)", async () => {
    obterMercado.mockResolvedValue({
      agora: AGORA_SERVIDOR,
      categoria: "doencas_estrabismo",
      vendedores: [
        { id: "estudante-medicina", custo_diamantes: 5, precisao: 0.3, disponivel_em: null },
        { id: "enfermeira-oftalmica", custo_diamantes: 12, precisao: 0.57, disponivel_em: null },
        { id: "optometrista", custo_diamantes: 25, precisao: 0.87, disponivel_em: null },
        { id: "oftalmologista", custo_diamantes: 45, precisao: 0.97, disponivel_em: null },
      ],
    });
    abrir();

    expect(await screen.findByText("Tema desta pergunta: Doenças e Estrabismo")).toBeInTheDocument();
    expect(within(screen.getByTestId("vendedor-estudante-medicina")).getByText(/Baixa · 30%/)).toBeInTheDocument();
    expect(within(screen.getByTestId("vendedor-enfermeira-oftalmica")).getByText(/Baixa · 57%/)).toBeInTheDocument();
    expect(within(screen.getByTestId("vendedor-optometrista")).getByText(/Alta · 87%/)).toBeInTheDocument();
    expect(within(screen.getByTestId("vendedor-oftalmologista")).getByText(/Muito alta · 97%/)).toBeInTheDocument();
  });

  it("não explica a mecânica: sem 'Porquê', sem selo de especialidade, sem variação face à base", async () => {
    obterMercado.mockResolvedValue({
      agora: AGORA_SERVIDOR,
      categoria: "doencas_estrabismo",
      // Mesmo que uma API antiga ainda envie os campos antigos, não se mostram.
      vendedores: VENDEDORES.map((v) => ({ ...v, precisao_base: 0.5, afinidade: "especialista" })),
    });
    abrir();

    const helena = await screen.findByTestId("vendedor-oftalmologista");
    // Só nome, profissão, frase, custo, certeza e o botão.
    expect(within(helena).getByText("Dra. Helena")).toBeInTheDocument();
    expect(within(helena).getByText("Oftalmologista Especialista")).toBeInTheDocument();
    expect(within(helena).getByText(/o diagnóstico é claro/)).toBeInTheDocument();
    expect(within(helena).getByText(/Muito alta · 90%/)).toBeInTheDocument();
    for (const cartao of screen.getAllByRole("listitem")) {
      expect(cartao).not.toHaveTextContent(/Porquê|Especialista em|Fora da especialidade|certeza base|\([+-]\d+\)/);
    }
    expect(screen.queryByTestId(/^motivo-/)).not.toBeInTheDocument();
  });

  it("vendedor mais caro do que o saldo fica com o botão desactivado", async () => {
    abrir();
    await waitFor(() => expect(screen.getByTestId("saldo")).toHaveTextContent("30"));

    const helena = screen.getByTestId("vendedor-oftalmologista");
    expect(within(helena).getByRole("button")).toBeDisabled();
    expect(within(helena).getByRole("button")).toHaveTextContent("Diamantes insuficientes");
    expect(within(screen.getByTestId("vendedor-estudante-medicina")).getByRole("button")).toBeEnabled();
  });

  it("vendedor bloqueado mostra o cronómetro, medido pelo relógio do servidor, e conta para baixo", async () => {
    // O dispositivo está 1h atrasado em relação ao servidor -- o cronómetro
    // tem de mostrar as 3h30 que o servidor diz faltar, não 4h30.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-24T11:00:00Z"));
    obterMercado.mockResolvedValue({
      agora: AGORA_SERVIDOR,
      vendedores: VENDEDORES.map((v) =>
        v.id === "optometrista" ? { ...v, disponivel_em: "2026-09-24T15:30:00Z" } : v
      ),
    });
    abrir();

    const paulo = await screen.findByTestId("vendedor-optometrista");
    expect(within(paulo).getByRole("timer")).toHaveTextContent("03:30:00");
    expect(within(paulo).queryByRole("button")).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(within(paulo).getByRole("timer")).toHaveTextContent("03:29:58");
  });

  it("comprar: envia só vendedor, pergunta e opções escondidas; mostra a fala e actualiza o saldo", async () => {
    comprarAjudaMercado.mockResolvedValue({
      vendedor_id: "enfermeira-oftalmica",
      resposta_sugerida: "C",
      disponivel_em: "2026-09-24T16:00:00Z",
      perfil: { ...PERFIL, diamantes: 18 },
    });
    const { onAjudaComprada } = abrir();

    await userEvent.click(await screen.findByRole("button", { name: /Pedir a opinião de Enfermeira Marta por 12/ }));

    await waitFor(() => expect(comprarAjudaMercado).toHaveBeenCalledWith("enfermeira-oftalmica", "pergunta-1", ["A", "D"]));
    expect(await screen.findByText(/Pela minha experiência no consultório, é a C\./)).toBeInTheDocument();
    expect(onAjudaComprada).toHaveBeenCalledWith(expect.objectContaining({ resposta_sugerida: "C" }));
    expect(screen.getByTestId("saldo")).toHaveTextContent("18");
  });

  it("sem diamantes (402): mostra erro e nunca uma sugestão", async () => {
    comprarAjudaMercado.mockRejectedValue(Object.assign(new Error("diamantes insuficientes"), { status: 402 }));
    const { onAjudaComprada } = abrir();

    await userEvent.click(await screen.findByRole("button", { name: /Estudante João/ }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Não tem diamantes suficientes para esta consulta."));
    expect(onAjudaComprada).not.toHaveBeenCalled();
    expect(screen.queryByText(/acho que é a/)).not.toBeInTheDocument();
  });

  it("vendedor bloqueado noutro separador (409): avisa e recarrega o Mercado", async () => {
    comprarAjudaMercado.mockRejectedValue(Object.assign(new Error("bloqueado"), { status: 409 }));
    abrir();

    await userEvent.click(await screen.findByRole("button", { name: /Estudante João/ }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Este profissional está ocupado com outro paciente. Tente outro."));
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
    expect(await screen.findByTestId("vendedor-estudante-medicina")).toBeInTheDocument();
  });
});
