import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { EscolherModoKianda } from "./Kianda";
import JogoKianda from "@/components/visao/JogoKianda";
import PescaKianda from "@/components/visao/PescaKianda";
import type { ApiTarefa, ContextoTreino, ResultadoTreino } from "@/components/visao/AssistenteTreino";
import type { SessaoExercicioPublica } from "@/lib/apiClient";
import ptAO from "@/i18n/locales/pt-AO.json";

const V = ptAO.Visao;

beforeEach(() => window.localStorage.clear());

const nome = (s: string) => new RegExp(s.replace(/[()]/g, "\\$&"));

describe("Kianda: escolha do modo", () => {
  it("por omissão, sem óculos (tapa-olho), que vem primeiro; a escolha fica guardada", () => {
    const aoEscolher = vi.fn();
    render(<EscolherModoKianda aoEscolher={aoEscolher} />);
    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toHaveAccessibleName(nome(V.kiandaModoTapaOlho));
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: nome(V.kiandaModoOculos) }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(aoEscolher).toHaveBeenCalledWith("oculos");
    expect(window.localStorage.getItem("jpa.visao.kianda.modo")).toBe("oculos");
  });

  it("da vez seguinte, vem marcada a última escolha", () => {
    window.localStorage.setItem("jpa.visao.kianda.modo", "oculos");
    render(<EscolherModoKianda aoEscolher={vi.fn()} />);
    expect(screen.getByRole("radio", { name: nome(V.kiandaModoOculos) })).toHaveAttribute("aria-checked", "true");
  });
});

const sessaoDicoptica = (contrasteFinal: number): SessaoExercicioPublica =>
  ({
    id: "s1",
    user_id: "u1",
    exercicio_id: "ambliopia",
    duracao_segundos: 300,
    pontuacao: 0,
    precisao_percentual: 0,
    detalhes: null,
    created_at: new Date().toISOString(),
    versao: 2,
    olho: "ambos",
    segundos_activos: 300,
    limiar: 0.5,
    unidade: "razao_contraste",
    distancia_mm: 500,
    px_por_mm: 4,
    calibrado: true,
    sinais: { modo: "dicoptico", contraste_final: contrasteFinal },
  }) as SessaoExercicioPublica;

const montarJogo = (historico: SessaoExercicioPublica[] = [], olho: "direito" | "esquerdo" | null = "esquerdo") => {
  const api: ApiTarefa = { activo: true, registar: vi.fn(), proximaEControlo: () => false };
  const ctx: ContextoTreino = {
    olho,
    pxPorMm: 4,
    calibrado: true,
    distanciaMm: 500,
    devicePixelRatio: 1,
    historico,
    afinacao: null,
  };
  const resultado: MutableRefObject<(() => ResultadoTreino) | null> = { current: null };
  render(<JogoKianda api={api} ctx={ctx} resultado={resultado} />);
  return resultado;
};

describe("Kianda: jogo com óculos 3D", () => {
  it("sem histórico, começa com o olho forte a 20%", () => {
    montarJogo();
    expect(screen.getByText("Olho mais forte: 20%")).toBeInTheDocument();
  });

  it("continua de onde ficou: um passo abaixo do último contraste", () => {
    montarJogo([sessaoDicoptica(0.6)]);
    expect(screen.getByText("Olho mais forte: 50%")).toBeInTheDocument();
  });

  it("sem rondas completas, o resultado não tem limiar, mas guarda o modo e o olho", () => {
    const r = montarJogo();
    const res = r.current!();
    expect(res.limiar).toBeNull();
    expect(res.unidade).toBe("razao_contraste");
    expect(res.sinais).toMatchObject({ modo: "dicoptico", olho_fraco: "esquerdo", contraste_inicial: 0.2, diplopia_reportada: false });
  });

  it("'Estou a ver a dobrar' pausa, explica, e fica registado na sessão", () => {
    const r = montarJogo();
    fireEvent.click(screen.getByRole("button", { name: V.kiandaVejoADobrar }));
    expect(screen.getByText(V.kiandaDiplopiaTexto)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: V.kiandaContinuar }));
    expect(screen.queryByText(V.kiandaDiplopiaTexto)).not.toBeInTheDocument();
    expect(r.current!().sinais?.diplopia_reportada).toBe(true);
  });

  it("sem o olho mais fraco escolhido, não joga", () => {
    montarJogo([], null);
    expect(screen.getByText(V.kiandaSemOlho)).toBeInTheDocument();
  });
});

describe("Kianda: pesca com tapa-olho (sem óculos)", () => {
  const montarPesca = (olho: "direito" | "esquerdo" | null = "esquerdo") => {
    const api: ApiTarefa = { activo: true, registar: vi.fn(), proximaEControlo: () => false };
    const ctx: ContextoTreino = {
      olho,
      pxPorMm: 6,
      calibrado: true,
      distanciaMm: 400,
      devicePixelRatio: 1,
      historico: [],
      afinacao: null,
    };
    const resultado: MutableRefObject<(() => ResultadoTreino) | null> = { current: null };
    render(<PescaKianda api={api} ctx={ctx} resultado={resultado} />);
    return resultado;
  };

  it("mostra o sinal das riscas, os peixes e o nível", () => {
    montarPesca();
    expect(screen.getByText(V.pescaRiscasAssim)).toBeInTheDocument();
    expect(screen.getByText("Peixes: 0")).toBeInTheDocument();
    expect(screen.getByText("Nível 1")).toBeInTheDocument();
  });

  it("sem peixes apanhados, não inventa um limiar; grava o modo em graus", () => {
    const r = montarPesca();
    const res = r.current!();
    expect(res.limiar).toBeNull();
    expect(res.unidade).toBe("graus");
    expect(res.resumo).toBe(V.pescaSemLimiar);
    expect(res.sinais).toMatchObject({ modo: "tapa_olho", nivel: 1, peixes_certos: 0, precisao: null });
  });

  it("sem o olho mais fraco escolhido, não joga", () => {
    montarPesca(null);
    expect(screen.getByText(V.kiandaSemOlho)).toBeInTheDocument();
  });
});
