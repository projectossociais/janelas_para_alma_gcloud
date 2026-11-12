import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useRegistoSessao } from "./hooks";
import TesteAcuidade from "@/pages/exercises/TesteAcuidade";
import { AcessoExerciciosProvider } from "@/contexts/AcessoExerciciosContext";
import ptAO from "@/i18n/locales/pt-AO.json";

const V = ptAO.Visao;

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
    // O brilho já não é um ecrã: é uma linha por baixo dos passos.
    await screen.findByText("Ajuste ao tamanho de um cartão");
    expect(screen.getByText(V.brilhoLinha)).toBeInTheDocument();
    expect(screen.getByText(aviso)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Não tenho cartão" }));
    await screen.findByText("Óculos ou lentes de contacto");
    expect(screen.getByText(aviso)).toBeInTheDocument();

    await waitFor(() => expect(getUserMedia).not.toHaveBeenCalled());
  });

  // Caso real (2026-10-08, teste feito pelo dono do projecto): os dois olhos
  // passaram os mesmos níveis, um com mais erros, e o resultado foi igual.
  // Desde 2026-10-21 o teste é ao longe (3 m), com a mãozinha e o deslize do adulto.
  // Desde 2026-11-12: treino com os dois olhos, barras à volta, descida rápida
  // e limiar de 4 por tamanho, e o olho pior repetido com 2 linhas de diferença.
  describe("Olhos de Palanca ao longe", () => {
    const oposto = { direita: "esquerda", esquerda: "direita", cima: "baixo", baixo: "cima" } as const;
    const vector = { direita: [100, 0], esquerda: [-100, 0], cima: [0, -100], baixo: [0, 100] } as const;
    const seta = { direita: "ArrowRight", esquerda: "ArrowLeft", cima: "ArrowUp", baixo: "ArrowDown" } as const;
    const mao = () => document.querySelector("svg[data-direccao]")!;
    const deslizar = (d: keyof typeof vector) => {
      const palco = screen.getByRole("application");
      // O jsdom não tem PointerEvent: um MouseEvent com o mesmo nome leva as coordenadas.
      palco.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 200, clientY: 300 }));
      palco.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, clientX: 200 + vector[d][0], clientY: 300 + vector[d][1] }));
    };
    const responder = (respostas: boolean[], primeiraPorTeclado = false) => {
      for (const [i, certa] of respostas.entries()) {
        const d = mao().getAttribute("data-direccao") as keyof typeof vector;
        if (i === 0 && primeiraPorTeclado) fireEvent.keyDown(window, { key: seta[certa ? d : oposto[d]] });
        else act(() => deslizar(certa ? d : oposto[d]));
      }
    };
    const responderOlho = async (respostas: boolean[]) => {
      fireEvent.click(await screen.findByRole("button", { name: V.palancaComecar }));
      // A primeira resposta de cada olho vai pelas setas do teclado (num computador); as outras, pelo deslize.
      responder(respostas.slice(0, 1), true);
      // O adulto vê que a resposta contou, e que o teste pára sozinho.
      expect(screen.getByText(/Respostas: 1/)).toBeInTheDocument();
      expect(screen.getByText(V.palancaParaSozinho)).toBeInTheDocument();
      responder(respostas.slice(1));
    };
    const abrir = async () => {
      window.localStorage.clear(); // sem calibração nem distância guardadas pelo teste anterior
      registar.mockReset().mockResolvedValue({});
      render(
        <MemoryRouter>
          <AcessoExerciciosProvider>
            <TesteAcuidade />
          </AcessoExerciciosProvider>
        </MemoryRouter>,
      );
      fireEvent.click(await screen.findByRole("button", { name: "Não tenho cartão" }));
      fireEvent.click(await screen.findByRole("button", { name: /Não uso óculos nem lentes/ }));
      await screen.findByText(V.palancaPrepararTitulo);
      fireEvent.click(screen.getByRole("button", { name: V.palancaFazerTreino })); // montar a 3 metros
    };
    const sessaoDe = (olho: string) => registar.mock.calls.find((c) => c[0].olho === olho)?.[0];
    // Descida rápida 0,7 ✓ · 0,6 ✓ · 0,5 ✗; limiar a partir de 0,7: 0,7 ✓✓✓ · 0,6 ✓✓✓ · 0,5 ✗✗
    const ATE_0_6 = [true, true, false, true, true, true, true, true, true, false, false];

    it("treino, barras, e dois olhos nos mesmos tamanhos com erros diferentes dão resultados diferentes", async () => {
      await abrir();
      // Treino com os dois olhos: mãozinha grande, sem barras; 4 certas e segue.
      expect(mao().getAttribute("data-barras")).toBe("nao");
      expect(screen.getByText(/Treino com os dois olhos abertos · 1 de 4/)).toBeInTheDocument();
      responder([true, true, true, true]);
      // "Tape o outro olho" e "Começar" são um só ecrã, antes de cada olho.

      fireEvent.click(await screen.findByRole("button", { name: V.palancaComecar }));
      expect(mao().getAttribute("data-barras")).toBe("sim"); // 0,7 a 3 m cabe com as barras
      fireEvent.click(screen.getByRole("button", { name: V.palancaParar }));
      await responderOlho(ATE_0_6);
      // Esquerdo: igual, mas 0,6 ✓✗✓✓ -- o mesmo tamanho, com um erro
      await responderOlho([true, true, false, true, true, true, true, false, true, true, false, false]);

      await screen.findByText(V.resultadoAcuidadeTitulo);
      await waitFor(() => expect(registar).toHaveBeenCalledTimes(2));
      expect(sessaoDe("direito").distancia_mm).toBe(3000);
      expect(sessaoDe("direito").sinais).toMatchObject({
        ao_longe: true,
        aglomeracao: true,
        barras_no_limiar: true,
        protocolo: "rapida_4_3",
        confirmado: false,
        criterio: "6/9",
        optotipo: "E",
        resposta: "gesto",
      });
      expect(sessaoDe("direito").limiar).toBe(0.6);
      expect(sessaoDe("esquerdo").limiar).toBeGreaterThan(0.6);
      expect(sessaoDe("esquerdo").limiar).toBeLessThan(0.65);
      // Menos de 2 linhas de diferença: nenhum olho se repete.
      expect(screen.queryByText(V.palancaConfirmarTexto)).not.toBeInTheDocument();
      expect(screen.getByText(V.palancaCriterio6_9)).toBeInTheDocument();
    }, 20000);

    it("treino falhado: não segue para o teste, e pode treinar outra vez", async () => {
      await abrir();
      responder([true, false, false, true]);
      expect(await screen.findByText(/Ainda não deu: acertou 2 de 4/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: V.palancaComecar })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: V.palancaTreinarOutraVez }));
      responder([true, true, true, false]);
      expect(await screen.findByRole("button", { name: V.palancaComecar })).toBeInTheDocument();
      expect(registar).not.toHaveBeenCalled();
    }, 20000);

    it("2 linhas ou mais de diferença: o olho pior repete-se e fica o melhor dos dois resultados", async () => {
      await abrir();
      responder([true, true, true, true]);
      await responderOlho(ATE_0_6); // direito: 0,6
      // Esquerdo: erra logo -> limiar a partir de 0,9: 0,9 ✓✓✓ · 0,8 ✗✗ -> 0,9
      await responderOlho([false, true, true, true, false, false]);

      // Ainda não há resultado nem gravação: primeiro repete-se o olho esquerdo.
      expect(await screen.findByText(V.palancaConfirmarTexto)).toBeInTheDocument();
      expect(screen.queryByText(V.resultadoAcuidadeTitulo)).not.toBeInTheDocument();
      expect(registar).not.toHaveBeenCalled();
      await responderOlho(ATE_0_6); // desta vez, 0,6: era distracção

      await screen.findByText(V.resultadoAcuidadeTitulo);
      await waitFor(() => expect(registar).toHaveBeenCalledTimes(2));
      expect(sessaoDe("esquerdo").limiar).toBe(0.6);
      expect(sessaoDe("esquerdo").sinais.confirmado).toBe(true);
      expect(sessaoDe("direito").sinais.confirmado).toBe(false);
      expect(screen.getByText(/foi repetido para confirmar/)).toBeInTheDocument();
      expect(screen.queryByText(V.acuidadeSinalDiferenca)).not.toBeInTheDocument();
    }, 20000);
  });
});

