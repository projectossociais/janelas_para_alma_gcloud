"""Testes do `NotificationService` — as duas mentiras possíveis: pedir um
`papel` que não existe, e marcar como lida uma notificação de outra
pessoa."""

from dataclasses import dataclass
from datetime import UTC, datetime

import pytest

from app.repositories.notification_repository import NotificacaoRegisto
from app.services.notification_service import (
    NotificacaoNaoEncontradaError,
    NotificationService,
    PapelDeNotificacaoInvalidoError,
)


@dataclass(frozen=True)
class UtilizadorFalso:
    id: str
    papel: str


class UtilizadoresFalso:
    def __init__(self, utilizadores: list[UtilizadorFalso]) -> None:
        self._utilizadores = utilizadores

    def listar(self, papel: str | None = None) -> list[UtilizadorFalso]:
        if papel is None:
            return list(self._utilizadores)
        return [u for u in self._utilizadores if u.papel == papel]


class RepositorioNotificacoesFalso:
    def __init__(self) -> None:
        self._registos: dict[str, NotificacaoRegisto] = {}
        self._proximo = 1

    def criar_em_massa(self, utilizador_ids: list[str], titulo: str, mensagem: str) -> int:
        for uid in utilizador_ids:
            registo = NotificacaoRegisto(
                id=f"notif-{self._proximo}",
                user_id=uid,
                titulo=titulo,
                mensagem=mensagem,
                lida=False,
                created_at=datetime.now(UTC),
            )
            self._proximo += 1
            self._registos[registo.id] = registo
        return len(utilizador_ids)

    def listar_do_utilizador(self, utilizador_id: str, limite: int = 50) -> list[NotificacaoRegisto]:
        return [r for r in self._registos.values() if r.user_id == utilizador_id][:limite]

    def contar_nao_lidas(self, utilizador_id: str) -> int:
        return len([r for r in self._registos.values() if r.user_id == utilizador_id and not r.lida])

    def obter_por_id(self, notificacao_id: str) -> NotificacaoRegisto | None:
        return self._registos.get(notificacao_id)

    def marcar_lida(self, notificacao_id: str) -> NotificacaoRegisto | None:
        atual = self._registos.get(notificacao_id)
        if atual is None:
            return None
        novo = NotificacaoRegisto(**{**atual.__dict__, "lida": True})
        self._registos[notificacao_id] = novo
        return novo

    def marcar_todas_lidas(self, utilizador_id: str) -> None:
        for notif_id, atual in list(self._registos.items()):
            if atual.user_id == utilizador_id and not atual.lida:
                self._registos[notif_id] = NotificacaoRegisto(**{**atual.__dict__, "lida": True})


@pytest.fixture
def utilizadores() -> UtilizadoresFalso:
    return UtilizadoresFalso(
        [
            UtilizadorFalso(id="u-1", papel="comum"),
            UtilizadorFalso(id="u-2", papel="comum"),
            UtilizadorFalso(id="u-3", papel="estrabico"),
        ]
    )


@pytest.fixture
def servico(utilizadores) -> tuple[NotificationService, RepositorioNotificacoesFalso]:
    repo = RepositorioNotificacoesFalso()
    return NotificationService(repo, utilizadores), repo


class TestEnviar:
    def test_envia_a_todos_quando_papel_e_none(self, servico) -> None:
        svc, repo = servico
        enviadas = svc.enviar("Aviso", "Texto", None)
        assert enviadas == 3
        assert repo.contar_nao_lidas("u-1") == 1
        assert repo.contar_nao_lidas("u-3") == 1

    def test_envia_so_ao_papel_pedido(self, servico) -> None:
        svc, repo = servico
        enviadas = svc.enviar("Aviso", "Texto", "estrabico")
        assert enviadas == 1
        assert repo.contar_nao_lidas("u-3") == 1
        assert repo.contar_nao_lidas("u-1") == 0

    def test_recusa_papel_invalido(self, servico) -> None:
        svc, repo = servico
        with pytest.raises(PapelDeNotificacaoInvalidoError):
            svc.enviar("Aviso", "Texto", "super-admin-hacker")
        assert repo.contar_nao_lidas("u-1") == 0

    def test_sem_destinatarios_devolve_zero(self, servico) -> None:
        svc, _ = servico
        assert svc.enviar("Aviso", "Texto", "voluntario") == 0


class TestListarEContar:
    def test_lista_so_as_do_proprio_utilizador(self, servico) -> None:
        svc, _ = servico
        svc.enviar("A", "1", "comum")
        svc.enviar("B", "2", "estrabico")
        assert [n.titulo for n in svc.listar_minhas("u-1")] == ["A"]
        assert [n.titulo for n in svc.listar_minhas("u-3")] == ["B"]

    def test_contar_nao_lidas(self, servico) -> None:
        svc, _ = servico
        svc.enviar("A", "1", None)
        assert svc.contar_nao_lidas("u-1") == 1


class TestMarcarLida:
    def test_marca_lida_a_propria(self, servico) -> None:
        svc, _ = servico
        svc.enviar("A", "1", "comum")
        notif = svc.listar_minhas("u-1")[0]

        resultado = svc.marcar_lida(notif.id, "u-1")

        assert resultado.lida is True
        assert svc.contar_nao_lidas("u-1") == 0

    def test_recusa_marcar_notificacao_de_outro_utilizador(self, servico) -> None:
        svc, _ = servico
        svc.enviar("A", "1", "comum")
        notif = svc.listar_minhas("u-1")[0]

        with pytest.raises(NotificacaoNaoEncontradaError):
            svc.marcar_lida(notif.id, "u-2")
        assert svc.contar_nao_lidas("u-1") == 1  # nunca marcada

    def test_recusa_id_inexistente(self, servico) -> None:
        svc, _ = servico
        with pytest.raises(NotificacaoNaoEncontradaError):
            svc.marcar_lida("nao-existe", "u-1")


class TestMarcarTodasLidas:
    def test_marca_todas_as_do_utilizador(self, servico) -> None:
        svc, _ = servico
        svc.enviar("A", "1", None)
        svc.enviar("B", "2", None)

        svc.marcar_todas_lidas("u-1")

        assert svc.contar_nao_lidas("u-1") == 0
        assert svc.contar_nao_lidas("u-2") == 2  # outros utilizadores nunca afectados
