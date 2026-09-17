"""Testes do `AdminService` — promover/despromover admins (W-11).

As regras que impedem um admin de se trancar fora do painel: não despromover
a própria conta, não despromover o último admin.
"""

from datetime import UTC, datetime

import pytest

from app.repositories.admin_repository import AdminUtilizadorRegisto
from app.services.admin_service import (
    AdminService,
    NaoPodeAlterarAdminPorAquiError,
    NaoPodeDespromoverASiProprioError,
    PapelInvalidoError,
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

    def listar(self, papel: str | None = None, desde: datetime | None = None) -> list[AdminUtilizadorRegisto]:
        return [
            u
            for u in self._us.values()
            if (papel is None or u.papel == papel) and (desde is None or u.criado_em >= desde)
        ]

    def obter_por_email(self, email: str) -> AdminUtilizadorRegisto | None:
        return next((u for u in self._us.values() if u.email == email.strip().lower()), None)

    def obter_por_id(self, utilizador_id: str) -> AdminUtilizadorRegisto | None:
        return self._us.get(utilizador_id)

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


class TestDefinirPapel:
    def test_muda_para_um_papel_comum(self) -> None:
        repo = RepositorioAdminFalso([_u("u1", "comum")])
        resultado = AdminService(repo).definir_papel("u1", "estrabico")
        assert resultado.papel == "estrabico"
        assert repo.definidos == [("u1", "estrabico")]

    def test_recusa_papel_admin(self) -> None:
        # "admin" tem o seu próprio fluxo (promover_a_admin) -- nunca por aqui.
        repo = RepositorioAdminFalso([_u("u1", "comum")])
        with pytest.raises(PapelInvalidoError):
            AdminService(repo).definir_papel("u1", "admin")
        assert repo.definidos == []

    def test_recusa_papel_desconhecido(self) -> None:
        repo = RepositorioAdminFalso([_u("u1", "comum")])
        with pytest.raises(PapelInvalidoError):
            AdminService(repo).definir_papel("u1", "super-utilizador")
        assert repo.definidos == []

    def test_recusa_mudar_o_papel_de_um_admin(self) -> None:
        # Só despromover() pode -- é o único caminho que verifica o último admin.
        repo = RepositorioAdminFalso([_u("u1", "admin")])
        with pytest.raises(NaoPodeAlterarAdminPorAquiError):
            AdminService(repo).definir_papel("u1", "comum")
        assert repo.definidos == []

    def test_utilizador_desconhecido(self) -> None:
        repo = RepositorioAdminFalso([])
        with pytest.raises(UtilizadorNaoEncontradoError):
            AdminService(repo).definir_papel("fantasma", "comum")
