/**
 * Resumo clínico do relatório para o oftalmologista -- último passo da Vaga 1
 * do Programa Olhos Juntos. Junta numa página o que as outras peças medem,
 * nas unidades do consultório: acuidade com aglomeração por olho e diferença
 * em linhas (Olhos de Palanca), sensibilidade ao contraste, estereoacuidade,
 * amplitudes de vergência em Δ (Pontes de Fusão), o contraste do olho forte
 * que o olho fraco aguenta (Kianda) e a adesão ao treino.
 *
 * Para cada medida: o resultado mais recente, o primeiro do período e as
 * condições da medição mais recente (distância medida ou só indicada, ecrã
 * calibrado, óculos verificados). Sem interpretação -- os números e como
 * foram obtidos. As sessões de baixa atenção ficam de fora, como na
 * tendência; os relatos de visão dupla nunca ficam.
 *
 * Funções puras -- o texto vive em `components/visao/ResumoClinico.tsx`.
 */
import { diferencaEmLinhas, eAglomerada, mesmoTipoDaUltima } from "./aglomeracao";
import { ID_ACUIDADE, ID_ANEIS, ID_ASTIGMATISMO, ID_CONTRASTE, ID_CONVERGENCIA, ID_ESTEREOPSIA } from "./ids";
import { SENTIDOS, eResumoSentido, type ResumoSentido, type Sentido } from "./pontes";
import { IDS_TREINOS, diaLocal, minutosPorDia, ultimosDias, type SessaoParaRelatorio } from "./progresso";
import { OLHOS, type Olho } from "./resultados";

/** Igual à janela do link do médico (API: `JANELA_SESSOES_DIAS`). */
export const DIAS_RESUMO_CLINICO = 90;
/** Semanas de treino mostradas na adesão. */
export const SEMANAS_ADESAO = 4;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Como foi feita a medição mais recente de uma medida. */
export interface Condicoes {
  /** Distância olhos-ecrã da sessão, em mm (`null` se a sessão não a tiver). */
  distanciaMm: number | null;
  /** Medida pelo ponto cego (Régua Invisível), e não só indicada. */
  distanciaMedida: boolean;
  calibrado: boolean | null;
  /** Só nos exercícios com óculos vermelho-ciano; `null` nos outros. */
  oculosVerificados: boolean | null;
  oculosAfinados: boolean | null;
  /** Dias diferentes com esta medida no período. */
  dias: number;
}

export interface Medicao<V> {
  data: string;
  valor: V;
}

export interface Resumo<V> {
  recente: Medicao<V>;
  /** `null` quando só houve uma medição (a primeira é a mais recente). */
  primeira: Medicao<V> | null;
  condicoes: Condicoes;
}

/** Valor por olho. Na acuidade, `null` = não leu nem o maior tamanho. */
export type PorOlho<V> = Partial<Record<Olho, V>>;

export interface ResumoAcuidade extends Resumo<PorOlho<number | null>> {
  /** Com barras de Flom (Olhos de Palanca) ou anel isolado (sessões antigas). */
  aglomeracao: boolean;
  /** Entre os dois olhos no resultado mais recente; `null` sem os dois. */
  diferencaLinhas: number | null;
}

export interface ValorKianda {
  /** Contraste do olho forte em que uma ronda correu bem (0-1); `null` sem nenhuma. */
  sustentado: number | null;
  /** Diferença de orientação distinguida no fim da sessão, em graus. */
  orientacao: number | null;
}

export interface ResumoKianda extends Resumo<ValorKianda> {
  olhoFraco: Olho | null;
}

export interface ResumoVergencia {
  sentidos: Partial<Record<Sentido, { recente: Medicao<ResumoSentido>; primeira: Medicao<ResumoSentido> | null }>>;
  condicoes: Condicoes;
}

export interface Adesao {
  /**
   * Minutos efectivos de treino por semana, da mais antiga para a mais
   * recente, a uma casa decimal (uma sessão de segundos não pode dar 0).
   */
  minutosPorSemana: number[];
  diasComTreino: number;
  /** Sessões de treino de baixa atenção (não contam para os minutos). */
  sessoesBaixaAtencao: number;
}

export interface ResumoClinico {
  acuidade: ResumoAcuidade | null;
  contraste: Resumo<PorOlho<number>> | null;
  astigmatismo: Resumo<PorOlho<boolean>> | null;
  /** Segundos de arco; `null` = não identificou a forma. */
  estereopsia: Resumo<number | null> | null;
  vergencia: ResumoVergencia | null;
  kianda: ResumoKianda | null;
  adesao: Adesao;
  /** Datas das sessões em que a pessoa disse ver a dobrar, da mais antiga para a mais recente. */
  diplopia: string[];
}

type S = SessaoParaRelatorio;

const porData = (a: S, b: S) => a.created_at.localeCompare(b.created_at);
const fiavel = (s: S) => s.sinais?.baixa_atencao !== true;
const diasDistintos = (ss: readonly S[]) => new Set(ss.map((s) => diaLocal(new Date(s.created_at)))).size;
const booleano = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
const numero = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function condicoes(s: S, dias: number): Condicoes {
  return {
    distanciaMm: numero(s.distancia_mm),
    distanciaMedida: s.sinais?.distancia_medida === true,
    calibrado: s.calibrado,
    oculosVerificados: booleano(s.sinais?.oculos_verificados),
    oculosAfinados: booleano(s.sinais?.oculos_afinados),
    dias,
  };
}

/**
 * Uma medida de um só valor por sessão (`ler` devolve `undefined` quando a
 * sessão não a mediu). Sessões já filtradas e por ordem.
 */
function resumir<V>(sessoes: readonly S[], ler: (s: S) => V | undefined): Resumo<V> | null {
  const com = sessoes.filter((s) => ler(s) !== undefined);
  if (!com.length) return null;
  const primeira = com[0];
  const recente = com[com.length - 1];
  return {
    recente: { data: recente.created_at, valor: ler(recente) as V },
    primeira: com.length > 1 ? { data: primeira.created_at, valor: ler(primeira) as V } : null,
    condicoes: condicoes(recente, diasDistintos(com)),
  };
}

/**
 * Uma medida por olho: o mais recente e o primeiro de cada olho. Os testes
 * gravam uma sessão por olho no mesmo momento; a data é a do olho mais
 * recente (ou mais antigo, na primeira).
 */
function resumirPorOlho<V>(sessoes: readonly S[], ler: (s: S) => V | undefined): Resumo<PorOlho<V>> | null {
  const com = sessoes.filter((s) => ler(s) !== undefined && (s.olho === "direito" || s.olho === "esquerdo"));
  if (!com.length) return null;
  const recente: PorOlho<V> = {};
  const primeira: PorOlho<V> = {};
  let maisRecente = com[0];
  let maisAntiga = com[com.length - 1];
  let repetiu = false;
  for (const olho of OLHOS) {
    const doOlho = com.filter((s) => s.olho === olho);
    if (!doOlho.length) continue;
    const ultima = doOlho[doOlho.length - 1];
    recente[olho] = ler(ultima) as V;
    primeira[olho] = ler(doOlho[0]) as V;
    if (doOlho.length > 1) repetiu = true;
    if (ultima.created_at > maisRecente.created_at) maisRecente = ultima;
    if (doOlho[0].created_at < maisAntiga.created_at) maisAntiga = doOlho[0];
  }
  return {
    recente: { data: maisRecente.created_at, valor: recente },
    primeira: repetiu ? { data: maisAntiga.created_at, valor: primeira } : null,
    condicoes: condicoes(maisRecente, diasDistintos(com)),
  };
}

const lerAcuidade = (s: S): number | null | undefined =>
  s.unidade !== "logmar" ? undefined : numero(s.limiar) ?? (s.sinais?.nao_leu_o_maior === true ? null : undefined);

function resumoAcuidade(sessoes: readonly S[]): ResumoAcuidade | null {
  // Com e sem barras não se comparam: fica o tipo da sessão mais recente.
  const doMesmoTipo = mesmoTipoDaUltima(sessoes.filter((s) => s.exercicio_id === ID_ACUIDADE && lerAcuidade(s) !== undefined));
  const r = resumirPorOlho(doMesmoTipo, lerAcuidade);
  if (!r) return null;
  const { direito, esquerdo } = r.recente.valor;
  return {
    ...r,
    aglomeracao: eAglomerada(doMesmoTipo[doMesmoTipo.length - 1]),
    diferencaLinhas:
      typeof direito === "number" && typeof esquerdo === "number" ? diferencaEmLinhas(direito, esquerdo) : null,
  };
}

const lerSentido = (s: S, sentido: Sentido): ResumoSentido | undefined => {
  const p = s.sinais?.pontes as Partial<Record<Sentido, unknown>> | undefined;
  const r = p?.[sentido];
  return eResumoSentido(r) && r.rampas > 0 ? r : undefined;
};

function resumoVergencia(sessoes: readonly S[]): ResumoVergencia | null {
  const pontes = sessoes.filter((s) => s.exercicio_id === ID_CONVERGENCIA && s.unidade === "dioptrias_prismaticas");
  const sentidos: ResumoVergencia["sentidos"] = {};
  let maisRecente: S | null = null;
  const medidas: S[] = [];
  for (const sentido of SENTIDOS) {
    const r = resumir(pontes, (s) => lerSentido(s, sentido));
    if (!r) continue;
    sentidos[sentido] = { recente: r.recente, primeira: r.primeira };
    for (const s of pontes) if (lerSentido(s, sentido)) medidas.push(s);
  }
  for (const s of medidas) if (!maisRecente || s.created_at > maisRecente.created_at) maisRecente = s;
  return maisRecente ? { sentidos, condicoes: condicoes(maisRecente, diasDistintos(medidas)) } : null;
}

const eOlho = (v: unknown): v is Olho => v === "direito" || v === "esquerdo";

function resumoKianda(sessoes: readonly S[]): ResumoKianda | null {
  const dicopticas = sessoes.filter(
    (s) => s.exercicio_id === ID_ANEIS && s.unidade === "razao_contraste" && s.sinais?.modo === "dicoptico",
  );
  const r = resumir<ValorKianda>(dicopticas, (s) => ({
    sustentado: numero(s.limiar),
    orientacao: numero(s.sinais?.orientacao_graus),
  }));
  if (!r) return null;
  const olho = dicopticas[dicopticas.length - 1].sinais?.olho_fraco;
  return { ...r, olhoFraco: eOlho(olho) ? olho : null };
}

function adesao(sessoes: readonly S[], hoje: Date): Adesao {
  const dias = ultimosDias(hoje, SEMANAS_ADESAO * 7);
  const doPeriodo = new Set(dias);
  const noPeriodo = sessoes.filter((s) => doPeriodo.has(diaLocal(new Date(s.created_at))));
  const minutos = minutosPorDia(noPeriodo);
  return {
    minutosPorSemana: Array.from({ length: SEMANAS_ADESAO }, (_, i) =>
      Math.round(dias.slice(i * 7, i * 7 + 7).reduce((soma, d) => soma + (minutos.get(d) ?? 0), 0) * 10) / 10,
    ),
    diasComTreino: dias.filter((d) => (minutos.get(d) ?? 0) > 0).length,
    sessoesBaixaAtencao: noPeriodo.filter((s) => IDS_TREINOS.includes(s.exercicio_id) && !fiavel(s)).length,
  };
}

export function resumoClinico(sessoes: readonly S[], hoje: Date): ResumoClinico {
  const desde = hoje.getTime() - DIAS_RESUMO_CLINICO * MS_POR_DIA;
  const doPeriodo = sessoes.filter((s) => new Date(s.created_at).getTime() >= desde).sort(porData);
  const fiaveis = doPeriodo.filter(fiavel);
  const de = (id: string) => fiaveis.filter((s) => s.exercicio_id === id);

  return {
    acuidade: resumoAcuidade(fiaveis),
    contraste: resumirPorOlho(de(ID_CONTRASTE), (s) => (s.unidade === "log_cs" ? numero(s.limiar) ?? undefined : undefined)),
    astigmatismo: resumirPorOlho(de(ID_ASTIGMATISMO), (s) => booleano(s.sinais?.astigmatismo) ?? undefined),
    estereopsia: resumir(de(ID_ESTEREOPSIA), (s) => (s.unidade === "arcsec" ? numero(s.limiar) : undefined)),
    vergencia: resumoVergencia(fiaveis),
    kianda: resumoKianda(fiaveis),
    adesao: adesao(sessoes, hoje),
    diplopia: doPeriodo.filter((s) => s.sinais?.diplopia_reportada === true).map((s) => s.created_at),
  };
}

/** Há alguma medida para mostrar (fora a adesão)? */
export const temMedicoes = (r: ResumoClinico): boolean =>
  !!(r.acuidade || r.contraste || r.astigmatismo || r.estereopsia || r.vergencia || r.kianda);
