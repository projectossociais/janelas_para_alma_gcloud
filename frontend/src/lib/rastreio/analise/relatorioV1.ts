import { CRITERIOS_V1, calibrar, calibracaoPassaV1, type Calibracao } from "./calibracao";
import { mediana } from "./imagem";

/**
 * Análise da fase V1 (docs/MOTOR_ANALISE_RASTREIO.md §8) a partir dos CSV que a
 * bancada exporta: por pessoa, o factor de Hirschberg e o kappa de cada olho, o
 * desvio a olhar em frente e a repetibilidade; e, para todas as fotografias, a
 * taxa de sucesso e os motivos de falha por caminho de captura (A, B) e por
 * origem das posições dos olhos (detector, toques).
 */

export interface RegistoV1 {
  pessoa: string;
  alvoGraus: number;
  /** "A", "B" ou "ficheiro" (primeira parte da coluna `origem` da bancada). */
  caminho: string;
  posicoes: string;
  motivo: string | null;
  horizontalDelta: number | null;
  verticalDelta: number | null;
  nasalOdMm: number | null;
  nasalOsMm: number | null;
}

/** Lê um CSV da bancada (colunas pelo nome do cabeçalho, ordem indiferente). */
export function lerCsvBancada(texto: string): RegistoV1[] {
  const linhas = texto.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim());
  const cabecalho = linhas.shift()?.split(",").map((c) => c.trim()) ?? [];
  const col = (nome: string) => cabecalho.indexOf(nome);
  const numero = (v: string | undefined) => (v === undefined || v.trim() === "" ? null : Number(v));
  return linhas.map((linha) => {
    const c = linha.split(",");
    const origem = c[col("origem")] ?? "";
    return {
      pessoa: (c[col("pessoa")] ?? "").trim(),
      alvoGraus: Number(c[col("alvo_graus")] ?? 0),
      caminho: origem.startsWith("A") ? "A" : origem.startsWith("B") ? "B" : "ficheiro",
      posicoes: col("posicoes") >= 0 ? (c[col("posicoes")] ?? "").trim() || "toques" : "toques",
      motivo: (c[col("motivo")] ?? "").trim() || null,
      horizontalDelta: numero(c[col("horizontal_delta")]),
      verticalDelta: numero(c[col("vertical_delta")]),
      nasalOdMm: numero(c[col("nasal_od_mm")]),
      nasalOsMm: numero(c[col("nasal_os_mm")]),
    };
  });
}

export interface ResumoOlho {
  calibracao: Calibracao | null;
  passa: boolean;
}

export interface ResumoPessoaV1 {
  pessoa: string;
  fotografias: number;
  medidas: number;
  olhoDireito: ResumoOlho;
  olhoEsquerdo: ResumoOlho;
  /** Mediana do desvio horizontal a 0° (Δ), se houver medições. */
  horizontalEmFrenteDelta: number | null;
  verticalEmFrenteDelta: number | null;
  /** Desvio-padrão do horizontal a 0° entre fotografias (Δ), com 2+ medições. */
  repetibilidadeDelta: number | null;
  emFrentePassa: boolean;
  passaV1: boolean;
}

export interface TaxaSucesso {
  grupo: string;
  fotografias: number;
  medidas: number;
  motivos: Record<string, number>;
}

export interface RelatorioV1 {
  pessoas: ResumoPessoaV1[];
  pessoasQuePassam: number;
  /** Factor de Hirschberg de todos os olhos calibrados (média e desvio-padrão). */
  fatorMedio: number | null;
  fatorDesvioPadrao: number | null;
  /** Repetibilidade agregada: raiz da média das variâncias por pessoa (Δ). */
  repetibilidadeAgregadaDelta: number | null;
  porCaminho: TaxaSucesso[];
  porPosicoes: TaxaSucesso[];
}

const desvioPadrao = (v: number[]) => {
  if (v.length < 2) return null;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1));
};

function taxas(registos: RegistoV1[], chave: (r: RegistoV1) => string): TaxaSucesso[] {
  const grupos = new Map<string, TaxaSucesso>();
  for (const r of registos) {
    const g = chave(r);
    const t = grupos.get(g) ?? { grupo: g, fotografias: 0, medidas: 0, motivos: {} };
    t.fotografias++;
    if (r.motivo) t.motivos[r.motivo] = (t.motivos[r.motivo] ?? 0) + 1;
    else t.medidas++;
    grupos.set(g, t);
  }
  return [...grupos.values()].sort((a, b) => a.grupo.localeCompare(b.grupo));
}

export function relatorioV1(registos: readonly RegistoV1[]): RelatorioV1 {
  const pessoas = [...new Set(registos.map((r) => r.pessoa))].sort();
  const resumos = pessoas.map((pessoa): ResumoPessoaV1 => {
    const dela = registos.filter((r) => r.pessoa === pessoa);
    const medidas = dela.filter((r) => !r.motivo && r.horizontalDelta !== null);
    const olho = (campo: "nasalOdMm" | "nasalOsMm"): ResumoOlho => {
      const c = calibrar(
        medidas.filter((r) => r[campo] !== null).map((r) => ({ anguloGraus: r.alvoGraus, descentracaoMm: r[campo]! })),
      );
      return c.ok === false ? { calibracao: null, passa: false } : { calibracao: c.valor, passa: calibracaoPassaV1(c.valor) };
    };
    const emFrente = medidas.filter((r) => r.alvoGraus === 0);
    const h = emFrente.map((r) => r.horizontalDelta!);
    const v = emFrente.map((r) => r.verticalDelta ?? 0);
    const horizontal = h.length ? mediana(h) : null;
    const olhoDireito = olho("nasalOdMm");
    const olhoEsquerdo = olho("nasalOsMm");
    const emFrentePassa = horizontal !== null && Math.abs(horizontal) < CRITERIOS_V1.desvioMaximoSemEstrabismoDelta;
    return {
      pessoa,
      fotografias: dela.length,
      medidas: medidas.length,
      olhoDireito,
      olhoEsquerdo,
      horizontalEmFrenteDelta: horizontal,
      verticalEmFrenteDelta: v.length ? mediana(v) : null,
      repetibilidadeDelta: desvioPadrao(h),
      emFrentePassa,
      passaV1: olhoDireito.passa && olhoEsquerdo.passa && emFrentePassa,
    };
  });

  const fatores = resumos.flatMap((p) =>
    [p.olhoDireito, p.olhoEsquerdo].flatMap((o) => (o.calibracao ? [o.calibracao.fatorDeltaPorMm] : [])),
  );
  const variancias = resumos.flatMap((p) => (p.repetibilidadeDelta !== null ? [p.repetibilidadeDelta ** 2] : []));
  return {
    pessoas: resumos,
    pessoasQuePassam: resumos.filter((p) => p.passaV1).length,
    fatorMedio: fatores.length ? fatores.reduce((a, b) => a + b, 0) / fatores.length : null,
    fatorDesvioPadrao: desvioPadrao(fatores),
    repetibilidadeAgregadaDelta: variancias.length
      ? Math.sqrt(variancias.reduce((a, b) => a + b, 0) / variancias.length)
      : null,
    porCaminho: taxas([...registos], (r) => r.caminho),
    porPosicoes: taxas([...registos], (r) => r.posicoes),
  };
}

const f = (n: number | null | undefined, casas = 1) => (n == null || !Number.isFinite(n) ? "—" : n.toFixed(casas));

export function relatorioV1EmMarkdown(r: RelatorioV1): string {
  const l: string[] = [];
  l.push("# Fase V1 — resultados da bancada", "");
  l.push(
    `Critérios (escritos antes): factor de Hirschberg ${CRITERIOS_V1.fatorMinimo}–${CRITERIOS_V1.fatorMaximo} Δ/mm em cada olho, ` +
      `R² ≥ ${CRITERIOS_V1.r2Minimo}, e a olhar em frente menos de ${CRITERIOS_V1.desvioMaximoSemEstrabismoDelta} Δ.`,
    "",
  );
  l.push(`**${r.pessoasQuePassam} de ${r.pessoas.length} pessoas passam.**`, "");
  l.push(
    `Factor de Hirschberg (todos os olhos calibrados): ${f(r.fatorMedio)} ± ${f(r.fatorDesvioPadrao)} Δ/mm. ` +
      `Repetibilidade a 0° (desvio-padrão agregado): ${f(r.repetibilidadeAgregadaDelta)} Δ.`,
    "",
  );
  l.push("## Por pessoa", "");
  l.push("| Pessoa | Medidas | OD: factor (R²) | OS: factor (R²) | Em frente H / V (Δ) | Repetibilidade (Δ) | V1 |");
  l.push("|---|---|---|---|---|---|---|");
  const olho = (o: ResumoOlho) =>
    o.calibracao ? `${f(o.calibracao.fatorDeltaPorMm)} (${f(o.calibracao.r2, 3)})${o.passa ? "" : " ✗"}` : "faltam ângulos";
  for (const p of r.pessoas) {
    l.push(
      `| ${p.pessoa} | ${p.medidas}/${p.fotografias} | ${olho(p.olhoDireito)} | ${olho(p.olhoEsquerdo)} | ` +
        `${f(p.horizontalEmFrenteDelta)} / ${f(p.verticalEmFrenteDelta)}${p.emFrentePassa ? "" : " ✗"} | ${f(p.repetibilidadeDelta)} | ${p.passaV1 ? "passa" : "não passa"} |`,
    );
  }
  const tabela = (titulo: string, ts: TaxaSucesso[]) => {
    l.push("", `## ${titulo}`, "", "| Grupo | Medidas | Motivos de falha |", "|---|---|---|");
    for (const t of ts) {
      const motivos = Object.entries(t.motivos).map(([m, n]) => `${m}: ${n}`).join(", ") || "—";
      l.push(`| ${t.grupo} | ${t.medidas}/${t.fotografias} (${f((100 * t.medidas) / t.fotografias, 0)}%) | ${motivos} |`);
    }
  };
  tabela("Por caminho de captura", r.porCaminho);
  tabela("Por origem das posições dos olhos", r.porPosicoes);
  return l.join("\n") + "\n";
}
