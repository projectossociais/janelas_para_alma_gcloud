import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { MutableRefObject } from "react";
import TreinoFio from "./TreinoFio";
import type { ApiTarefa, ContextoTreino, ResultadoTreino } from "@/components/visao/AssistenteTreino";
import ptAO from "@/i18n/locales/pt-AO.json";

// Vaivém da Missanga (2026-11-11): o Fio de Missangas em treino diário, no
// lugar do Olho Mágico. A lógica tem testes próprios (`fioTreino.test.ts`);
// aqui, o ecrã: toques, repetições, o que se grava e a pausa entre blocos.

const V = ptAO.Visao;

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 768 });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const montar = (activo = true) => {
  const api: ApiTarefa = { activo, registar: vi.fn(), proximaEControlo: () => false, presente: vi.fn(), terminar: vi.fn() };
  // 768 px de altura a 6 px/mm: a missanga parte dos 12 cm.
  const ctx: ContextoTreino = { olho: null, pxPorMm: 6, calibrado: true, distanciaMm: 600, devicePixelRatio: 1, historico: [], afinacao: null };
  const resultado: MutableRefObject<(() => ResultadoTreino) | null> = { current: null };
  const vista = render(<TreinoFio api={api} ctx={ctx} resultado={resultado} />);
  return { api, ctx, resultado, ...vista };
};
const passar = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const tocar = (nome: string) => fireEvent.pointerDown(screen.getByRole("button", { name: nome }));

describe("Vaivém da Missanga: o ecrã do treino", () => {
  it("um vaivém conta uma repetição e grava onde ficou a dobrar, em cm, como treino do fio", () => {
    const { api, resultado } = montar();
    expect(screen.getByText("Repetições: 0")).toBeInTheDocument();
    passar(900 + 4000); // parada 0,9 s; depois 12 -> 6 cm a 1,5 cm/s
    tocar(V.fioToqueDuas);
    passar(2000); // 6 -> 9 cm
    tocar(V.fioToqueUma);
    expect(screen.getByText("Repetições: 1")).toBeInTheDocument();
    expect(screen.getByText(V.fioTreinoEvento_recuperacao)).toBeInTheDocument();
    expect(screen.getByText("Mais perto até agora: 6 cm")).toBeInTheDocument();

    // Dois toques = duas respostas; e a missanga a andar sozinha conta como tempo activo.
    expect(api.registar).toHaveBeenCalledTimes(2);
    expect(api.presente).toHaveBeenCalled();
    const r = resultado.current!();
    expect(r).toMatchObject({ limiar: 6, unidade: "cm" });
    expect(r.sinais).toMatchObject({ modo: "fio_treino", repeticoes: 1, melhor_cm: 6, rotura_cm: [6], chegou_ao_nariz: 0, inicio_cm: 12 });
  });

  it("sem tocar, a missanga chega ao nariz: conta a repetição a 0 cm e festeja", () => {
    const { resultado } = montar();
    passar(900 + 9000);
    expect(screen.getByText(V.fioTreinoEvento_nariz)).toBeInTheDocument();
    expect(resultado.current!().sinais).toMatchObject({ repeticoes: 1, chegou_ao_nariz: 1, melhor_cm: 0 });
  });

  it("sem repetições, não inventa um resultado", () => {
    const { resultado } = montar();
    const r = resultado.current!();
    expect(r.limiar).toBeNull();
    expect(r.resumo).toBe(V.fioTreinoSemReps);
  });

  it("na pausa entre blocos a missanga pára e os toques não contam", () => {
    const { api, resultado } = montar(false);
    passar(10_000);
    tocar(V.fioToqueDuas);
    expect(api.registar).not.toHaveBeenCalled();
    expect(resultado.current!().sinais).toMatchObject({ repeticoes: 0 });
  });

  it("o ecrã inteiro tem o seu 'Terminar agora', que o do assistente fica tapado", () => {
    const { api } = montar();
    fireEvent.click(screen.getByRole("button", { name: V.terminarAgora }));
    expect(api.terminar).toHaveBeenCalled();
  });
});
