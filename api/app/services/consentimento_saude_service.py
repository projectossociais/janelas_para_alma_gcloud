"""Consentimento para tratar dados de saúde.

Lei n.º 22/11 (Protecção de Dados Pessoais), art. 13.º e 14.º: dados de saúde
são sensíveis e só se tratam com consentimento inequívoco, expresso e escrito
do titular ou do seu representante legal. Sem jurista no projecto (decisão do
dono, 2026-09-30), a leitura adoptada é:

- o consentimento é **separado** da aceitação dos Termos, com o texto próprio;
- só um **adulto** o dá (contas só para maiores de 18): quem usa o serviço
  para uma criança declara ser o seu representante legal;
- a API **recusa gravar** rastreios e sessões de exercício sem ele, nunca só
  a interface (CLAUDE.md §4.1);
- mudar o texto de forma material obriga a pedir de novo: sobe-se
  `VERSAO_ACTUAL`, e um consentimento de versão anterior deixa de contar.

Nunca sabe o que é HTTP: levanta erros de domínio; o router traduz.
"""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime

from app.repositories.consentimento_saude_repository import (
    ConsentimentoRegisto,
    ConsentimentoSaudeRepository,
)

# Data da versão do texto de consentimento (PoliticaPrivacidade, secção de
# dados de saúde). Subir só quando o texto mudar de forma material.
VERSAO_ACTUAL = "2026-09-30"


class DeclaracaoEmFaltaError(Exception):
    """Faltou declarar a maioridade ou aceitar o tratamento."""


class ConsentimentoEmFaltaError(Exception):
    """Não há consentimento válido (nunca dado, retirado ou de versão antiga)."""


@dataclass(frozen=True)
class EstadoConsentimento:
    consentido: bool
    versao_actual: str
    versao_aceite: str | None
    aceite_em: datetime | None
    representa_menor: bool


class ConsentimentoSaudeService:
    def __init__(
        self,
        repo: ConsentimentoSaudeRepository,
        agora: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._repo = repo
        self._agora = agora

    def _valido(self, c: ConsentimentoRegisto | None) -> bool:
        return c is not None and c.revogado_em is None and c.versao == VERSAO_ACTUAL and c.declara_maioridade

    def estado(self, utilizador_id: str) -> EstadoConsentimento:
        c = self._repo.obter_activo(utilizador_id)
        return EstadoConsentimento(
            consentido=self._valido(c),
            versao_actual=VERSAO_ACTUAL,
            versao_aceite=c.versao if c else None,
            aceite_em=c.aceite_em if c else None,
            representa_menor=c.representa_menor if c else False,
        )

    def registar(
        self, utilizador_id: str, declara_maioridade: bool, aceita_tratamento: bool, representa_menor: bool
    ) -> EstadoConsentimento:
        """Regista a aceitação da versão actual. Idempotente: se já há um
        consentimento válido, não cria outra linha."""
        if not declara_maioridade or not aceita_tratamento:
            raise DeclaracaoEmFaltaError()
        if not self._valido(self._repo.obter_activo(utilizador_id)):
            # Um consentimento activo de versão antiga fica substituído: revoga-se
            # para haver sempre no máximo um activo.
            self._repo.revogar_activos(utilizador_id, self._agora())
            self._repo.criar(
                utilizador_id=utilizador_id,
                versao=VERSAO_ACTUAL,
                declara_maioridade=True,
                representa_menor=representa_menor,
            )
        return self.estado(utilizador_id)

    def retirar(self, utilizador_id: str) -> EstadoConsentimento:
        """Direito de retirar o consentimento. Os dados já gravados ficam (a
        eliminação é pedida à parte, com a eliminação da conta); a partir daqui
        nada de novo se grava."""
        self._repo.revogar_activos(utilizador_id, self._agora())
        return self.estado(utilizador_id)

    def exigir(self, utilizador_id: str) -> None:
        if not self._valido(self._repo.obter_activo(utilizador_id)):
            raise ConsentimentoEmFaltaError()
