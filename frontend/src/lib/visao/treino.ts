/**
 * Regras comuns aos 4 treinos: blocos de 2 minutos com pausa, estímulo de
 * controlo a cada ~10 tentativas e marca de baixa atenção.
 */

/** Duração de um bloco de treino (tempo activo). */
export const BLOCO_SEGUNDOS = 120;
/** Pausa curta entre blocos (respiração guiada). */
export const PAUSA_SEGUNDOS = 20;
/** Blocos por sessão. */
export const BLOCOS_POR_SESSAO = 3;
/** Um estímulo de controlo, muito fácil, a cada tantas tentativas. */
export const INTERVALO_CONTROLO = 10;

/**
 * A tentativa `n` (0-based) é de controlo? A 10.ª, 20.ª, 30.ª... -- nunca a
 * primeira, para não começar por uma "pergunta-armadilha".
 */
export const eTentativaDeControlo = (n: number): boolean => n > 0 && (n + 1) % INTERVALO_CONTROLO === 0;

/**
 * Agenda do estímulo de controlo para tarefas em que ele só pode aparecer em
 * certos momentos (ex.: Perto e longe, só no lugar de uma fase "perto"). A vez
 * do controlo fica pendente até haver um momento em que possa aparecer --
 * sem isto, se a 10.ª tentativa calhasse sempre num momento proibido, o
 * controlo nunca aparecia (bug real, 2026-09-28).
 */
export function criarAgendaControlo() {
  let pendente = false;
  return {
    /**
     * Depois de registar `n` tentativas (a mesma regra de `proximaEControlo`:
     * o próximo estímulo é de controlo quando `eTentativaDeControlo(n)`);
     * devolve se o controlo aparece agora.
     */
    aposResposta(n: number, podeMostrarAgora: boolean): boolean {
      if (eTentativaDeControlo(n)) pendente = true;
      if (pendente && podeMostrarAgora) {
        pendente = false;
        return true;
      }
      return false;
    },
  };
}

export interface SinaisTreino {
  /** Errou pelo menos um estímulo de controlo: não conta para a dose. */
  baixa_atencao: boolean;
  controlos: number;
  controlos_errados: number;
}

export function sinaisDeControlo(controlos: number, controlosErrados: number): SinaisTreino {
  return { baixa_atencao: controlosErrados > 0, controlos, controlos_errados: controlosErrados };
}

/** Margem acima do limiar de acuidade do olho para o treino de anéis. */
export const MARGEM_ANEIS_LOGMAR = 0.1;
/** Margem acima do limiar de acuidade do olho para o tamanho do treino de contraste. */
export const MARGEM_CONTRASTE_LOGMAR = 0.3;
/** Tamanho fixo do anel no teste de contraste (bem acima do limiar). */
export const LOGMAR_TESTE_CONTRASTE = 0.5;
