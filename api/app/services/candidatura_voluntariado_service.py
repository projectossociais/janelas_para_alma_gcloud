"""Regras da candidatura a voluntário.

O que o utilizador podia mentir sobre isto, e é recusado aqui:
- candidatar-se outra vez enquanto já tem uma candidatura pendente ou já é
  voluntário activo → `CandidaturaJaExisteError`;
- um admin decidir uma candidatura que não existe, ou já foi decidida →
  `CandidaturaNaoEncontradaError` / `CandidaturaJaDecididaError`.

O email de decisão (aprovada/rejeitada) é best-effort: uma falha do Resend
não desfaz a aprovação já gravada — ao contrário das doações (`CROSS-09`),
aqui a candidatura em si já é o estado de valor; perder essa gravação por
causa de um envio de email seria pior para quem espera resposta. A falha
fica apenas registada (log), nunca revertida.
"""

import logging
from datetime import UTC, datetime

from app.core.email import EmailEnvioFalhouError, EmailSender
from app.repositories.candidatura_voluntariado_repository import (
    CandidaturaVoluntariadoRegisto,
    CandidaturaVoluntariadoRepository,
)

logger = logging.getLogger(__name__)


class CandidaturaJaExisteError(Exception):
    pass


class CandidaturaNaoEncontradaError(Exception):
    pass


class CandidaturaJaDecididaError(Exception):
    pass


class CandidaturaVoluntariadoService:
    def __init__(self, repositorio: CandidaturaVoluntariadoRepository, email_sender: EmailSender) -> None:
        self._repo = repositorio
        self._email = email_sender

    def candidatar(
        self, utilizador_id: str, motivacao: str, telefone: str | None
    ) -> CandidaturaVoluntariadoRegisto:
        existente = self._repo.obter_por_utilizador(utilizador_id)
        if existente is not None and existente.status in ("pendente", "aprovada"):
            raise CandidaturaJaExisteError(utilizador_id)

        candidatura = self._repo.criar(utilizador_id, motivacao, telefone)

        self._enviar_email_best_effort(
            candidatura.utilizador_email,
            "Candidatura a voluntário recebida — Janelas Para a Alma",
            "<p>Recebemos a sua candidatura para se tornar voluntário Kamba. "
            "Vamos avaliá-la e entraremos em contacto em breve com uma resposta.</p>",
        )
        return candidatura

    def aprovar(self, candidatura_id: str, admin_id: str) -> CandidaturaVoluntariadoRegisto:
        self._obter_pendente(candidatura_id)
        resultado = self._repo.aprovar(candidatura_id, admin_id, datetime.now(UTC))

        self._enviar_email_best_effort(
            resultado.utilizador_email,
            "A sua candidatura foi aprovada — Janelas Para a Alma",
            "<p>Boas notícias! A sua candidatura a voluntário Kamba foi aprovada. "
            "Já pode consultar e inscrever-se nas actividades disponíveis na sua área pessoal.</p>",
        )
        return resultado

    def rejeitar(self, candidatura_id: str, admin_id: str) -> CandidaturaVoluntariadoRegisto:
        self._obter_pendente(candidatura_id)
        resultado = self._repo.rejeitar(candidatura_id, admin_id, datetime.now(UTC))

        self._enviar_email_best_effort(
            resultado.utilizador_email,
            "A sua candidatura — Janelas Para a Alma",
            "<p>Obrigado pelo seu interesse em ser voluntário Kamba. "
            "Neste momento não vamos avançar com a sua candidatura, mas fique atento a futuras oportunidades.</p>",
        )
        return resultado

    def _obter_pendente(self, candidatura_id: str) -> CandidaturaVoluntariadoRegisto:
        candidatura = self._repo.obter(candidatura_id)
        if candidatura is None:
            raise CandidaturaNaoEncontradaError(candidatura_id)
        if candidatura.status != "pendente":
            raise CandidaturaJaDecididaError(candidatura_id)
        return candidatura

    def _enviar_email_best_effort(self, destinatario: str, assunto: str, corpo_html: str) -> None:
        try:
            self._email.enviar(destinatario=destinatario, assunto=assunto, corpo_html=corpo_html)
        except EmailEnvioFalhouError:
            logger.warning("falha ao enviar email de voluntariado para %s", destinatario)
