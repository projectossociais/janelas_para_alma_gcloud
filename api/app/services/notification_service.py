"""Regras de notificações (ADMIN-04).

Duas mentiras possíveis, ambas recusadas aqui: um admin a pedir um `papel`
que não existe (`enviar`), e um utilizador a tentar marcar como lida uma
notificação que não é dele (`marcar_lida` — nunca confiar no
`notificacao_id` vindo do cliente sem confirmar o dono; devolve o mesmo
erro quer a notificação não exista, quer pertença a outra pessoa, para
nunca revelar por enumeração se um dado id existe)."""

from dataclasses import dataclass
from typing import Protocol

from app.core.email import EmailEnvioFalhouError, EmailSender
from app.repositories.notification_repository import NotificacaoRegisto


class PapelDeNotificacaoInvalidoError(Exception):
    pass


class NotificacaoNaoEncontradaError(Exception):
    pass


class UtilizadorParaListagem(Protocol):
    id: str
    papel: str
    email: str


class UtilizadoresParaNotificar(Protocol):
    def listar(self, papel: str | None = None) -> list[UtilizadorParaListagem]: ...


class NotificationRepositoryProtocol(Protocol):
    def criar_em_massa(self, utilizador_ids: list[str], titulo: str, mensagem: str) -> int: ...
    def listar_do_utilizador(self, utilizador_id: str, limite: int = 50) -> list[NotificacaoRegisto]: ...
    def contar_nao_lidas(self, utilizador_id: str) -> int: ...
    def obter_por_id(self, notificacao_id: str) -> NotificacaoRegisto | None: ...
    def marcar_lida(self, notificacao_id: str) -> NotificacaoRegisto | None: ...
    def marcar_todas_lidas(self, utilizador_id: str) -> None: ...


PAPEIS_VALIDOS = {"admin", "comum", "estrabico", "profissional", "oftalmologista", "voluntario"}


@dataclass(frozen=True)
class ResultadoEnvio:
    notificacoes_criadas: int
    # Só preenchidos quando `enviar_email=True` foi pedido -- ambos ficam a
    # 0 quando não foi (nunca None, para o schema de resposta não ter de
    # distinguir "não pedido" de "pedido mas ninguém tinha email").
    emails_enviados: int = 0
    emails_falharam: int = 0


class NotificationService:
    def __init__(
        self,
        notificacoes: NotificationRepositoryProtocol,
        utilizadores: UtilizadoresParaNotificar,
        email_sender: EmailSender,
    ) -> None:
        self._notificacoes = notificacoes
        self._utilizadores = utilizadores
        self._email_sender = email_sender

    def enviar(self, titulo: str, mensagem: str, papel: str | None, enviar_email: bool = False) -> ResultadoEnvio:
        """`papel=None` significa "todos". A notificação dentro da app
        nunca depende do email: mesmo que o Resend esteja em baixo, ou um
        destinatário tenha um email inválido, a notificação já foi
        gravada -- um envio de email a falhar entra na contagem de
        falhas, nunca impede os restantes nem apaga o que já foi criado."""
        if papel is not None and papel not in PAPEIS_VALIDOS:
            raise PapelDeNotificacaoInvalidoError(papel)

        alvos = self._utilizadores.listar(papel=papel)
        if not alvos:
            return ResultadoEnvio(notificacoes_criadas=0)

        criadas = self._notificacoes.criar_em_massa([u.id for u in alvos], titulo, mensagem)

        if not enviar_email:
            return ResultadoEnvio(notificacoes_criadas=criadas)

        enviados = 0
        falharam = 0
        corpo_html = f"<p><strong>{titulo}</strong></p><p>{mensagem}</p>"
        for alvo in alvos:
            try:
                self._email_sender.enviar(alvo.email, titulo, corpo_html)
                enviados += 1
            except EmailEnvioFalhouError:
                falharam += 1
        return ResultadoEnvio(notificacoes_criadas=criadas, emails_enviados=enviados, emails_falharam=falharam)

    def listar_minhas(self, utilizador_id: str) -> list[NotificacaoRegisto]:
        return self._notificacoes.listar_do_utilizador(utilizador_id)

    def contar_nao_lidas(self, utilizador_id: str) -> int:
        return self._notificacoes.contar_nao_lidas(utilizador_id)

    def marcar_lida(self, notificacao_id: str, utilizador_id: str) -> NotificacaoRegisto:
        atual = self._notificacoes.obter_por_id(notificacao_id)
        if atual is None or atual.user_id != utilizador_id:
            raise NotificacaoNaoEncontradaError(notificacao_id)
        resultado = self._notificacoes.marcar_lida(notificacao_id)
        assert resultado is not None  # já confirmámos que existe acima
        return resultado

    def marcar_todas_lidas(self, utilizador_id: str) -> None:
        self._notificacoes.marcar_todas_lidas(utilizador_id)
