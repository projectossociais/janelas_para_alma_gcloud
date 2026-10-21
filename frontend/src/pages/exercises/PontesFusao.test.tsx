import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { TarefaPontes } from "./PontesFusao";
import type { ApiTarefa, ContextoTreino, ResultadoTreino } from "@/components/visao/AssistenteTreino";
import ptAO from "@/i18n/locales/pt-AO.json";

const V = ptAO.Visao;

// Pontes de Fusão: a fusão é verificada pela forma escondida, por isso a
// "resposta certa" tem de ser conhecida no teste -- a forma sorteada passa a
// ser sempre a primeira (círculo).
vi.mock("@/lib/visao/escada", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/visao/escada")>()),
  escolhaAleatoria: () => 0,
}));

let larguraOriginal: PropertyDescriptor | undefined;
const definirLargura = (px: number) =>
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => px });

beforeEach(() => {
  larguraOriginal = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  definirLargura(800); // 800 px a 4 px/mm = 200 mm de palco: a 40 cm cabem todos os degraus
  window.localStorage.clear();
});

afterEach(() => {
  if (larguraOriginal) Object.defineProperty(HTMLElement.prototype, "clientWidth", larguraOriginal);
});

const ctx: ContextoTreino = {
  olho: null,
  pxPorMm: 4,
  calibrado: true,
  distanciaMm: 400,
  devicePixelRatio: 1,
  historico: [],
  afinacao: null,
};

const montar = (proximaEControlo: () => boolean = () => false) => {
  const registar = vi.fn();
  const api: ApiTarefa = { activo: true, registar, proximaEControlo };
  const resultado: MutableRefObject<(() => ResultadoTreino) | null> = { current: null };
  render(<TarefaPontes api={api} ctx={ctx} resultado={resultado} />);
  return { registar, resultado };
};

const certa = () => fireEvent.click(screen.getByRole("button", { name: V.formaCirculo }));
const errada = () => fireEvent.click(screen.getByRole("button", { name: V.formaQuadrado }));
const verificar = () => [certa, certa, certa].forEach((f) => f());

describe("Pontes de Fusão", () => {
  it("começa pela verificação com os anéis sobrepostos", () => {
    montar();
    expect(screen.getByText(/Primeiro, com os anéis sobrepostos.*\(0 de 3\)/)).toBeInTheDocument();
  });

  it("sem ver a forma a 0 Δ, não avança e explica porquê", () => {
    montar();
    errada();
    errada();
    certa();
    expect(screen.getByText(V.pontesSemFusaoTitulo)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: V.formaCirculo })).not.toBeInTheDocument();
  });

  it("com a forma vista, sobe 2 Δ por resposta certa", () => {
    montar();
    verificar();
    expect(screen.getByText("Convergência: 0 Δ")).toBeInTheDocument();
    certa();
    expect(screen.getByText("Convergência: 2 Δ")).toBeInTheDocument();
  });

  it("mede a rotura e a recuperação em dioptrias prismáticas", () => {
    const { resultado } = montar();
    verificar();
    certa(); // 0 -> 2
    certa(); // 2 -> 4
    certa(); // 4 -> 6
    errada();
    errada(); // rotura a 6 Δ, desce para 4 Δ
    certa();
    certa(); // recuperação a 4 Δ
    const r = resultado.current!();
    expect(r.unidade).toBe("dioptrias_prismaticas");
    expect(r.limiar).toBe(6);
    expect(r.sinais?.pontes).toMatchObject({ convergencia: { rampas: 1, rotura: 6, recuperacao: 4 } });
    expect(r.resumo).toBe("Convergência: rotura 6 Δ, recuperação 4 Δ");
    // Com "Os dois", a ponte seguinte é de divergência.
    expect(screen.getByText("Divergência: 0 Δ")).toBeInTheDocument();
    expect(screen.getByText("Última ponte: Convergência: rotura 6 Δ, recuperação 4 Δ")).toBeInTheDocument();
  });

  it("só divergência: as pontes não passam a convergência", () => {
    montar();
    verificar();
    fireEvent.click(screen.getByRole("radio", { name: V.pontesSentidoDivergencia }));
    expect(screen.getByText("Divergência: 0 Δ")).toBeInTheDocument();
    certa();
    errada();
    errada(); // rotura a 2 Δ
    certa();
    certa(); // recuperação a 0 Δ
    expect(screen.getByText("Divergência: 0 Δ")).toBeInTheDocument();
    expect(window.localStorage.getItem("jpa.visao.pontes.sentidos")).toBe("divergencia");
  });

  it("o estímulo de controlo conta à parte e não mexe na rampa", () => {
    let pedirControlo = true;
    const { registar } = montar(() => {
      const v = pedirControlo;
      pedirControlo = false;
      return v;
    });
    verificar();
    certa(); // rampa: 0 -> 2; a seguir vem o controlo
    certa(); // controlo
    expect(registar).toHaveBeenLastCalledWith({ controlo: true, acertou: true });
    expect(screen.getByText("Convergência: 2 Δ")).toBeInTheDocument();
  });

  it("num ecrã estreito avisa e não deixa responder", () => {
    definirLargura(200); // 50 mm: nem os anéis afastados cabem
    montar();
    verificar();
    expect(screen.getByText(V.pontesEcraEstreito)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: V.formaCirculo })).toBeDisabled();
  });

  it("sem pontes completas, o resultado não tem limiar", () => {
    const { resultado } = montar();
    verificar();
    expect(resultado.current!().limiar).toBeNull();
    expect(resultado.current!().resumo).toBe(V.pontesSemRampas);
  });
});
