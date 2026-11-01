"""Compras nas lojas contra Postgres real (2026-10-30): o índice único que
impede aplicar a mesma transacção duas vezes, o efeito na mesma transacção
e o reembolso -- o que um repositório falso não apanha."""

import uuid
from datetime import UTC, datetime, timedelta

from app.repositories.compras_loja_repository import NovaCompraLoja, SQLAlchemyCompraLojaRepository
from app.repositories.orm_models import CompraLoja, PerfilJogador, Utilizador

AGORA = datetime(2026, 10, 30, 12, 0, tzinfo=UTC)


def _utilizador(s, nome: str, **kw) -> Utilizador:
    base = {"email": f"{nome}@ex.com", "password_hash": "x", "nome_completo": nome, "email_confirmado": True}
    base.update(kw)
    u = Utilizador(**base)
    s.add(u)
    s.flush()
    return u


def _compra(utilizador_id, **kw) -> NovaCompraLoja:
    base = {
        "utilizador_id": str(utilizador_id),
        "loja": "app_store",
        "ambiente": "producao",
        "produto_id": "jpa_premium_mensal",
        "tipo": "premium",
        "quantidade": None,
        "premium_segundos": 30 * 86400,
        "transacao_id": "t-1",
        "transacao_original_id": "t-1",
        "comprado_em": AGORA,
    }
    base.update(kw)
    return NovaCompraLoja(**base)


def _somar(actual):
    base = actual if actual is not None and actual > AGORA else AGORA
    return base + timedelta(days=30)


def _retirar(actual, segundos):
    restante = actual - timedelta(seconds=segundos) if actual else None
    return restante if restante and restante > AGORA else None


def test_premium_aplica_uma_vez_e_o_reembolso_desfaz(sessao_pg) -> None:
    s = sessao_pg
    ana = _utilizador(s, "ana")
    s.commit()
    repo = SQLAlchemyCompraLojaRepository(s)

    assert repo.conta_activa(str(ana.id))
    assert repo.registar(_compra(ana.id), _somar) is True
    assert repo.registar(_compra(ana.id), _somar) is False
    s.refresh(ana)
    assert ana.premium_ativo and ana.premium_expira_em == AGORA + timedelta(days=30)
    assert s.query(CompraLoja).count() == 1

    assert repo.reembolsar("app_store", "t-1", AGORA, _retirar) is True
    assert repo.reembolsar("app_store", "t-1", AGORA, _retirar) is False
    s.refresh(ana)
    assert not ana.premium_ativo and ana.premium_expira_em is None


def test_diamantes_criam_o_perfil_do_jogo_e_o_reembolso_nunca_fica_negativo(sessao_pg) -> None:
    s = sessao_pg
    rui = _utilizador(s, "rui")
    s.commit()
    repo = SQLAlchemyCompraLojaRepository(s)

    compra = _compra(rui.id, produto_id="jpa_diamantes_medio", tipo="diamantes", quantidade=165, premium_segundos=None)
    assert repo.registar(compra) is True
    perfil = s.query(PerfilJogador).filter_by(utilizador_id=rui.id).one()
    assert (perfil.diamantes, perfil.moedas) == (165, 0)

    perfil.diamantes = 100  # gastou parte
    s.commit()
    assert repo.reembolsar("app_store", "t-1", AGORA, _retirar) is True
    s.refresh(perfil)
    assert perfil.diamantes == 0


def test_mesma_transaccao_em_lojas_diferentes_sao_compras_diferentes(sessao_pg) -> None:
    s = sessao_pg
    eva = _utilizador(s, "eva")
    s.commit()
    repo = SQLAlchemyCompraLojaRepository(s)
    moedas = {"produto_id": "jpa_moedas_pilha", "tipo": "moedas", "quantidade": 1000, "premium_segundos": None}
    assert repo.registar(_compra(eva.id, **moedas)) is True
    assert repo.registar(_compra(eva.id, loja="play_store", **moedas)) is True
    perfil = s.query(PerfilJogador).filter_by(utilizador_id=eva.id).one()
    assert perfil.moedas == 2000


def test_conta_anonimizada_ou_inexistente_nao_conta(sessao_pg) -> None:
    s = sessao_pg
    zeca = _utilizador(s, "zeca", anonimizado_em=AGORA)
    s.commit()
    repo = SQLAlchemyCompraLojaRepository(s)
    assert not repo.conta_activa(str(zeca.id))
    assert not repo.conta_activa(str(uuid.uuid4()))
    assert not repo.conta_activa("$RCAnonymousID:abc")
