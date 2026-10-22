import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ResumoClinico from "./ResumoClinico";
import type { SessaoParaRelatorio } from "@/lib/visao/progresso";

// Resumo clínico do relatório para o oftalmologista (Programa Olhos Juntos, Vaga 1).

const hoje = new Date(2026, 9, 21, 18);
const haDias = (n: number) => new Date(2026, 9, 21 - n, 10).toISOString();

const sessao = (o: Partial<SessaoParaRelatorio>): SessaoParaRelatorio => ({
  exercicio_id: "figure8",
  created_at: haDias(0),
  segundos_activos: 60,
  olho: "direito",
  limiar: 0.3,
  unidade: "logmar",
  calibrado: true,
  distancia_mm: 400,
  sinais: { aglomeracao: true, distancia_medida: true },
  ...o,
});

const conv = (rotura: number) => ({ rampas: 2, semFusao: 0, rotura, recuperacao: rotura - 4, limiteEcra: false, maximo: 30 });
const vazio = { rampas: 0, semFusao: 0, rotura: null, recuperacao: null, limiteEcra: false, maximo: null };

const historico: SessaoParaRelatorio[] = [
  sessao({ created_at: haDias(14), olho: "direito", limiar: 0.5 }),
  sessao({ created_at: haDias(14), olho: "esquerdo", limiar: 0.1 }),
  sessao({ olho: "direito", limiar: 0.3 }),
  sessao({ olho: "esquerdo", limiar: 0.1 }),
  sessao({
    exercicio_id: "convergence",
    olho: "ambos",
    limiar: 14,
    unidade: "dioptrias_prismaticas",
    sinais: { pontes: { convergencia: conv(14), divergencia: vazio }, oculos_verificados: true, distancia_medida: true },
  }),
  sessao({
    exercicio_id: "ambliopia",
    olho: "ambos",
    limiar: 0.4,
    unidade: "razao_contraste",
    segundos_activos: 900,
    sinais: { modo: "dicoptico", olho_fraco: "esquerdo", orientacao_graus: 12, diplopia_reportada: true },
  }),
];

describe("ResumoClinico", () => {
  it("acuidade por olho em logMAR e 6/x, com a diferença em linhas e as condições", () => {
    render(<ResumoClinico sessoes={historico} hoje={hoje} />);
    expect(screen.getByText("Acuidade visual com aglomeração")).toBeInTheDocument();
    expect(
      screen.getByText(/^Mais recente \(.+\): OD: logMAR 0,30 \(6\/12\) · OE: logMAR 0,10 \(6\/7,5\) · diferença de 2 linhas entre os olhos$/),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Primeira \(.+\): OD: logMAR 0,50 \(6\/19\) · OE: logMAR 0,10/)).toBeInTheDocument();
    expect(
      screen.getAllByText(/Medido em 2 dias\. Na medição mais recente: distância de 40 cm, medida pelo ponto cego; ecrã calibrado com cartão\./),
    ).toHaveLength(1);
  });

  it("as medições antigas levam o nome do teste que as fez, não o do exercício que hoje usa o mesmo id", () => {
    const comEstereo = [
      ...historico,
      sessao({ exercicio_id: "estereopsia", olho: "ambos", limiar: 200, unidade: "arcsec", sinais: { oculos_verificados: true } }),
    ];
    render(<ResumoClinico sessoes={comEstereo} hoje={hoje} />);
    expect(screen.getByText("· Olhos de Palanca ao perto (anel)", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("· Teste de Estereopsia (com óculos 3D)", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("· Desafio da Agulha", { exact: false })).not.toBeInTheDocument();
  });

  it("vergência em Δ por sentido e Kianda com o olho mais fraco", () => {
    render(<ResumoClinico sessoes={historico} hoje={hoje} />);
    expect(screen.getByText(/^Convergência · Mais recente \(.+\): rotura 14 Δ, recuperação 10 Δ$/)).toBeInTheDocument();
    expect(screen.queryByText(/^Divergência/)).not.toBeInTheDocument();
    expect(screen.getByText(/óculos vermelho-ciano verificados/)).toBeInTheDocument();
    expect(screen.getByText("Olho treinado: OE (vê os peixes com o contraste todo).")).toBeInTheDocument();
    expect(screen.getByText(/olho mais forte a 40% · diferença de orientação distinguida: 12°/)).toBeInTheDocument();
  });

  it("avisa da visão dupla relatada e mostra a adesão ao treino (Kianda 15 min + Pontes 1 min)", () => {
    render(<ResumoClinico sessoes={historico} hoje={hoje} />);
    expect(screen.getByText(/^Visão dupla relatada durante o treino: /)).toBeInTheDocument();
    expect(screen.getByText(/Minutos efectivos por semana, da mais antiga para a mais recente: 0 · 0 · 0 · 16/)).toBeInTheDocument();
    expect(screen.getByText("Dias com treino: 1 de 28")).toBeInTheDocument();
  });

  it("notas de método só das medidas que aparecem", () => {
    render(<ResumoClinico sessoes={historico} hoje={hoje} />);
    expect(screen.getByText(/^Acuidade: anel de Landolt \(ISO 8596\) rodeado por quatro barras/)).toBeInTheDocument();
    expect(screen.getByText(/^Vergência: /)).toBeInTheDocument();
    expect(screen.getByText(/^Distância: medida pelo ponto cego/)).toBeInTheDocument();
    expect(screen.queryByText(/^Estereoacuidade: /)).not.toBeInTheDocument();
  });

  it("menos de um minuto de treino numa semana aparece como <1, não como 0", () => {
    const curta = historico.find((s) => s.exercicio_id === "ambliopia")!;
    render(<ResumoClinico sessoes={[{ ...curta, segundos_activos: 12 }]} hoje={hoje} />);
    expect(screen.getByText(/mais recente: 0 · 0 · 0 · <1$/)).toBeInTheDocument();
  });

  it("sem sessões: diz que não há medições e que não houve treino", () => {
    render(<ResumoClinico sessoes={[]} hoje={hoje} />);
    expect(screen.getByText("Ainda não há medições nos últimos 90 dias.")).toBeInTheDocument();
    expect(screen.getByText("Sem treino neste período.")).toBeInTheDocument();
    expect(screen.queryByText("Como se mede")).not.toBeInTheDocument();
  });
});
