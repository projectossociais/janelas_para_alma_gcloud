/**
 * Sessão rápida dos treinos: da segunda vez em diante, o utilizador não
 * repete os 5-6 ecrãs de preparação (brilho, cartão, óculos, tapa-olho,
 * distância) -- vê um só ecrã com as escolhas da última vez e começa.
 *
 * As escolhas ficam por aparelho (localStorage): a distância e o ecrã são do
 * aparelho, não da conta. Sem armazenamento (modo privado), cai no fluxo
 * completo, que funciona sempre.
 */
import type { Calibracao } from "@/lib/visao/calibracao";
import type { Olho } from "@/lib/visao/resultados";

export interface EscolhasTreino {
  distanciaMm: number;
  usaCorreccao: boolean;
  /** Olho treinado da última vez; `null` nos treinos com os dois olhos. */
  olho: Olho | null;
}

const chave = (exercicioId: string) => `jpa.visao.escolhas.${exercicioId}`;

const valido = (e: Partial<EscolhasTreino> | null): e is EscolhasTreino =>
  !!e &&
  typeof e.distanciaMm === "number" &&
  Number.isFinite(e.distanciaMm) &&
  e.distanciaMm > 0 &&
  typeof e.usaCorreccao === "boolean" &&
  (e.olho === null || e.olho === "direito" || e.olho === "esquerdo");

export function lerEscolhas(exercicioId: string): EscolhasTreino | null {
  try {
    const bruto = window.localStorage.getItem(chave(exercicioId));
    if (!bruto) return null;
    const dados = JSON.parse(bruto) as Partial<EscolhasTreino>;
    return valido(dados) ? dados : null;
  } catch {
    return null;
  }
}

export function guardarEscolhas(exercicioId: string, e: EscolhasTreino): void {
  try {
    window.localStorage.setItem(chave(exercicioId), JSON.stringify(e));
  } catch {
    // armazenamento bloqueado: da próxima vez faz o fluxo completo
  }
}

/**
 * A sessão rápida só se oferece quando nada relevante mudou: há escolhas
 * guardadas, o ecrã já passou pelo passo do cartão neste aparelho, e (nos
 * treinos com um olho) o olho mais fraco é o mesmo da última vez.
 */
export function podeUsarSessaoRapida({
  escolhas,
  calibracao,
  monocular,
  olhoActual,
}: {
  escolhas: EscolhasTreino | null;
  calibracao: Calibracao | null;
  monocular: boolean;
  olhoActual: Olho | null;
}): boolean {
  if (!escolhas || !calibracao) return false;
  if (monocular) return olhoActual !== null && escolhas.olho === olhoActual;
  return true;
}
