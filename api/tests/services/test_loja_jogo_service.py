"""Testes do `LojaJogoService` -- as mentiras que este serviço existe para
impedir: um cliente a inventar quantos diamantes um pacote dá, e uma compra
"simulada" a creditar diamantes grátis fora de desenvolvimento."""

import pytest

from app.services.loja_jogo_service import (
    PACOTES_DIAMANTES,
    LojaJogoService,
    PacoteInexistenteError,
    PagamentosIndisponiveisError,
)
from tests.services.test_jogo_service import RepositorioPerfisFalso


def test_catalogo_tem_ids_unicos_e_precos_crescentes() -> None:
    ids = [p.id for p in PACOTES_DIAMANTES]
    assert len(ids) == len(set(ids))
    precos = [p.preco_kz for p in PACOTES_DIAMANTES]
    assert precos == sorted(precos)
    # Pacote maior nunca pode sair mais caro por diamante do que um menor.
    custo_por_diamante = [p.preco_kz / p.total_diamantes for p in PACOTES_DIAMANTES]
    assert custo_por_diamante == sorted(custo_por_diamante, reverse=True)


def test_comprar_em_modo_simulado_credita_o_total_do_catalogo() -> None:
    perfis = RepositorioPerfisFalso()
    servico = LojaJogoService(perfis, pagamentos_simulados=True)

    medio = next(p for p in PACOTES_DIAMANTES if p.id == "medio")
    perfil = servico.comprar("u1", "medio")

    assert perfil.diamantes == medio.total_diamantes == medio.diamantes + medio.bonus
    # Comprar diamantes não conta como partida nem mexe no progresso.
    assert perfil.partidas_jogadas == 0


def test_compras_sucessivas_acumulam() -> None:
    perfis = RepositorioPerfisFalso()
    servico = LojaJogoService(perfis, pagamentos_simulados=True)

    servico.comprar("u1", "pequeno")
    perfil = servico.comprar("u1", "pequeno")

    assert perfil.diamantes == 2 * PACOTES_DIAMANTES[0].total_diamantes


def test_pacote_inexistente_e_recusado_sem_creditar_nada() -> None:
    perfis = RepositorioPerfisFalso()
    servico = LojaJogoService(perfis, pagamentos_simulados=True)

    with pytest.raises(PacoteInexistenteError):
        servico.comprar("u1", "mega-gratis")
    assert perfis.obter_ou_criar("u1").diamantes == 0


def test_sem_pagamentos_simulados_a_compra_e_recusada_sem_creditar_nada() -> None:
    perfis = RepositorioPerfisFalso()
    servico = LojaJogoService(perfis, pagamentos_simulados=False)

    with pytest.raises(PagamentosIndisponiveisError):
        servico.comprar("u1", "grande")
    assert perfis.obter_ou_criar("u1").diamantes == 0
