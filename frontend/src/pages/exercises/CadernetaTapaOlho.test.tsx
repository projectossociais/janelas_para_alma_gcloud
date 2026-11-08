import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CadernetaTapaOlho from "./CadernetaTapaOlho";
import { AcessoExerciciosProvider } from "@/contexts/AcessoExerciciosContext";
import ptAO from "@/i18n/locales/pt-AO.json";

const V = ptAO.Visao;

vi.mock("@/contexts/ConsentimentoSaudeContext", () => ({
  useConsentimentoSaude: () => ({ consentido: true, carregando: false, garantir: () => Promise.resolve(true), retirar: () => Promise.resolve() }),
}));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isLoggedIn: true, loading: false }) }));
vi.mock("@/contexts/ProfileContext", () => ({ useProfile: () => ({ profile: { olho_mais_fraco: "esquerdo" }, loading: false, setProfile: () => undefined }) }));

const registar = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  sessoesExercicioApi: { registar: (...a: unknown[]) => registar(...a), minhas: () => Promise.resolve([]) },
  exerciciosApi: {
    acesso: () =>
      Promise.resolve({
        estado: "premium",
        exercicios_desbloqueados: ["flexibilidade-acomodativa"],
        exercicios_trial: [],
        exercicios_premium: [],
        trial_iniciado_em: null,
        trial_termina_em: null,
        trial_dias_restantes: null,
      }),
    iniciarTrial: () => Promise.resolve(),
  },
  perfilApi: { atualizar: () => Promise.resolve({}) },
  mensagemDeErroApi: (_e: unknown, fallback: string) => fallback,
}));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

/** Os tempos no ecrã usam espaços que não partem a linha ("1 h 30"). */
const nb = (s: string) => s.replace(/ /g, "\u00a0");

const montar = () =>
  render(
    <MemoryRouter>
      <AcessoExerciciosProvider>
        <CadernetaTapaOlho />
      </AcessoExerciciosProvider>
    </MemoryRouter>,
  );

/** Relógio falso a partir das 10:00; `aos(min)` salta para esse minuto. */
const relogio = () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const t0 = new Date(2026, 9, 21, 10, 0, 0).getTime();
  vi.setSystemTime(t0);
  return async (min: number) => {
    await act(async () => {
      vi.setSystemTime(t0 + min * 60_000);
      await vi.advanceTimersByTimeAsync(1000);
    });
  };
};

describe("Caderneta do Tapa-olho", () => {
  it("escolhe o tempo receitado, dá o cromo e, ao tirar, corrige a hora esquecida", async () => {
    const aos = relogio();
    registar.mockReset().mockResolvedValue({});
    montar();
    // Primeira vez: pergunta o tempo receitado.
    fireEvent.click(await screen.findByRole("radio", { name: new RegExp(V.cadernetaAlvoOutro) }));
    fireEvent.click(screen.getByRole("button", { name: V.cadernetaMenos })); // 1 h 30 → 1 h
    fireEvent.click(screen.getByRole("button", { name: V.cadernetaGuardar }));
    expect(window.localStorage.getItem("jpa.visao.caderneta.alvo")).toBe("60");

    fireEvent.click(await screen.findByRole("button", { name: V.cadernetaPor }));
    await aos(14);
    expect(screen.getByText("14 min")).toBeInTheDocument();
    // Sem a pergunta de 15 em 15 min (desligada à partida), o tempo conta sozinho.
    await aos(40);
    expect(screen.queryByText(V.cadernetaPergunta)).not.toBeInTheDocument();
    await aos(60);
    expect(await screen.findByText(V.cadernetaCromoNovo)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: V.cadernetaColar }));

    fireEvent.click(await screen.findByRole("button", { name: V.cadernetaTirar }));
    expect(await screen.findByText(V.cadernetaTirouAgora)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: V.cadernetaHa.replace("{{tempo}}", nb("15 min")) }));
    fireEvent.click(screen.getByRole("button", { name: V.cadernetaGuardar }));

    await waitFor(() => expect(registar).toHaveBeenCalledTimes(1));
    const s = registar.mock.calls[0][0];
    expect(s).toMatchObject({ exercicio_id: "flexibilidade-acomodativa", olho: "esquerdo", limiar: null });
    expect(s.segundos_activos).toBeGreaterThanOrEqual(45 * 60);
    expect(s.segundos_activos).toBeLessThan(46 * 60);
    expect(s.sinais).toMatchObject({ modo: "tapa_olho_horas", versao: 2, alvo_min: 60, manual: false, tirado_antes_min: 15, verificacoes: null });
  }, 30000);

  it("com a pergunta ligada, se ninguém confirmar, só conta até à última confirmação", async () => {
    const aos = relogio();
    window.localStorage.setItem("jpa.visao.caderneta.alvo", "60");
    window.localStorage.setItem("jpa.visao.caderneta.verificar", "1");
    registar.mockReset().mockResolvedValue({});
    montar();
    fireEvent.click(await screen.findByRole("button", { name: V.cadernetaPor }));
    await aos(50); // esqueceram-se: 50 min sem responder
    fireEvent.click(await screen.findByRole("button", { name: V.cadernetaTirou }));
    // Nada confirmado: menos de um minuto, não se grava.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(registar).not.toHaveBeenCalled();
  }, 30000);

  it("acrescenta à mão o tempo feito sem o telemóvel, marcado à parte", async () => {
    window.localStorage.setItem("jpa.visao.caderneta.alvo", "120");
    registar.mockReset().mockResolvedValue({});
    montar();
    fireEvent.click(await screen.findByRole("button", { name: V.cadernetaAcrescentar }));
    fireEvent.click(screen.getByRole("radio", { name: nb("1 h 30") }));
    fireEvent.click(screen.getByRole("button", { name: V.cadernetaAcrescentarBotao.replace("{{tempo}}", nb("1 h 30")) }));
    await waitFor(() => expect(registar).toHaveBeenCalledTimes(1));
    const s = registar.mock.calls[0][0];
    expect(s.segundos_activos).toBe(90 * 60);
    expect(s.sinais).toMatchObject({ modo: "tapa_olho_horas", versao: 2, manual: true, minutos: 90 });
  });
});
