import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import type { MutableRefObject } from "react";
import PintarSamakaka from "./PintarSamakaka";
import type { ApiTarefa, ContextoTreino, ResultadoTreino } from "./AssistenteTreino";
import { MOTIVOS } from "@/lib/visao/samakaka";
import ptAO from "@/i18n/locales/pt-AO.json";

const V = ptAO.Visao;

afterEach(() => vi.restoreAllMocks());

const montar = () => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
  const api: ApiTarefa = { activo: true, registar: vi.fn(), proximaEControlo: () => false };
  const ctx: ContextoTreino = { olho: "esquerdo", pxPorMm: 6, calibrado: true, distanciaMm: 400, devicePixelRatio: 1, historico: [], afinacao: null };
  const resultado: MutableRefObject<(() => ResultadoTreino) | null> = { current: null };
  render(<PintarSamakaka api={api} ctx={ctx} resultado={resultado} />);
  return { api, resultado };
};

describe("Pintar o Samakaka", () => {
  it("sem traço seguido, não inventa um valor", () => {
    const { resultado } = montar();
    const r = resultado.current!();
    expect(r).toMatchObject({ limiar: null, unidade: "mm", resumo: V.samakakaSemLimiar });
  });

  it("seguir o zigue-zague com o dedo pinta o motivo e mede o afastamento", () => {
    vi.useFakeTimers();
    const { api, resultado } = montar();
    const tela = screen.getByRole("application", { name: V.samakakaRotuloPalco });
    const ev = (tipo: string, x: number, y: number) =>
      tela.dispatchEvent(new MouseEvent(tipo, { bubbles: true, clientX: x * 300, clientY: y * 300 }));
    const pts = MOTIVOS[0].pontos();
    act(() => {
      ev("pointerdown", pts[0][0], pts[0][1]);
      for (let k = 0; k < pts.length - 1; k++)
        for (let j = 1; j <= 20; j++) {
          const t = j / 20;
          // 1 px ao lado do traço: dentro da folga.
          ev("pointermove", pts[k][0] + (pts[k + 1][0] - pts[k][0]) * t, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t + 1 / 300);
        }
    });
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.getByLabelText(V.samakakaPano.replace("{{n}}", "1"))).toBeInTheDocument();
    // A instrução passa para o motivo seguinte (antes ficava com o nome do anterior).
    expect(screen.getByText(V.samakakaInstrucao.replace("{{motivo}}", V.samakakaMotivo_losango))).toBeInTheDocument();
    const r = resultado.current!();
    expect(r.unidade).toBe("mm");
    expect(r.limiar).toBeLessThan(0.5);
    expect(r.sinais).toMatchObject({ modo: "samakaka", motivos: 1, dentro_pct: 100, ponto_mais_fino_mm: 2.2 });
    expect(api.registar).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
