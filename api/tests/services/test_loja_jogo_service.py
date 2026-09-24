"""Testes do `LojaJogoService` -- as mentiras que este serviço existe para
impedir: um cliente a inventar quantos diamantes um pacote dá ou quanto
custa, gastar moedas que não tem, e diamantes creditados sem pagamento
confirmado (ou creditados duas vezes pelo mesmo pagamento)."""

from dataclasses import replace
from datetime import UTC, datetime

import pytest

from app.repositories.pedido_loja_repository import PedidoAprovado, PedidoLojaRegisto
from app.services.comprovativo_upload_service import ChaveDeComprovativoInvalidaError
from app.services.loja_jogo_service import (
    PACOTES_DIAMANTES,
    PACOTES_MOEDAS,
    LojaJogoService,
    MoedasInsuficientesError,
    PacoteInexistenteError,
    PagamentosIndisponiveisError,
    PedidoLojaJaDecididoError,
    PedidoLojaNaoEncontradoError,
    PedidoLojaSemContaError,
)
from tests.services.test_jogo_service import RepositorioPerfisFalso

AGORA = datetime(2026, 9, 24, 12, 0, tzinfo=UTC)
_POR_ID = {p.id: p for p in PACOTES_DIAMANTES}


class RepositorioPedidosLojaFalso:
    """Mesma semântica do real: decidir só a partir de "pendente", e aprovar
    credita a quantidade do pedido (no saldo do seu tipo) na mesma operação."""

    def __init__(self, perfis: RepositorioPerfisFalso) -> None:
        self._perfis = perfis
        self.pedidos: dict[str, PedidoLojaRegisto] = {}
        self.creditos = 0

    def criar(self, utilizador_id, tipo_item, pacote_id, quantidade, preco_kz, comprovativo_url) -> PedidoLojaRegisto:
        pedido = PedidoLojaRegisto(
            id=f"pedido-{len(self.pedidos) + 1}",
            utilizador_id=utilizador_id,
            pacote_id=pacote_id,
            tipo_item=tipo_item,
            quantidade=quantidade,
            preco_kz=preco_kz,
            comprovativo_url=comprovativo_url,
            estado="pendente",
            decidido_por=None,
            decidido_em=None,
            created_at=AGORA,
        )
        self.pedidos[pedido.id] = pedido
        return pedido

    def obter(self, pedido_id):
        return self.pedidos.get(pedido_id)

    def listar_do_utilizador(self, utilizador_id):
        return [p for p in self.pedidos.values() if p.utilizador_id == utilizador_id]

    def listar(self):
        return list(self.pedidos.values())

    def _decidir(self, pedido_id, estado, admin_id, quando):
        atual = self.pedidos.get(pedido_id)
        if atual is None or atual.estado != "pendente":
            return None
        novo = replace(atual, estado=estado, decidido_por=admin_id, decidido_em=quando)
        self.pedidos[pedido_id] = novo
        return novo

    def aprovar_e_creditar(self, pedido_id, admin_id, quando):
        pedido = self._decidir(pedido_id, "aprovado", admin_id, quando)
        if pedido is None:
            return None
        self.creditos += 1
        creditar = self._perfis.creditar_moedas if pedido.tipo_item == "moedas" else self._perfis.creditar_diamantes
        return PedidoAprovado(pedido=pedido, perfil=creditar(pedido.utilizador_id, pedido.quantidade))

    def rejeitar(self, pedido_id, admin_id, quando):
        return self._decidir(pedido_id, "rejeitado", admin_id, quando)


def _servico(simulados: bool = False):
    perfis = RepositorioPerfisFalso()
    pedidos = RepositorioPedidosLojaFalso(perfis)
    return LojaJogoService(perfis, pedidos, pagamentos_simulados=simulados, relogio=lambda: AGORA), perfis, pedidos


# --- Catálogo ---------------------------------------------------------------


def test_catalogo_tem_ids_unicos_e_precos_crescentes() -> None:
    ids = [p.id for p in PACOTES_DIAMANTES]
    assert len(ids) == len(set(ids))
    for preco in ("preco_kz", "preco_moedas"):
        precos = [getattr(p, preco) for p in PACOTES_DIAMANTES]
        assert precos == sorted(precos)
        # Pacote maior nunca pode sair mais caro por diamante do que um menor.
        por_diamante = [getattr(p, preco) / p.total_diamantes for p in PACOTES_DIAMANTES]
        assert por_diamante == sorted(por_diamante, reverse=True)


def test_preco_em_moedas_e_alto_50_diamantes_custam_2000_moedas() -> None:
    # Decisão do dono do projecto (2026-09-24): "significativamente alto".
    assert (_POR_ID["pequeno"].total_diamantes, _POR_ID["pequeno"].preco_moedas) == (50, 2_000)
    # Uma partida perfeita dá 750 moedas -- nenhum pacote sai a menos de 25
    # moedas por diamante (o pequeno custa quase três partidas perfeitas).
    assert all(p.preco_moedas / p.total_diamantes >= 25 for p in PACOTES_DIAMANTES)


# --- Moedas -----------------------------------------------------------------


def test_comprar_com_moedas_debita_e_credita_atomicamente() -> None:
    servico, perfis, _ = _servico()
    perfis.creditar_moedas("u1", 2_500)

    perfil = servico.comprar("u1", "pequeno", metodo="moedas")

    assert (perfil.moedas, perfil.diamantes) == (500, 50)


def test_moedas_insuficientes_recusa_sem_mexer_em_nada() -> None:
    servico, perfis, _ = _servico()
    perfis.creditar_moedas("u1", 1_999)

    with pytest.raises(MoedasInsuficientesError):
        servico.comprar("u1", "pequeno", metodo="moedas")
    perfil = perfis.obter_ou_criar("u1")
    assert (perfil.moedas, perfil.diamantes) == (1_999, 0)


def test_sem_perfil_de_jogo_ainda_moedas_insuficientes() -> None:
    servico, perfis, _ = _servico()
    with pytest.raises(MoedasInsuficientesError):
        servico.comprar("novo", "pequeno", metodo="moedas")
    assert perfis.obter_ou_criar("novo").diamantes == 0


def test_comprar_com_moedas_funciona_mesmo_sem_pagamentos_simulados() -> None:
    servico, perfis, _ = _servico(simulados=False)
    perfis.creditar_moedas("u1", 14_000)
    assert servico.comprar("u1", "grande", metodo="moedas").diamantes == 480


def test_o_saldo_exacto_chega() -> None:
    servico, perfis, _ = _servico()
    perfis.creditar_moedas("u1", 5_500)
    perfil = servico.comprar("u1", "medio", metodo="moedas")
    assert (perfil.moedas, perfil.diamantes) == (0, 165)


# --- Kwanzas simulados (só desenvolvimento) --------------------------------


def test_kwanzas_em_modo_simulado_credita_o_total_do_catalogo() -> None:
    servico, _, _ = _servico(simulados=True)
    perfil = servico.comprar("u1", "medio")
    assert perfil.diamantes == _POR_ID["medio"].total_diamantes == 165
    # Comprar diamantes não conta como partida nem mexe no progresso.
    assert perfil.partidas_jogadas == 0


def test_kwanzas_sem_pagamentos_simulados_nao_credita_logo() -> None:
    servico, perfis, _ = _servico(simulados=False)
    with pytest.raises(PagamentosIndisponiveisError):
        servico.comprar("u1", "grande", metodo="kwanzas")
    assert perfis.obter_ou_criar("u1").diamantes == 0


@pytest.mark.parametrize("metodo", ["moedas", "kwanzas"])
def test_pacote_inexistente_e_recusado_sem_creditar_nada(metodo) -> None:
    servico, perfis, _ = _servico(simulados=True)
    perfis.creditar_moedas("u1", 100_000)
    with pytest.raises(PacoteInexistenteError):
        servico.comprar("u1", "mega-gratis", metodo=metodo)
    assert perfis.obter_ou_criar("u1").diamantes == 0


# --- Kwanzas reais: pedido com comprovativo + confirmação do admin -------------


def test_pedido_kwanzas_fica_pendente_com_valores_do_catalogo_e_nao_credita(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.services.loja_jogo_service.url_publico_do_comprovativo", lambda chave: f"https://r2/{chave}"
    )
    servico, perfis, _ = _servico()

    pedido = servico.pedir_com_kwanzas("u1", "grande", "comprovativos/abc.pdf")

    assert (pedido.estado, pedido.tipo_item, pedido.quantidade, pedido.preco_kz) == ("pendente", "diamantes", 480, 3_000)
    assert pedido.comprovativo_url == "https://r2/comprovativos/abc.pdf"
    assert perfis.obter_ou_criar("u1").diamantes == 0


def test_pedido_com_chave_que_nao_e_comprovativo_e_recusado() -> None:
    servico, _, pedidos = _servico()
    with pytest.raises(ChaveDeComprovativoInvalidaError):
        servico.pedir_com_kwanzas("u1", "pequeno", "avatares/outro/foto.png")
    assert pedidos.pedidos == {}


def _pedido_pendente(servico, utilizador_id="u1", pacote="medio", monkeypatch=None):
    monkeypatch.setattr("app.services.loja_jogo_service.url_publico_do_comprovativo", lambda c: f"https://r2/{c}")
    return servico.pedir_com_kwanzas(utilizador_id, pacote, "comprovativos/x.png")


def test_aprovar_credita_os_diamantes_do_pedido_uma_so_vez(monkeypatch) -> None:
    servico, perfis, pedidos = _servico()
    pedido = _pedido_pendente(servico, monkeypatch=monkeypatch)

    aprovado = servico.aprovar_pedido(pedido.id, "admin-1")

    assert aprovado.pedido.estado == "aprovado"
    assert (aprovado.pedido.decidido_por, aprovado.pedido.decidido_em) == ("admin-1", AGORA)
    assert aprovado.perfil.diamantes == 165
    # Segunda confirmação do mesmo pagamento (duplo clique, dois admins).
    with pytest.raises(PedidoLojaJaDecididoError):
        servico.aprovar_pedido(pedido.id, "admin-2")
    assert perfis.obter_ou_criar("u1").diamantes == 165
    assert pedidos.creditos == 1


def test_aprovacao_concorrente_perdida_nao_credita(monkeypatch) -> None:
    # O pedido estava pendente quando se leu, mas outro admin decidiu antes
    # da transição atómica -- o repositório devolve None e nada é creditado.
    servico, perfis, pedidos = _servico()
    pedido = _pedido_pendente(servico, monkeypatch=monkeypatch)
    pedidos.aprovar_e_creditar = lambda *a: None

    with pytest.raises(PedidoLojaJaDecididoError):
        servico.aprovar_pedido(pedido.id, "admin-1")
    assert perfis.obter_ou_criar("u1").diamantes == 0


def test_rejeitar_nao_credita_e_depois_nao_se_aprova(monkeypatch) -> None:
    servico, perfis, _ = _servico()
    pedido = _pedido_pendente(servico, monkeypatch=monkeypatch)

    assert servico.rejeitar_pedido(pedido.id, "admin-1").estado == "rejeitado"
    with pytest.raises(PedidoLojaJaDecididoError):
        servico.aprovar_pedido(pedido.id, "admin-1")
    assert perfis.obter_ou_criar("u1").diamantes == 0


def test_aprovar_pedido_inexistente() -> None:
    servico, _, _ = _servico()
    with pytest.raises(PedidoLojaNaoEncontradoError):
        servico.aprovar_pedido("nao-existe", "admin-1")


def test_aprovar_pedido_de_conta_apagada(monkeypatch) -> None:
    servico, _, pedidos = _servico()
    pedido = _pedido_pendente(servico, monkeypatch=monkeypatch)
    pedidos.pedidos[pedido.id] = replace(pedido, utilizador_id=None)
    with pytest.raises(PedidoLojaSemContaError):
        servico.aprovar_pedido(pedido.id, "admin-1")


def test_cada_jogador_so_ve_os_seus_pedidos(monkeypatch) -> None:
    servico, _, _ = _servico()
    _pedido_pendente(servico, "u1", monkeypatch=monkeypatch)
    _pedido_pendente(servico, "u2", monkeypatch=monkeypatch)
    assert [p.utilizador_id for p in servico.listar_pedidos_do_utilizador("u1")] == ["u1"]
    assert len(servico.listar_pedidos()) == 2


# --- Loja de Moedas ----------------------------------------------------------

_MOEDAS_POR_ID = {p.id: p for p in PACOTES_MOEDAS}


def test_catalogo_de_moedas_pilha_saco_bau_com_precos_crescentes() -> None:
    assert [p.id for p in PACOTES_MOEDAS] == ["pilha", "saco", "bau"]
    precos = [p.preco_kz for p in PACOTES_MOEDAS]
    assert precos == sorted(precos) and len(set(precos)) == 3
    por_moeda = [p.preco_kz / p.total_moedas for p in PACOTES_MOEDAS]
    assert por_moeda == sorted(por_moeda, reverse=True)


def test_comprar_moedas_para_trocar_por_diamantes_nunca_sai_mais_barato() -> None:
    # Kz -> moedas -> diamantes nunca pode bater Kz -> diamantes, com o
    # pacote de moedas mais barato por moeda e o de diamantes mais caro.
    kz_por_moeda_minimo = min(p.preco_kz / p.total_moedas for p in PACOTES_MOEDAS)
    for pacote in PACOTES_DIAMANTES:
        assert pacote.preco_moedas * kz_por_moeda_minimo > pacote.preco_kz, pacote.id


def test_pedido_de_moedas_usa_o_catalogo_de_moedas_e_nao_credita(monkeypatch) -> None:
    monkeypatch.setattr("app.services.loja_jogo_service.url_publico_do_comprovativo", lambda c: f"https://r2/{c}")
    servico, perfis, _ = _servico()

    pedido = servico.pedir_com_kwanzas("u1", "saco", "comprovativos/x.png", tipo_item="moedas")

    assert (pedido.tipo_item, pedido.quantidade, pedido.preco_kz) == ("moedas", 3_300, 1_000)
    assert perfis.obter_ou_criar("u1").moedas == 0


@pytest.mark.parametrize(("pacote_id", "tipo_item"), [("pequeno", "moedas"), ("bau", "diamantes")])
def test_pacote_do_outro_catalogo_e_recusado(monkeypatch, pacote_id, tipo_item) -> None:
    # Um "bau" pedido como diamantes (ou "pequeno" como moedas) não existe --
    # nunca se mistura o preço de um catálogo com a quantidade do outro.
    monkeypatch.setattr("app.services.loja_jogo_service.url_publico_do_comprovativo", lambda c: f"https://r2/{c}")
    servico, _, pedidos = _servico()
    with pytest.raises(PacoteInexistenteError):
        servico.pedir_com_kwanzas("u1", pacote_id, "comprovativos/x.png", tipo_item=tipo_item)
    assert pedidos.pedidos == {}


def test_pedido_de_moedas_com_chave_invalida_e_recusado() -> None:
    servico, _, pedidos = _servico()
    with pytest.raises(ChaveDeComprovativoInvalidaError):
        servico.pedir_com_kwanzas("u1", "pilha", "avatares/x.png", tipo_item="moedas")
    assert pedidos.pedidos == {}


def test_aprovar_pedido_de_moedas_credita_moedas_uma_so_vez_e_nao_diamantes(monkeypatch) -> None:
    monkeypatch.setattr("app.services.loja_jogo_service.url_publico_do_comprovativo", lambda c: f"https://r2/{c}")
    servico, perfis, pedidos = _servico()
    pedido = servico.pedir_com_kwanzas("u1", "bau", "comprovativos/x.png", tipo_item="moedas")

    aprovado = servico.aprovar_pedido(pedido.id, "admin-1")

    assert (aprovado.perfil.moedas, aprovado.perfil.diamantes) == (9_000, 0)
    # Moedas compradas não contam como ganhas a jogar (nível do jogador).
    assert aprovado.perfil.moedas_ganhas_total == 0
    with pytest.raises(PedidoLojaJaDecididoError):
        servico.aprovar_pedido(pedido.id, "admin-2")
    assert perfis.obter_ou_criar("u1").moedas == 9_000
    assert pedidos.creditos == 1


def test_rejeitar_pedido_de_moedas_nao_credita(monkeypatch) -> None:
    monkeypatch.setattr("app.services.loja_jogo_service.url_publico_do_comprovativo", lambda c: f"https://r2/{c}")
    servico, perfis, _ = _servico()
    pedido = servico.pedir_com_kwanzas("u1", "pilha", "comprovativos/x.png", tipo_item="moedas")
    servico.rejeitar_pedido(pedido.id, "admin-1")
    assert perfis.obter_ou_criar("u1").moedas == 0


def test_moedas_compradas_servem_para_trocar_por_diamantes(monkeypatch) -> None:
    monkeypatch.setattr("app.services.loja_jogo_service.url_publico_do_comprovativo", lambda c: f"https://r2/{c}")
    servico, _, _ = _servico()
    pedido = servico.pedir_com_kwanzas("u1", "saco", "comprovativos/x.png", tipo_item="moedas")
    servico.aprovar_pedido(pedido.id, "admin-1")

    perfil = servico.comprar("u1", "pequeno", metodo="moedas")

    assert (perfil.moedas, perfil.diamantes) == (1_300, 50)


def test_comprar_moedas_de_imediato_so_em_modo_simulado() -> None:
    servico, _, _ = _servico(simulados=True)
    assert servico.comprar_moedas("u1", "pilha").moedas == _MOEDAS_POR_ID["pilha"].total_moedas

    servico_prod, perfis_prod, _ = _servico(simulados=False)
    with pytest.raises(PagamentosIndisponiveisError):
        servico_prod.comprar_moedas("u1", "bau")
    assert perfis_prod.obter_ou_criar("u1").moedas == 0


def test_comprar_moedas_pacote_inexistente() -> None:
    servico, perfis, _ = _servico(simulados=True)
    with pytest.raises(PacoteInexistenteError):
        servico.comprar_moedas("u1", "cofre-infinito")
    assert perfis.obter_ou_criar("u1").moedas == 0
