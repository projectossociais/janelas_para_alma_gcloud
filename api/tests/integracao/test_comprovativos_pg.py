"""`SQLAlchemyComprovativosRepository` contra um Postgres real -- as três
tabelas, a migração dos URLs antigos para a chave privada e o CHECK de
`pedidos_loja_jogo` (um comprovativo, chave ou URL, sempre)."""

import uuid

import pytest
from sqlalchemy.exc import IntegrityError

from app.repositories.comprovativos_repository import (
    ReferenciaComprovativo,
    SQLAlchemyComprovativosRepository,
)
from app.repositories.orm_models import Doacao, PedidoLojaJogo, PremiumRequest, Utilizador


def _pedido_loja(utilizador_id, **comprovativo) -> PedidoLojaJogo:
    return PedidoLojaJogo(
        utilizador_id=utilizador_id, pacote_id="pequeno", quantidade=50, preco_kz=500, **comprovativo
    )


def test_le_referencias_e_migra_os_urls_antigos(sessao_pg) -> None:
    ana = Utilizador(email="ana@example.com", password_hash="x")
    sessao_pg.add(ana)
    sessao_pg.flush()
    premium_antigo = PremiumRequest(nome="Ana", email="a@x", comprovativo_url="https://pub/comprovativos/a.pdf")
    premium_novo = PremiumRequest(nome="Ana", email="a@x", comprovativo_chave="comprovativos/b.pdf")
    doacao_antiga = Doacao(email="a@x", tipo="financeiro", comprovativo_url="https://pub/comprovativos/c.png")
    doacao_materiais = Doacao(email="a@x", tipo="materiais")
    loja_antiga = _pedido_loja(ana.id, comprovativo_url="https://pub/comprovativos/d.webp")
    loja_nova = _pedido_loja(ana.id, comprovativo_chave="comprovativos/e.png")
    sessao_pg.add_all([premium_antigo, premium_novo, doacao_antiga, doacao_materiais, loja_antiga, loja_nova])
    sessao_pg.commit()
    repo = SQLAlchemyComprovativosRepository(sessao_pg)

    assert repo.obter_referencia("premium", str(premium_novo.id)) == ReferenciaComprovativo(
        chave="comprovativos/b.pdf", url_legado=None
    )
    assert repo.obter_referencia("loja", str(loja_antiga.id)) == ReferenciaComprovativo(
        chave=None, url_legado="https://pub/comprovativos/d.webp"
    )
    assert repo.obter_referencia("doacao", str(doacao_materiais.id)) == ReferenciaComprovativo(None, None)
    assert repo.obter_referencia("doacao", str(uuid.uuid4())) is None
    assert repo.obter_referencia("premium", "nao-e-uuid") is None
    # O id de um pedido Premium não abre nada na tabela das doações.
    assert repo.obter_referencia("doacao", str(premium_novo.id)) is None

    legados = repo.listar_legados()
    assert {(x.origem, x.registo_id) for x in legados} == {
        ("premium", str(premium_antigo.id)),
        ("doacao", str(doacao_antiga.id)),
        ("loja", str(loja_antiga.id)),
    }

    repo.marcar_migrado("loja", str(loja_antiga.id), "comprovativos/d.webp")

    assert repo.obter_referencia("loja", str(loja_antiga.id)) == ReferenciaComprovativo(
        chave="comprovativos/d.webp", url_legado=None
    )
    assert ("loja", str(loja_antiga.id)) not in {(x.origem, x.registo_id) for x in repo.listar_legados()}


def test_pedido_da_loja_sem_comprovativo_nenhum_e_recusado(sessao_pg) -> None:
    ana = Utilizador(email="ana@example.com", password_hash="x")
    sessao_pg.add(ana)
    sessao_pg.flush()
    sessao_pg.add(_pedido_loja(ana.id))

    with pytest.raises(IntegrityError):
        sessao_pg.commit()
