"""Regras de actividades de voluntariado e das inscrições nelas.

O que o utilizador podia mentir sobre isto, e é recusado aqui — nunca só na
interface:
- inscrever-se sem ser voluntário activo (`voluntario_ativo`, verificado
  sempre a partir da base de dados, nunca de um valor vindo do pedido) →
  `NaoEVoluntarioAtivoError`;
- inscrever-se duas vezes na mesma actividade → `JaInscritoError`;
- inscrever-se além do número de vagas → `SemVagasError`;
- inscrever-se numa actividade cancelada → `AtividadeNaoPublicadaError`;
- cancelar a inscrição de outra pessoa — isto não se impede aqui, o router
  garante que o `utilizador_id` vem sempre do JWT, nunca do corpo do pedido.

Publicar uma actividade nova avisa por email todos os voluntários activos
com `notificacoes_projetos` ligado — a primeira utilização real desse campo
de preferências, que existe desde o registo mas nunca disparou nada. O envio
é best-effort por destinatário: uma falha para um endereço não pode impedir
o admin de publicar a actividade nem bloquear o envio aos restantes.
"""

import logging
from datetime import datetime

from app.core.email import EmailEnvioFalhouError, EmailSender
from app.repositories.atividade_voluntariado_repository import (
    AtividadeVoluntariadoRegisto,
    AtividadeVoluntariadoRepository,
    InscricaoAtividadeRegisto,
)

logger = logging.getLogger(__name__)


class AtividadeNaoEncontradaError(Exception):
    pass


class AtividadeNaoPublicadaError(Exception):
    pass


class NaoEVoluntarioAtivoError(Exception):
    pass


class JaInscritoError(Exception):
    pass


class SemVagasError(Exception):
    pass


class InscricaoNaoEncontradaError(Exception):
    pass


class AtividadeComInscricoesError(Exception):
    """Recusa apagar uma actividade com alguma inscrição, mesmo cancelada --
    é o rasto real de uma pessoa. Arquivar em vez de apagar."""



class AtividadeVoluntariadoService:
    def __init__(self, repositorio: AtividadeVoluntariadoRepository, email_sender: EmailSender) -> None:
        self._repo = repositorio
        self._email = email_sender

    def publicar(
        self,
        admin_id: str,
        titulo: str,
        descricao: str,
        local: str,
        data_inicio: datetime,
        data_fim: datetime | None,
        vagas: int | None,
    ) -> AtividadeVoluntariadoRegisto:
        atividade = self._repo.criar_atividade(
            titulo, descricao, local, data_inicio, data_fim, vagas, admin_id
        )

        for voluntario in self._repo.listar_voluntarios_para_notificar():
            self._enviar_email_best_effort(
                voluntario.email,
                f"Nova actividade de voluntariado: {titulo}",
                f"<p>Foi publicada uma nova actividade — <strong>{titulo}</strong>, em {local}.</p>"
                f"<p>{descricao}</p>"
                "<p>Consulte a sua área de voluntário para se inscrever.</p>",
            )
        return atividade

    def cancelar(self, atividade_id: str) -> AtividadeVoluntariadoRegisto:
        if self._repo.obter_atividade(atividade_id) is None:
            raise AtividadeNaoEncontradaError(atividade_id)
        return self._repo.cancelar_atividade(atividade_id)

    def arquivar(self, atividade_id: str) -> AtividadeVoluntariadoRegisto:
        if self._repo.obter_atividade(atividade_id) is None:
            raise AtividadeNaoEncontradaError(atividade_id)
        return self._repo.arquivar_atividade(atividade_id)

    def apagar(self, atividade_id: str) -> None:
        if self._repo.obter_atividade(atividade_id) is None:
            raise AtividadeNaoEncontradaError(atividade_id)
        if self._repo.tem_alguma_inscricao(atividade_id):
            raise AtividadeComInscricoesError(atividade_id)
        self._repo.apagar_atividade(atividade_id)

    def listar_publicadas(self) -> list[AtividadeVoluntariadoRegisto]:
        return self._repo.listar_publicadas()

    def listar_todas(self) -> list[AtividadeVoluntariadoRegisto]:
        return self._repo.listar_todas()

    def listar_inscritos(self, atividade_id: str) -> list[InscricaoAtividadeRegisto]:
        if self._repo.obter_atividade(atividade_id) is None:
            raise AtividadeNaoEncontradaError(atividade_id)
        return self._repo.listar_inscricoes_por_atividade(atividade_id)

    def inscrever(
        self, atividade_id: str, utilizador_id: str, utilizador_email: str
    ) -> InscricaoAtividadeRegisto:
        atividade = self._repo.obter_atividade(atividade_id)
        if atividade is None:
            raise AtividadeNaoEncontradaError(atividade_id)
        if atividade.estado != "publicada":
            raise AtividadeNaoPublicadaError(atividade_id)
        if not self._repo.utilizador_e_voluntario_ativo(utilizador_id):
            raise NaoEVoluntarioAtivoError(utilizador_id)
        if self._repo.obter_inscricao(atividade_id, utilizador_id) is not None:
            raise JaInscritoError(utilizador_id)
        if atividade.vagas is not None and atividade.inscritos >= atividade.vagas:
            raise SemVagasError(atividade_id)

        inscricao = self._repo.criar_inscricao(atividade_id, utilizador_id)

        self._enviar_email_best_effort(
            utilizador_email,
            f"Inscrição confirmada: {atividade.titulo}",
            f"<p>A sua inscrição na actividade <strong>{atividade.titulo}</strong> "
            f"({atividade.local}) está confirmada. Até lá!</p>",
        )
        return inscricao

    def cancelar_inscricao(self, atividade_id: str, utilizador_id: str) -> InscricaoAtividadeRegisto:
        inscricao = self._repo.obter_inscricao(atividade_id, utilizador_id)
        if inscricao is None:
            raise InscricaoNaoEncontradaError(utilizador_id)
        return self._repo.cancelar_inscricao(inscricao.id)

    def listar_minhas_inscricoes(self, utilizador_id: str) -> list[InscricaoAtividadeRegisto]:
        return self._repo.listar_inscricoes_por_utilizador(utilizador_id)

    def _enviar_email_best_effort(self, destinatario: str, assunto: str, corpo_html: str) -> None:
        try:
            self._email.enviar(destinatario=destinatario, assunto=assunto, corpo_html=corpo_html)
        except EmailEnvioFalhouError:
            logger.warning("falha ao enviar email de voluntariado para %s", destinatario)
