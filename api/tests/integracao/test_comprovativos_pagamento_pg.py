"""Comprovativos de pagamento contra Postgres real: os índices únicos
parciais (o anti-replay que sobrevive a uma corrida) e a activação do
Premium na mesma transacção. Um repositório falso não apanha nada disto."""

import uuid
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError

from app.repositories.comprovativos_pagamento_repository import (
    ComprovativoDuplicadoError,
    NovoComprovativo,
    SQLAlchemyComprovativosPagamentoRepository,
)
from app.repositories.eliminacao_conta_repository import SQLAlchemyEliminacaoContaRepository
from app.repositories.orm_models import ComprovativoPagamento, Utilizador

AGORA = datetime(2026, 10, 14, 8, 30, tzinfo=UTC)


def _novo(utilizador_id: str, estado: str, hash_: str = "a" * 64, referencia: str | None = "OP1"):
    return NovoComprovativo(
        utilizador_id=utilizador_id,
        chave_ficheiro=f"comprovativos-pagamento/{utilizador_id}/{hash_[:6]}.pdf",
        hash_sha256=hash_,
        estado=estado,
        referencia_transacao=referencia,
        montante_kz=Decimal("15000.00"),
        texto_extraido="Montante: 15.000,00 Kz Beneficiário: Fulano",
        metadados_ficheiro={"Producer": "BAI Directo"},
    )


def _mais_30(actual):
    return (actual if actual and actual > AGORA else AGORA) + timedelta(days=30)


@pytest.fixture
def ana(sessao_pg) -> str:
    u = Utilizador(email="ana@example.com", password_hash="x")
    sessao_pg.add(u)
    sessao_pg.commit()
    return str(u.id)


def test_aprovar_grava_o_comprovativo_e_o_premium_juntos(sessao_pg, ana) -> None:
    repo = SQLAlchemyComprovativosPagamentoRepository(sessao_pg)
    reg = repo.registar(_novo(ana, "aprovado"), ajustar_premium=_mais_30)

    sessao_pg.expire_all()
    u = sessao_pg.get(Utilizador, uuid.UUID(ana))
    assert u.premium_ativo is True
    assert u.premium_expira_em == AGORA + timedelta(days=30)
    assert reg.premium_expira_em == AGORA + timedelta(days=30)
    assert reg.utilizador_email == "ana@example.com"
    assert repo.estado_por_hash("a" * 64) == "aprovado"
    assert repo.estado_por_referencia("OP1") == "aprovado"

    # Renovar soma à validade actual.
    reg2 = repo.registar(_novo(ana, "aprovado", hash_="b" * 64, referencia="OP2"), ajustar_premium=_mais_30)
    assert reg2.premium_expira_em == AGORA + timedelta(days=60)


def test_mesmo_hash_ou_mesma_operacao_nao_contam_duas_vezes(sessao_pg, ana) -> None:
    repo = SQLAlchemyComprovativosPagamentoRepository(sessao_pg)
    repo.registar(_novo(ana, "aprovado"), ajustar_premium=_mais_30)

    with pytest.raises(ComprovativoDuplicadoError):
        repo.registar(_novo(ana, "aprovado", referencia="OUTRA"), ajustar_premium=_mais_30)
    with pytest.raises(ComprovativoDuplicadoError):
        repo.registar(_novo(ana, "revisao_manual", hash_="c" * 64, referencia="OP1"))

    # O Premium da tentativa falhada não ficou aplicado (rollback).
    sessao_pg.expire_all()
    assert sessao_pg.query(Utilizador).one().premium_expira_em == AGORA + timedelta(days=30)
    assert sessao_pg.query(ComprovativoPagamento).count() == 1


def test_rejeitados_nao_bloqueiam_o_reenvio(sessao_pg, ana) -> None:
    repo = SQLAlchemyComprovativosPagamentoRepository(sessao_pg)
    repo.registar(_novo(ana, "rejeitado"))
    repo.registar(_novo(ana, "rejeitado"))
    assert repo.estado_por_hash("a" * 64) is None
    reg = repo.registar(_novo(ana, "aprovado"), ajustar_premium=_mais_30)
    assert reg.estado == "aprovado"
    assert [r.estado for r in repo.listar()].count("rejeitado") == 2
    assert [r.estado for r in repo.listar("aprovado")] == ["aprovado"]


def test_admin_decide_e_revogado_continua_a_bloquear(sessao_pg, ana) -> None:
    admin = Utilizador(email="admin@example.com", password_hash="x", papel="admin")
    sessao_pg.add(admin)
    sessao_pg.commit()
    repo = SQLAlchemyComprovativosPagamentoRepository(sessao_pg)
    rev = repo.registar(_novo(ana, "revisao_manual"))

    aprovado = repo.decidir(rev.id, "aprovado", str(admin.id), AGORA, ajustar_premium=_mais_30)
    assert aprovado.premium_expira_em == AGORA + timedelta(days=30)
    assert aprovado.decidido_por == str(admin.id)

    revogado = repo.decidir(
        rev.id, "revogado", str(admin.id), AGORA, "revogado_pela_equipa", "fraude",
        ajustar_premium=lambda actual: None,
    )
    assert revogado.estado == "revogado"
    assert revogado.premium_expira_em == AGORA + timedelta(days=30)  # histórico do que deu
    sessao_pg.expire_all()
    assert sessao_pg.query(Utilizador).filter_by(email="ana@example.com").one().premium_ativo is False
    with pytest.raises(ComprovativoDuplicadoError):
        repo.registar(_novo(ana, "aprovado"), ajustar_premium=_mais_30)
    assert repo.obter("nao-e-um-uuid") is None


def test_anonimizar_a_conta_apaga_o_texto_mas_guarda_o_registo(sessao_pg, ana) -> None:
    repo = SQLAlchemyComprovativosPagamentoRepository(sessao_pg)
    repo.registar(_novo(ana, "aprovado"), ajustar_premium=_mais_30)

    SQLAlchemyEliminacaoContaRepository(sessao_pg).anonimizar(
        ana, AGORA, "anon@anonimo.test", "hash-invalido", "Conta eliminada"
    )
    sessao_pg.expire_all()
    c = sessao_pg.query(ComprovativoPagamento).one()
    assert c.texto_extraido is None
    assert (c.referencia_transacao, c.hash_sha256) == ("OP1", "a" * 64)


def test_capturas_activas_e_origens_dos_outros_bancos(sessao_pg, ana) -> None:
    repo = SQLAlchemyComprovativosPagamentoRepository(sessao_pg)
    captura = replace(_novo(ana, "aprovado"), hash_perceptual="f" * 64, origem="bfa", metadados_ficheiro={"tipo": "png"})
    reg = repo.registar(captura, ajustar_premium=_mais_30)
    assert (reg.hash_perceptual, reg.origem) == ("f" * 64, "bfa")
    repo.registar(replace(_novo(ana, "rejeitado", hash_="b" * 64, referencia="OP2"), hash_perceptual="e" * 64))
    repo.registar(_novo(ana, "revisao_manual", hash_="c" * 64, referencia="OP3"))  # PDF: sem hash perceptual

    # Só as imagens que contam (a rejeitada e o PDF ficam de fora).
    assert repo.capturas_activas() == [("f" * 64, "OP1")]

    with pytest.raises(IntegrityError):
        sessao_pg.add(
            ComprovativoPagamento(
                utilizador_id=uuid.UUID(ana), hash_sha256="d" * 64, chave_ficheiro="x", estado="rejeitado", origem="banco_inventado"
            )
        )
        sessao_pg.commit()
    sessao_pg.rollback()
