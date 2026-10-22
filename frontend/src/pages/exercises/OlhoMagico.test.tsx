import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { TarefaOlhoMagico } from "./OlhoMagico";
import type { ApiTarefa, ContextoTreino, ResultadoTreino } from "@/components/visao/AssistenteTreino";
import ptAO from "@/i18n/locales/pt-AO.json";

const V = ptAO.Visao;

// Com Math.random a 0, as formas saem por esta ordem (nunca a mesma duas vezes seguidas).
const ORDEM = ["Peixe", "Estrela", "Coração", "Casa"];
let vez = 0;
const certa = () => ORDEM[vez++ % 4];
const errada = () => {
  vez++;
  return V.olhoMagicoNaoVejo;
};

let largura = 800;
const janela = (w: number, h: number) => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: w });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: h });
};

beforeEach(() => {
  window.localStorage.clear();
  vez = 0;
  largura = 800;
  janela(1024, 768);
  vi.spyOn(Math, "random").mockReturnValue(0);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => largura);
});
afterEach(() => vi.restoreAllMocks());

const montar = () => {
  const api: ApiTarefa = { activo: true, registar: vi.fn(), proximaEControlo: () => false };
  const ctx: ContextoTreino = {
    olho: null,
    pxPorMm: 6,
    calibrado: true,
    distanciaMm: 400,
    devicePixelRatio: 1,
    historico: [],
    afinacao: null,
  };
  const resultado: MutableRefObject<(() => ResultadoTreino) | null> = { current: null };
  render(<TarefaOlhoMagico api={api} ctx={ctx} resultado={resultado} />);
  return { api, resultado };
};

const responder = (nome: string) => fireEvent.click(screen.getByRole("button", { name: new RegExp(nome) }));
const separacao = () => screen.getByText(/^Separação:/).textContent;

describe("Olho Mágico", () => {
  it("pratica no primeiro degrau, mede a rotura e a recuperação em Δ e grava como as Pontes", () => {
    const { api, resultado } = montar();
    expect(screen.getByText(/A praticar/)).toBeInTheDocument();
    expect(separacao()).toBe("Separação: 5,5 Δ");

    responder(certa());
    responder(certa()); // duas seguidas: começa a medir
    expect(screen.getByText(V.olhoMagicoInstrucao)).toBeInTheDocument();

    responder(certa()); // 5,5 -> 8 Δ
    responder(certa()); // 8 -> 10 Δ
    expect(separacao()).toBe("Separação: 10 Δ");
    responder(errada());
    responder(errada()); // rotura a 10 Δ, desce para 8
    expect(separacao()).toBe("Separação: 8 Δ");
    responder(certa());
    responder(certa()); // recuperação a 8 Δ

    const res = resultado.current!();
    expect(res.unidade).toBe("dioptrias_prismaticas");
    expect(res.limiar).toBe(10);
    expect(res.sinais).toMatchObject({
      modo: "fusao_livre",
      modo_fusao: "cruzar",
      sentido_limiar: "convergencia",
      pontes: { convergencia: { rampas: 1, rotura: 10, recuperacao: 8 }, divergencia: { rampas: 0 } },
    });
    expect(api.registar).toHaveBeenCalledTimes(8); // 2 a praticar + 2 a subir + 2 erros + 2 a recuperar
  });

  it("ao alto, quando os quadros já não se afastam mais, pede para deitar o telemóvel e continua", () => {
    janela(375, 812);
    largura = 340; // ~57 mm: cabem 5,5 e 8 Δ
    montar();
    responder(certa());
    responder(certa());
    responder(certa()); // 5,5 -> 8 Δ, o último que cabe
    responder(certa()); // certa no último: pede para rodar
    expect(screen.getByText(V.olhoMagicoRodarDica)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Peixe/ })).toBeDisabled();

    janela(812, 375);
    largura = 780;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.queryByText(V.olhoMagicoRodarDica)).not.toBeInTheDocument();
    expect(separacao()).toBe("Separação: 10 Δ");
  });

  it("depois de várias falhas a praticar, mostra as dicas outra vez", () => {
    montar();
    for (let i = 0; i < 4; i++) responder(errada());
    expect(screen.getByText(V.olhoMagicoDicasTitulo)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: V.tentarDeNovo }));
    expect(screen.getByText(/A praticar/)).toBeInTheDocument();
  });

  it("relaxar os olhos mede a divergência e volta a praticar", () => {
    const { resultado } = montar();
    responder(certa());
    responder(certa());
    fireEvent.click(screen.getByRole("radio", { name: V.olhoMagicoRelaxar }));
    expect(screen.getByText(/A praticar/)).toBeInTheDocument();
    expect(window.localStorage.getItem("jpa.visao.olhoMagico.modo")).toBe("relaxar");
    expect(resultado.current!().sinais).toMatchObject({ modo_fusao: "relaxar" });
  });
});
