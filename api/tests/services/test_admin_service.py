"""Testes do `AdminService` — promover/despromover admins (W-11).

As regras que impedem um admin de se trancar fora do painel: não despromover
a própria conta, não despromover o último admin.
"""

from datetime import UTC, datetime

import pytest

from app.repositories.admin_repository import AdminUtilizadorRegisto
from app.services.admin_service import (
    AdminService,
    NaoPodeDespromoverASiProprioError,
    UltimoAdminError,
    UtilizadorNaoEncontradoError,
)


def _u(id_: str, papel: str, email: str | None = None) -> AdminUtilizadorRegisto:
    return AdminUtilizadorRegisto(
        id=id_,
        email=email or f"{id_}@example.com",
        nome_completo=None,
        papel=papel,
        premium_ativo=False,
        criado_em=datetime.now(UTC),
    )


class RepositorioAdminFalso:
    def __init__(self, utilizadores: list[AdminUtilizadorRegisto]) -> None:
        self._us = {u.id: u for u in utilizadores}
        self.definidos: list[tuple[str, str]] = []

    def listar(self, papel: str | None = None) -> list[AdminUtilizadorRegisto]:
        return [u for u in self._us.values() if papel is None or u.papel == papel]

    def obter_por_email(self, email: str) -> AdminUtilizadorRegisto | None:
        return next((u for u in self._us.values() if u.email == email.strip().lower()), None)

    def definir_papel(self, utilizador_id: str, papel: str) -> AdminUtilizadorRegisto | None:
        if utilizador_id not in self._us:
            return None
        self.definidos.append((utilizador_id, papel))
        atual = self._us[utilizador_id]
        novo = _u(atual.id, papel, atual.email)
        self._us[utilizador_id] = novo
        return novo


class TestPromover:
    def test_promove_conta_comum(self) -> None:
        repo = RepositorioAdminFalso([_u("u1", "comum", "ana@example.com")])
        resultado = AdminService(repo).promover_a_admin("ana@example.com")
        assert resultado.papel == "admin"
        assert repo.definidos == [("u1", "admin")]

    def test_email_desconhecido(self) -> None:
        repo = RepositorioAdminFalso([])
        with pytest.raises(UtilizadorNaoEncontradoError):
            AdminService(repo).promover_a_admin("ninguem@example.com")

    def test_ja_admin_e_no_op(self) -> None:
        repo = RepositorioAdminFalso([_u("u1", "admin", "ana@example.com")])
        AdminService(repo).promover_a_admin("ana@example.com")
        assert repo.definidos == []


class TestDespromover:
    def test_recusa_despromover_a_si_proprio(self) -> None:
        repo = RepositorioAdminFalso([_u("u1", "admin"), _u("u2", "admin")])
        with pytest.raises(NaoPodeDespromoverASiProprioError):
            AdminService(repo).despromover("u1", executor_id="u1")
        assert repo.definidos == []

    def test_recusa_despromover_o_ultimo_admin(self) -> None:
        repo = RepositorioAdminFalso([_u("u1", "admin"), _u("u2", "comum")])
        with pytest.raises(UltimoAdminError):
            AdminService(repo).despromover("u1", executor_id="u2")
        assert repo.definidos == []

    def test_despromove_quando_ha_outro_admin_e_nao_e_o_proprio(self) -> None:
        repo = RepositorioAdminFalso([_u("u1", "admin"), _u("u2", "admin")])
        resultado = AdminService(repo).despromover("u2", executor_id="u1")
        assert resultado.papel == "comum"
        assert repo.definidos == [("u2", "comum")]
