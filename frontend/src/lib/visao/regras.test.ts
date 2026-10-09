import { ContadorTempoActivo, PAUSA_AUTOMATICA_MS } from "./tempoActivo";
import { diferencaContraste, olhoMaisFracoPelaAcuidade, sinaisAcuidade, sinalEstereopsia } from "./resultados";
import { criarAgendaControlo, eTentativaDeControlo, sinaisDeControlo } from "./treino";
import { minutosPorDia, sequenciaDeDias, ultimosResultados, type SessaoResumo } from "./progresso";

describe("tempo activo", () => {
  it("conta o tempo entre respostas próximas", () => {
    const c = new ContadorTempoActivo();
    c.iniciar(0);
    c.registarResposta(3000);
    c.registarResposta(5000);
    expect(c.segundos).toBe(5);
  });

  it("não conta intervalos maiores do que a pausa automática (8 s)", () => {
    const c = new ContadorTempoActivo();
    c.iniciar(0);
    c.registarResposta(2000);
    c.registarResposta(2000 + PAUSA_AUTOMATICA_MS + 1);
    c.registarResposta(2000 + PAUSA_AUTOMATICA_MS + 1001);
    expect(c.milissegundos).toBe(3000);
    expect(c.emPausa(2000 + PAUSA_AUTOMATICA_MS + 1001 + 8001)).toBe(true);
  });

  it("separador escondido corta o intervalo e ignora respostas", () => {
    const c = new ContadorTempoActivo();
    c.iniciar(0);
    c.registarResposta(1000);
    c.definirVisivel(false, 2000);
    c.registarResposta(3000);
    c.definirVisivel(true, 60_000);
    c.registarResposta(61_000);
    expect(c.milissegundos).toBe(2000);
  });

  it("pausar não conta o tempo da pausa", () => {
    const c = new ContadorTempoActivo();
    c.iniciar(0);
    c.registarResposta(1000);
    c.pausar();
    c.registarResposta(4000);
    c.registarResposta(5000);
    expect(c.milissegundos).toBe(2000);
  });
});

describe("sinais de acuidade", () => {
  it("pior do que 6/9 num olho", () => {
    expect(sinaisAcuidade({ direito: 0.2, esquerdo: 0.1 }).abaixoDe6_9).toEqual(["direito"]);
    expect(sinaisAcuidade({ direito: 0.1, esquerdo: 0.1 }).abaixoDe6_9).toEqual([]);
  });

  it("não ler nem o maior nível também é sinal", () => {
    expect(sinaisAcuidade({ direito: null, esquerdo: 0 }).abaixoDe6_9).toEqual(["direito"]);
  });

  it("diferença de 2 linhas ou mais entre olhos", () => {
    expect(sinaisAcuidade({ direito: 0, esquerdo: 0.2 }).diferencaEntreOlhos).toBe(true);
    expect(sinaisAcuidade({ direito: 0, esquerdo: 0.1 }).diferencaEntreOlhos).toBe(false);
    expect(sinaisAcuidade({ direito: 0 }).diferencaEntreOlhos).toBe(false);
  });

  it("olho mais fraco pela acuidade: o de logMAR mais alto (pior)", () => {
    expect(olhoMaisFracoPelaAcuidade({ direito: 0.1, esquerdo: 0.4 })).toBe("esquerdo");
    expect(olhoMaisFracoPelaAcuidade({ direito: 0.5, esquerdo: 0 })).toBe("direito");
  });

  it("não ler nem o maior tamanho conta como o pior resultado", () => {
    expect(olhoMaisFracoPelaAcuidade({ direito: null, esquerdo: 0.9 })).toBe("direito");
    expect(olhoMaisFracoPelaAcuidade({ direito: 0.2, esquerdo: null })).toBe("esquerdo");
  });

  it("sem diferença (ou sem os dois olhos) não sugere nenhum olho", () => {
    expect(olhoMaisFracoPelaAcuidade({ direito: 0.2, esquerdo: 0.2 })).toBeNull();
    expect(olhoMaisFracoPelaAcuidade({ direito: null, esquerdo: null })).toBeNull();
    expect(olhoMaisFracoPelaAcuidade({ direito: 0.2 })).toBeNull();
    expect(olhoMaisFracoPelaAcuidade({})).toBeNull();
  });

  it("contraste: diferença de 0,3 log entre olhos", () => {
    expect(diferencaContraste({ direito: 1.8, esquerdo: 1.5 })).toBe(true);
    expect(diferencaContraste({ direito: 1.8, esquerdo: 1.65 })).toBe(false);
  });
});

describe("controlo de atenção", () => {
  it("a 10.ª, 20.ª... tentativa é de controlo, nunca a primeira", () => {
    const controlo = Array.from({ length: 30 }, (_, i) => i).filter(eTentativaDeControlo);
    expect(controlo).toEqual([9, 19, 29]);
  });

  it("Perto e longe: o controlo aparece mesmo quando a 10.ª tentativa calha num toque de \"perto\"", () => {
    // Bug real: a vez do controlo (depois de 9, 19, 29 respostas) cai sempre
    // num toque de "perto" (toques ímpares) e o controlo só pode aparecer
    // depois de um "longe" (toques pares) -- sem a agenda, nunca aparecia.
    const agenda = criarAgendaControlo();
    const mostrados: number[] = [];
    for (let n = 1; n <= 30; n++) {
      const tocouLonge = n % 2 === 0;
      if (agenda.aposResposta(n, tocouLonge)) mostrados.push(n);
    }
    expect(mostrados).toEqual([10, 20, 30]);
  });

  it("a agenda mostra logo o controlo quando o momento é permitido", () => {
    const agenda = criarAgendaControlo();
    const mostrados = Array.from({ length: 20 }, (_, i) => i + 1).filter((n) => agenda.aposResposta(n, true));
    expect(mostrados).toEqual([9, 19]);
  });

  it("um controlo errado marca baixa atenção", () => {
    expect(sinaisDeControlo(3, 0).baixa_atencao).toBe(false);
    expect(sinaisDeControlo(3, 1).baixa_atencao).toBe(true);
  });
});

const sessao = (over: Partial<SessaoResumo>): SessaoResumo => ({
  exercicio_id: "ambliopia",
  created_at: new Date(2026, 8, 28, 10).toISOString(),
  segundos_activos: 300,
  olho: "esquerdo",
  limiar: null,
  unidade: null,
  sinais: null,
  ...over,
});

describe("progresso", () => {
  const hoje = new Date(2026, 8, 28, 18);

  it("minutos por dia só contam treinos sem baixa atenção", () => {
    const m = minutosPorDia([
      sessao({}),
      sessao({ sinais: { baixa_atencao: true } }),
      sessao({ exercicio_id: "figure8" }),
    ]);
    expect(m.get("2026-09-28")).toBe(5);
  });

  it("sequência de dias seguidos até hoje", () => {
    const s = [26, 27, 28].map((d) => sessao({ created_at: new Date(2026, 8, d, 9).toISOString() }));
    expect(sequenciaDeDias(s, hoje)).toBe(3);
  });

  it("de manhã, sem treino hoje, a sequência de ontem mantém-se", () => {
    const s = [26, 27].map((d) => sessao({ created_at: new Date(2026, 8, d, 9).toISOString() }));
    expect(sequenciaDeDias(s, hoje)).toBe(2);
  });

  it("um dia falhado quebra a sequência", () => {
    const s = [25, 27, 28].map((d) => sessao({ created_at: new Date(2026, 8, d, 9).toISOString() }));
    expect(sequenciaDeDias(s, hoje)).toBe(2);
  });

  it("último resultado de cada teste por olho", () => {
    const r = ultimosResultados([
      sessao({ exercicio_id: "figure8", limiar: 0.3, created_at: "2026-09-20T10:00:00Z" }),
      sessao({ exercicio_id: "figure8", limiar: 0.2, created_at: "2026-09-27T10:00:00Z" }),
      sessao({ exercicio_id: "ambliopia" }),
    ]);
    expect(r.get("figure8:esquerdo")?.limiar).toBe(0.2);
    expect(r.size).toBe(1);
  });
});

describe("sinal da estereopsia", () => {
  // Caso real (2026-10-08): ver a forma só com a maior diferença (800″) dava
  // "Sem sinais", com o cartão verde.
  it("não ver a forma, ou só com 400″ ou 800″, é sinal", () => {
    expect(sinalEstereopsia(null)).toBe(true);
    expect(sinalEstereopsia(800)).toBe(true);
    expect(sinalEstereopsia(400)).toBe(true);
  });

  it("200″ ou melhor não é sinal", () => {
    expect(sinalEstereopsia(200)).toBe(false);
    expect(sinalEstereopsia(40)).toBe(false);
  });
});

describe("sessoesDoGrafico (gráfico do progresso)", () => {
  const sessao = (over: Record<string, unknown>) => ({
    exercicio_id: "ambliopia",
    created_at: "2026-10-01T10:00:00Z",
    segundos_activos: 120,
    olho: "direito",
    limiar: 0.3,
    unidade: "logmar",
    sinais: null,
    ...over,
  });

  it("deixa de fora baixa atenção, sessões sem limiar, ambos os olhos e outros exercícios, por ordem", async () => {
    const { sessoesDoGrafico } = await import("./progresso");
    const lista = [
      sessao({ created_at: "2026-10-03T10:00:00Z", limiar: 0.2 }),
      sessao({ created_at: "2026-10-02T10:00:00Z", sinais: { baixa_atencao: true } }),
      sessao({ limiar: null }),
      sessao({ olho: "ambos" }),
      sessao({ exercicio_id: "figure8" }),
      sessao({ created_at: "2026-10-01T09:00:00Z", olho: "esquerdo", limiar: 0.4 }),
    ];
    expect(sessoesDoGrafico(lista, "ambliopia").map((s) => s.limiar)).toEqual([0.4, 0.2]);
  });
});
