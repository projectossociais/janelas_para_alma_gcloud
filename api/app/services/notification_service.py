"""Regras de notificações (ADMIN-04).

Duas mentiras possíveis, ambas recusadas aqui: um admin a pedir um `papel`
que não existe (`enviar`), e um utilizador a tentar marcar como lida uma
notificação que não é dele (`marcar_lida` — nunca confiar no
`notificacao_id` vindo do cliente sem confirmar o dono; devolve o mesmo
erro quer a notificação não exista, quer pertença a outra pessoa, para
nunca revelar por enumeração se um dado id existe)."""

from typing import Protocol

from app.repositories.notification_repository import NotificacaoRegisto


class PapelDeNotificacaoInvalidoError(Exception):
    pass


class NotificacaoNaoEncontradaError(Exception):
    pass


class UtilizadorParaListagem(Protocol):
    id: str
    papel: str


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


class NotificationService:
    def __init__(
        self, notificacoes: NotificationRepositoryProtocol, utilizadores: UtilizadoresParaNotificar
    ) -> None:
        self._notificacoes = notificacoes
        self._utilizadores = utilizadores

    def enviar(self, titulo: str, mensagem: str, papel: str | None) -> int:
        """`papel=None` significa "todos". Devolve quantas notificações
        foram criadas (uma por destinatário — sem tabela de "envio" à
        parte, mesmo desenho denormalizado que a tabela já tinha)."""
        if papel is not None and papel not in PAPEIS_VALIDOS:
            raise PapelDeNotificacaoInvalidoError(papel)

        alvos = self._utilizadores.listar(papel=papel)
        ids = [u.id for u in alvos]
        if not ids:
            return 0
        return self._notificacoes.criar_em_massa(ids, titulo, mensagem)

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
