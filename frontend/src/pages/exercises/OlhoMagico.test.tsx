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
  // Estes testes são do nível dos quadros de pano; o do pássaro e da gaiola está no fim.
  window.localStorage.setItem("jpa.visao.olhoMagico.nivel", "pano");
  vez = 0;
  largura = 800;
  janela(1024, 768);
  vi.spyOn(Math, "random").mockReturnValue(0);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => largura);
});
afterEach(() => vi.restoreAllMocks());

const montar = (historico: ContextoTreino["historico"] = []) => {
  const api: ApiTarefa = { activo: true, registar: vi.fn(), proximaEControlo: () => false };
  const ctx: ContextoTreino = {
    olho: null,
    pxPorMm: 6,
    calibrado: true,
    distanciaMm: 400,
    devicePixelRatio: 1,
    historico,
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

describe("Olho Mágico, nível do pássaro e da gaiola", () => {
  const clicar = (nome: string) => fireEvent.click(screen.getByRole("button", { name: nome }));
  beforeEach(() => window.localStorage.removeItem("jpa.visao.olhoMagico.nivel"));

  it("começa pela gaiola: junta à primeira, mede a rotura e a recuperação declaradas e grava como auto-avaliação", () => {
    const { api, resultado } = montar();
    expect(screen.getByRole("radio", { name: V.olhoMagicoNivel_gaiola })).toHaveAttribute("aria-checked", "true");
    clicar(V.gaiolaExperimentar);
    clicar(V.gaiolaResposta_dentro);
    // Degraus de 6, 8, 10, 12 Δ (cartões de 22 mm a 40 cm): sai da gaiola a 12, volta a entrar a 8.
    for (let i = 0; i < 3; i++) clicar(V.gaiolaContinuaDentro);
    clicar(V.gaiolaSaiu);
    expect(screen.getByText(V.gaiolaAproximarTitulo)).toBeInTheDocument();
    clicar(V.gaiolaAindaFora);
    clicar(V.gaiolaVoltou);
    expect(screen.getByText(/O pássaro saiu da gaiola a 12/)).toBeInTheDocument();
    expect(screen.getByText(V.gaiolaSemSupressao)).toBeInTheDocument();
    // O nível fica fixo depois da primeira resposta.
    expect(screen.getByRole("radio", { name: V.olhoMagicoNivel_pano })).toBeDisabled();

    expect(api.registar).toHaveBeenCalledTimes(7);
    const r = resultado.current!();
    expect(r.limiar).toBeNull();
    expect(r.unidade).toBeUndefined();
    expect(r.sinais).toMatchObject({
      modo: "fusao_gaiola",
      versao: 2,
      fusao: "ambos",
      a_primeira: true,
      respostas: { dentro: 1, falta: 0, dois: 0, quatro: 0 },
      gaiola: { rampas: 1, rotura: 12, recuperacao: 8 },
    });
  });

  it("com o sol ou a nuvem a faltar, dá a dica e deixa continuar, registando a supressão", () => {
    const { resultado } = montar();
    clicar(V.gaiolaExperimentar);
    clicar(V.gaiolaResposta_dois);
    expect(screen.getByText(V.gaiolaDicaTitulo_dois)).toBeInTheDocument();
    clicar(V.tentarDeNovo);
    clicar(V.gaiolaResposta_falta);
    expect(screen.getByText(V.gaiolaDicaTitulo_falta)).toBeInTheDocument();
    clicar(V.gaiolaContinuarAssim);
    // Aguenta todos os degraus que cabem: fica "acima de".
    while (screen.queryByRole("button", { name: V.gaiolaContinuaDentro })) clicar(V.gaiolaContinuaDentro);
    expect(screen.getByText(V.gaiolaAteAoFim)).toBeInTheDocument();
    expect(screen.getByText(V.gaiolaComSupressao)).toBeInTheDocument();
    expect(resultado.current!().sinais).toMatchObject({ fusao: "supressao", a_primeira: false, gaiola: { limiteEcra: true, rotura: null } });
  });

  it("ao terceiro dia seguido à primeira, a próxima sessão passa aos quadros de pano", () => {
    const dia = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return { created_at: d.toISOString(), sinais: { modo: "fusao_gaiola", a_primeira: true } } as unknown as ContextoTreino["historico"][number];
    };
    montar([dia(1), dia(2)]);
    clicar(V.gaiolaExperimentar);
    clicar(V.gaiolaResposta_dentro);
    expect(window.localStorage.getItem("jpa.visao.olhoMagico.nivel")).toBe("pano");
  });
});
