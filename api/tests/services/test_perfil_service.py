from datetime import UTC, date, datetime

import pytest

from app.repositories.perfil_repository import PerfilPatch, PerfilRegisto
from app.services.perfil_service import PerfilNaoEncontradoError, PerfilService


class RepositorioPerfilFalso:
    def __init__(self, perfis: dict[str, PerfilRegisto] | None = None) -> None:
        self._perfis = perfis or {}

    def obter(self, utilizador_id: str) -> PerfilRegisto | None:
        return self._perfis.get(utilizador_id)

    def atualizar(self, utilizador_id: str, patch: PerfilPatch) -> PerfilRegisto | None:
        atual = self._perfis.get(utilizador_id)
        if atual is None:
            return None
        dados = {**atual.__dict__, **{k: v for k, v in patch.__dict__.items() if v is not None}}
        novo = PerfilRegisto(**dados)
        self._perfis[utilizador_id] = novo
        return novo


def _perfil(**overrides: object) -> PerfilRegisto:
    base = {
        "id": "user-1",
        "email": "ana@example.com",
        "papel": "comum",
        "nome_completo": "Ana Teste",
        "biografia": None,
        "telefone": None,
        "data_nascimento": None,
        "genero": None,
        "provincia": None,
        "avatar_url": None,
        "premium_ativo": False,
        "premium_expira_em": None,
        "notificacoes_projetos": False,
        "notificacoes_lembretes": False,
        "notificacoes_comunidade": False,
        "criado_em": datetime.now(UTC),
    }
    base.update(overrides)
    return PerfilRegisto(**base)


class TestObter:
    def test_devolve_o_perfil_existente(self) -> None:
        service = PerfilService(RepositorioPerfilFalso({"user-1": _perfil()}))

        perfil = service.obter("user-1")

        assert perfil.email == "ana@example.com"

    def test_rejeita_utilizador_inexistente(self) -> None:
        service = PerfilService(RepositorioPerfilFalso())

        with pytest.raises(PerfilNaoEncontradoError):
            service.obter("id-fantasma")


class TestAtualizar:
    def test_atualiza_so_os_campos_enviados(self) -> None:
        service = PerfilService(RepositorioPerfilFalso({"user-1": _perfil(telefone="900000000")}))

        atualizado = service.atualizar("user-1", PerfilPatch(biografia="Nova biografia"))

        assert atualizado.biografia == "Nova biografia"
        assert atualizado.telefone == "900000000"  # não tocado

    def test_atualiza_a_data_de_nascimento(self) -> None:
        service = PerfilService(RepositorioPerfilFalso({"user-1": _perfil()}))

        atualizado = service.atualizar("user-1", PerfilPatch(data_nascimento=date(2000, 1, 1)))

        assert atualizado.data_nascimento == date(2000, 1, 1)

    def test_rejeita_actualizar_utilizador_inexistente(self) -> None:
        service = PerfilService(RepositorioPerfilFalso())

        with pytest.raises(PerfilNaoEncontradoError):
            service.atualizar("id-fantasma", PerfilPatch(biografia="x"))
