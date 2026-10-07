/**
 * O "próximo passo" do painel (docs/LAYOUTS.md §2.4: o arquétipo App diz logo o
 * que fazer). Uma só regra, por ordem de importância, para a pessoa nunca ter de
 * decidir o que vem a seguir:
 *
 * 1. há uma teleconsulta marcada → entrar na sala;
 * 2. o último rastreio pediu avaliação → marcar consulta;
 * 3. nunca fez um rastreio → fazer o primeiro;
 * 4. o último rastreio não mediu → repetir;
 * 5. tem exercícios abertos → continuar os treinos;
 * 6. pode usar o teste de 7 dias → começá-lo;
 * 7. senão → ver o Premium.
 *
 * Só usa o que a API já devolveu: nunca inventa um estado.
 */
export type ProximoPasso =
  | { tipo: "teleconsulta" }
  | { tipo: "marcar-consulta"; rastreioId: string }
  | { tipo: "primeiro-rastreio" }
  | { tipo: "repetir-rastreio" }
  | { tipo: "treinar" }
  | { tipo: "teste-7-dias" }
  | { tipo: "premium" };

export interface EstadoDoPainel {
  temTeleconsulta: boolean;
  /** O rastreio mais recente (a API devolve do mais novo para o mais antigo). */
  ultimoRastreio: { id: string; diagnostico: string } | null;
  exerciciosDisponiveis: number;
  /** `estado` de `/exercicios/acesso`. */
  estadoAcesso: string;
}

export function proximoPasso(e: EstadoDoPainel): ProximoPasso {
  if (e.temTeleconsulta) return { tipo: "teleconsulta" };
  const u = e.ultimoRastreio;
  if (u?.diagnostico === "requer_avaliacao") return { tipo: "marcar-consulta", rastreioId: u.id };
  if (!u) return { tipo: "primeiro-rastreio" };
  if (u.diagnostico === "inconclusivo") return { tipo: "repetir-rastreio" };
  if (e.exerciciosDisponiveis > 0) return { tipo: "treinar" };
  if (e.estadoAcesso === "trial_disponivel") return { tipo: "teste-7-dias" };
  return { tipo: "premium" };
}
