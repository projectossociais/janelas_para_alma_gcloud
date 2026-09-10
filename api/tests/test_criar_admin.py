"""Testes do núcleo do comando `python -m app.criar_admin`."""

from app.criar_admin import promover_email_a_admin
from tests.services.test_admin_service import RepositorioAdminFalso, _u


def test_promove_conta_existente() -> None:
    repo = RepositorioAdminFalso([_u("u1", "comum", "ana@example.com")])
    codigo, msg = promover_email_a_admin(repo, "ana@example.com")
    assert codigo == 0
    assert "é agora admin" in msg
    assert repo.definidos == [("u1", "admin")]


def test_conta_inexistente_devolve_erro() -> None:
    repo = RepositorioAdminFalso([])
    codigo, msg = promover_email_a_admin(repo, "ninguem@example.com")
    assert codigo == 1
    assert "não há nenhuma conta" in msg
    assert repo.definidos == []


def test_ja_admin_e_no_op() -> None:
    repo = RepositorioAdminFalso([_u("u1", "admin", "ana@example.com")])
    codigo, msg = promover_email_a_admin(repo, "ana@example.com")
    assert codigo == 0
    assert "já é admin" in msg
    assert repo.definidos == []
