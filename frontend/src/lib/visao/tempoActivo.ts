/**
 * Tempo activo de um exercício: só conta o tempo entre respostas próximas
 * (até `PAUSA_AUTOMATICA_MS`) com o separador visível. Deixar o telemóvel
 * pousado ou mudar de separador não soma minutos à "dose" do dia.
 *
 * O relógio é injectado (`agora` em ms) para ser testável sem timers.
 */

/** Sem resposta há mais do que isto -> pausa automática. */
export const PAUSA_AUTOMATICA_MS = 8000;

export class ContadorTempoActivo {
  private msActivos = 0;
  private ultimaActividade: number | null = null;
  private visivel = true;

  /** Início (ou retoma): conta a partir deste instante. */
  iniciar(agora: number): void {
    this.ultimaActividade = this.visivel ? agora : null;
  }

  /** Uma resposta do utilizador (toque, tecla). */
  registarResposta(agora: number): void {
    if (!this.visivel) return;
    if (this.ultimaActividade !== null) {
      const intervalo = agora - this.ultimaActividade;
      if (intervalo > 0 && intervalo <= PAUSA_AUTOMATICA_MS) this.msActivos += intervalo;
    }
    this.ultimaActividade = agora;
  }

  /** `document.visibilitychange`: esconder corta o intervalo em curso. */
  definirVisivel(visivel: boolean, agora: number): void {
    this.visivel = visivel;
    this.ultimaActividade = visivel ? agora : null;
  }

  /** Pausa (ecrã de pausa entre blocos, ou sair). */
  pausar(): void {
    this.ultimaActividade = null;
  }

  /** Há mais de 8 s sem resposta (ou separador escondido)? */
  emPausa(agora: number): boolean {
    return (
      !this.visivel || this.ultimaActividade === null || agora - this.ultimaActividade > PAUSA_AUTOMATICA_MS
    );
  }

  get segundos(): number {
    return Math.floor(this.msActivos / 1000);
  }

  /** Só para testes e para somar blocos. */
  get milissegundos(): number {
    return this.msActivos;
  }
}
