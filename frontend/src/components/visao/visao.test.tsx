import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useRegistoSessao } from "./hooks";
import TesteAcuidade from "@/pages/exercises/TesteAcuidade";
import { AcessoExerciciosProvider } from "@/contexts/AcessoExerciciosContext";

// O consentimento para dados de saúde tem testes próprios
// (ConsentimentoSaudeContext.test.tsx); aqui a conta já consentiu.
vi.mock("@/contexts/ConsentimentoSaudeContext", () => ({
  useConsentimentoSaude: () => ({
    consentido: true,
    carregando: false,
    garantir: () => Promise.resolve(true),
    retirar: () => Promise.resolve(),
  }),
}));


// Exercícios sem webcam (2026-09-28): gravar uma sessão nunca mostra
// sucesso antes da resposta da API (CLAUDE.md §6), e nenhum exercício pede
// a câmara.

vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoggedIn: true, loading: false }),
}));
vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: null, loading: false, setProfile: () => undefined }),
}));

const registar = vi.fn();
const acesso = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  sessoesExercicioApi: {
    registar: (...a: unknown[]) => registar(...a),
    minhas: () => Promise.resolve([]),
  },
  exerciciosApi: {
    acesso: (...a: unknown[]) => acesso(...a),
    iniciarTrial: () => Promise.resolve(),
  },
  perfilApi: { atualizar: () => Promise.resolve({}) },
  mensagemDeErroApi: (_e: unknown, fallback: string) => fallback,
}));

const sessao = { exercicio_id: "figure8", duracao_segundos: 30, olho: "direito" as const, limiar: 0.1 };

describe("useRegistoSessao", () => {
  beforeEach(() => registar.mockReset());

  it("grava sempre com versao 2 e só depois fica 'gravado'", async () => {
    let resolver: (v: unknown) => void = () => undefined;
    registar.mockReturnValue(new Promise((r) => (resolver = r)));
    const { result } = renderHook(() => useRegistoSessao());

    act(() => void result.current.gravar([sessao]));
    expect(result.current.estado).toBe("a_gravar");
    expect(registar).toHaveBeenCalledWith(expect.objectContaining({ versao: 2, exercicio_id: "figure8" }));

    await act(async () => resolver({}));
    expect(result.current.estado).toBe("gravado");
  });

  it("com erro da API fica em 'erro' (nunca 'gravado') e 'tentar de novo' reenvia o mesmo pedido", async () => {
    registar.mockRejectedValueOnce(new Error("500")).mockResolvedValueOnce({});
    const { result } = renderHook(() => useRegistoSessao());

    await act(async () => result.current.gravar([sessao]));
    expect(result.current.estado).toBe("erro");

    await act(async () => result.current.tentarDeNovo());
    expect(result.current.estado).toBe("gravado");
    expect(registar).toHaveBeenCalledTimes(2);
    expect(registar.mock.calls[1][0]).toEqual(registar.mock.calls[0][0]);
  });

  it("expõe o bónus do jogo que a API devolveu (Fase B) -- nunca um valor inventado", async () => {
    registar.mockResolvedValueOnce({ bonus: { moedas: 100, diamantes: 5, dias_seguidos: 7 } });
    const { result } = renderHook(() => useRegistoSessao());
    expect(result.current.bonus).toBeNull();

    await act(async () => result.current.gravar([sessao]));
    expect(result.current.estado).toBe("gravado");
    expect(result.current.bonus).toEqual({ moedas: 100, diamantes: 5, dias_seguidos: 7 });
  });

  it("sem bónus na resposta (já treinou hoje, ou teste de triagem), fica sem bónus", async () => {
    registar.mockResolvedValueOnce({ bonus: null });
    const { result } = renderHook(() => useRegistoSessao());
    await act(async () => result.current.gravar([sessao]));
    expect(result.current.bonus).toBeNull();
  });

  it("com erro da API, nunca há bónus", async () => {
    registar.mockRejectedValueOnce(new Error("500"));
    const { result } = renderHook(() => useRegistoSessao());
    await act(async () => result.current.gravar([sessao]));
    expect(result.current.estado).toBe("erro");
    expect(result.current.bonus).toBeNull();
  });

  it("dois olhos: se o segundo falha, só o segundo é reenviado", async () => {
    registar.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({});
    const { result } = renderHook(() => useRegistoSessao());

    await act(async () => result.current.gravar([sessao, { ...sessao, olho: "esquerdo" as const }]));
    expect(result.current.estado).toBe("erro");
    await act(async () => result.current.tentarDeNovo());

    expect(registar.mock.calls.map((c) => c[0].olho)).toEqual(["direito", "esquerdo", "esquerdo"]);
    expect(result.current.estado).toBe("gravado");
  });
});

describe("Teste de Acuidade (sem câmara)", () => {
  beforeEach(() => {
    acesso.mockResolvedValue({
      estado: "premium",
      exercicios_desbloqueados: ["figure8"],
      exercicios_trial: [],
      exercicios_premium: [],
      trial_iniciado_em: null,
      trial_termina_em: null,
      trial_dias_restantes: null,
    });
  });

  it("nunca pede a câmara e mostra o aviso de triagem em cada passo", async () => {
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });

    render(
      <MemoryRouter>
        <AcessoExerciciosProvider>
          <TesteAcuidade />
        </AcessoExerciciosProvider>
      </MemoryRouter>,
    );

    const aviso = /Teste de triagem\. Não é um exame médico/;
    await screen.findByText(aviso);
    await screen.findByText("Ponha o brilho do ecrã no máximo");
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByText("Ajuste ao tamanho de um cartão");
    expect(screen.getByText(aviso)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Não tenho cartão" }));
    await screen.findByText("Óculos ou lentes de contacto");
    expect(screen.getByText(aviso)).toBeInTheDocument();

    await waitFor(() => expect(getUserMedia).not.toHaveBeenCalled());
  });
});
