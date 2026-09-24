"""Testes do `MercadoJogoService` -- as mentiras que este serviço impede:
comprar sem diamantes, comprar outra vez a um vendedor ainda bloqueado, ou
inventar o preço/precisão de um vendedor."""

import random
from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from app.repositories.mercado_jogo_repository import ResultadoDebito
from app.repositories.orm_models import CATEGORIAS_PERGUNTA_JOGO
from app.services.jogo_service import PerguntaForaDaPartidaError, PerguntaNaoEncontradaError
from app.services.mercado_jogo_service import (
    DURACAO_BLOQUEIO,
    VENDEDORES,
    DiamantesInsuficientesError,
    MercadoJogoService,
    VendedorBloqueadoError,
    VendedorInexistenteError,
)
from tests.services.test_jogo_service import (
    RepositorioPartidasFalso,
    RepositorioPerfisFalso,
    RepositorioPerguntasFalso,
)


class RepositorioMercadoFalso:
    """Mesma semântica do repositório real: bloqueio e débito juntos, ou nada."""

    def __init__(self, perfis: RepositorioPerfisFalso) -> None:
        self._perfis = perfis
        self.bloqueios: dict[tuple[str, str], datetime] = {}

    def listar_bloqueios(self, utilizador_id: str) -> dict[str, datetime]:
        return {v: ate for (u, v), ate in self.bloqueios.items() if u == utilizador_id}

    def debitar_e_bloquear(
        self, utilizador_id: str, vendedor_id: str, custo: int, agora: datetime, disponivel_em: datetime
    ) -> ResultadoDebito:
        atual = self.bloqueios.get((utilizador_id, vendedor_id))
        if atual is not None and atual > agora:
            return ResultadoDebito(estado="em_bloqueio", disponivel_em=atual)
        perfil = self._perfis.obter_ou_criar(utilizador_id)
        if perfil.diamantes < custo:
            return ResultadoDebito(estado="saldo_insuficiente")
        perfil = self._perfis.creditar_diamantes(utilizador_id, -custo)
        self.bloqueios[(utilizador_id, vendedor_id)] = disponivel_em
        return ResultadoDebito(estado="ok", perfil=perfil)


class Relogio:
    def __init__(self) -> None:
        self.agora = datetime(2026, 9, 24, 12, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.agora


class AleatorioFixo(random.Random):
    """`random()` devolve sempre o mesmo valor -- para testar a precisão."""

    def __init__(self, valor: float) -> None:
        super().__init__(0)
        self._valor = valor

    def random(self) -> float:
        return self._valor


@pytest.fixture
def ambiente():
    perfis = RepositorioPerfisFalso()
    perguntas = RepositorioPerguntasFalso()
    perguntas.adicionar("p1", "C", nivel_dificuldade=1)
    mercado = RepositorioMercadoFalso(perfis)
    relogio = Relogio()
    partidas = RepositorioPartidasFalso(perfis)
    # Os dois jogadores dos testes estão a meio de uma partida, na pergunta "p1".
    for utilizador_id in ("u1", "u2"):
        _na_pergunta(partidas, utilizador_id, "p1")
    return perfis, perguntas, mercado, relogio, partidas


def _na_pergunta(partidas: RepositorioPartidasFalso, utilizador_id: str, pergunta_id: str) -> None:
    partida = partidas.obter_ativa(utilizador_id) or partidas.criar(utilizador_id)
    partidas.partidas[partida.id] = replace(partida, pergunta_atual_id=pergunta_id)


def _servico(ambiente, aleatorio: random.Random | None = None) -> MercadoJogoService:
    _perfis, perguntas, mercado, relogio, partidas = ambiente
    return MercadoJogoService(
        mercado, perguntas, partidas, relogio=relogio, aleatorio=aleatorio or random.Random(1)
    )


def test_catalogo_mais_caro_e_sempre_mais_preciso() -> None:
    ids = [v.id for v in VENDEDORES]
    assert len(ids) == len(set(ids))
    custos = [v.custo_diamantes for v in VENDEDORES]
    precisoes = [v.precisao for v in VENDEDORES]
    assert custos == sorted(custos) and len(set(custos)) == len(custos)
    assert precisoes == sorted(precisoes) and len(set(precisoes)) == len(precisoes)
    assert all(0.25 < p <= 1 for p in precisoes)  # nunca pior do que adivinhar


def test_bloqueio_dura_4_horas() -> None:
    assert DURACAO_BLOQUEIO == timedelta(hours=4)


def test_comprar_debita_o_custo_do_catalogo_e_bloqueia_4h(ambiente) -> None:
    perfis, _, mercado, relogio, _ = ambiente
    perfis.creditar_diamantes("u1", 100)
    vendedor = VENDEDORES[1]

    ajuda = _servico(ambiente).comprar("u1", vendedor.id, "p1")

    assert ajuda.perfil.diamantes == 100 - vendedor.custo_diamantes
    assert ajuda.disponivel_em == relogio.agora + timedelta(hours=4)
    assert mercado.bloqueios[("u1", vendedor.id)] == relogio.agora + timedelta(hours=4)
    assert ajuda.resposta_sugerida in {"A", "B", "C", "D"}


def test_vendedor_bloqueado_recusa_sem_debitar(ambiente) -> None:
    perfis, _, _, relogio, _ = ambiente
    perfis.creditar_diamantes("u1", 100)
    servico = _servico(ambiente)
    servico.comprar("u1", "estudante-medicina", "p1")
    saldo = perfis.obter_ou_criar("u1").diamantes

    relogio.agora += timedelta(hours=3, minutes=59)
    with pytest.raises(VendedorBloqueadoError) as erro:
        servico.comprar("u1", "estudante-medicina", "p1")

    assert erro.value.disponivel_em == datetime(2026, 9, 24, 16, 0, tzinfo=UTC)
    assert perfis.obter_ou_criar("u1").diamantes == saldo


def test_bloqueio_de_um_vendedor_nao_afecta_os_outros(ambiente) -> None:
    perfis, *_ = ambiente
    perfis.creditar_diamantes("u1", 100)
    servico = _servico(ambiente)
    servico.comprar("u1", "estudante-medicina", "p1")
    servico.comprar("u1", "enfermeira-oftalmica", "p1")  # não levanta


def test_bloqueio_e_por_jogador(ambiente) -> None:
    perfis, *_ = ambiente
    perfis.creditar_diamantes("u1", 100)
    perfis.creditar_diamantes("u2", 100)
    servico = _servico(ambiente)
    servico.comprar("u1", "estudante-medicina", "p1")
    servico.comprar("u2", "estudante-medicina", "p1")  # não levanta


def test_depois_das_4h_o_vendedor_volta_a_vender(ambiente) -> None:
    perfis, _, _, relogio, _ = ambiente
    perfis.creditar_diamantes("u1", 100)
    servico = _servico(ambiente)
    servico.comprar("u1", "estudante-medicina", "p1")

    relogio.agora += timedelta(hours=4)
    ajuda = servico.comprar("u1", "estudante-medicina", "p1")
    assert ajuda.disponivel_em == relogio.agora + timedelta(hours=4)


def test_sem_diamantes_suficientes_recusa_e_nao_bloqueia(ambiente) -> None:
    perfis, _, mercado, _, _ = ambiente
    kota = VENDEDORES[-1]
    perfis.creditar_diamantes("u1", kota.custo_diamantes - 1)

    with pytest.raises(DiamantesInsuficientesError):
        _servico(ambiente).comprar("u1", kota.id, "p1")

    assert perfis.obter_ou_criar("u1").diamantes == kota.custo_diamantes - 1
    assert mercado.bloqueios == {}


def test_vendedor_inexistente(ambiente) -> None:
    with pytest.raises(VendedorInexistenteError):
        _servico(ambiente).comprar("u1", "vendedor-gratis", "p1")


def test_pergunta_inexistente_nao_cobra(ambiente) -> None:
    perfis, _, mercado, _, partidas = ambiente
    _na_pergunta(partidas, "u1", "nao-existe")
    perfis.creditar_diamantes("u1", 100)
    with pytest.raises(PerguntaNaoEncontradaError):
        _servico(ambiente).comprar("u1", "estudante-medicina", "nao-existe")
    assert perfis.obter_ou_criar("u1").diamantes == 100
    assert mercado.bloqueios == {}


def test_pergunta_que_nao_e_a_da_partida_e_recusada_sem_cobrar(ambiente) -> None:
    # Sem isto o Mercado servia para "sondar" perguntas que o jogador ainda
    # não recebeu, ou de uma partida que já nem está em curso.
    perfis, perguntas, mercado, _, _partidas = ambiente
    perguntas.adicionar("p2", "B", nivel_dificuldade=1)
    perfis.creditar_diamantes("u1", 100)
    with pytest.raises(PerguntaForaDaPartidaError):
        _servico(ambiente).comprar("u1", "estudante-medicina", "p2")
    with pytest.raises(PerguntaForaDaPartidaError):
        _servico(ambiente).comprar("u3", "estudante-medicina", "p1")  # sem partida
    assert perfis.obter_ou_criar("u1").diamantes == 100
    assert mercado.bloqueios == {}


def test_a_aguardar_decisao_nao_se_compra_no_mercado(ambiente) -> None:
    perfis, _, _, _, partidas = ambiente
    perfis.creditar_diamantes("u1", 100)
    partida = partidas.obter_ativa("u1")
    partidas.partidas[partida.id] = replace(partida, estado="a_aguardar_decisao")
    with pytest.raises(PerguntaForaDaPartidaError):
        _servico(ambiente).comprar("u1", "estudante-medicina", "p1")



def test_dentro_da_precisao_sugere_a_resposta_certa(ambiente) -> None:
    perfis, *_ = ambiente
    perfis.creditar_diamantes("u1", 100)
    # 0.49 < 0.75 (estudante em curiosidades, a categoria de "p1") -> acerta
    ajuda = _servico(ambiente, AleatorioFixo(0.49)).comprar("u1", "estudante-medicina", "p1")
    assert ajuda.resposta_sugerida == "C"


def test_fora_da_precisao_sugere_uma_errada_visivel(ambiente) -> None:
    perfis, *_ = ambiente
    perfis.creditar_diamantes("u1", 100)
    ajuda = _servico(ambiente, AleatorioFixo(0.99)).comprar(
        "u1", "estudante-medicina", "p1", opcoes_excluidas=["A", "B"]
    )
    # Errou, e não sugere nenhuma das opções que o 50:50 já escondeu.
    assert ajuda.resposta_sugerida == "D"


def test_taxa_de_acerto_acompanha_a_precisao(ambiente) -> None:
    perfis, *_ = ambiente
    for vendedor in (VENDEDORES[0], VENDEDORES[-1]):
        servico = _servico(ambiente, random.Random(42))
        certas = 0
        for i in range(2000):
            relogio = ambiente[3]
            relogio.agora += timedelta(hours=5)  # passa o bloqueio
            perfis.creditar_diamantes("u1", vendedor.custo_diamantes)
            certas += servico.comprar("u1", vendedor.id, "p1").resposta_sugerida == "C"
        # "p1" é curiosidades_visuais -- a certeza é a dessa categoria.
        assert abs(certas / 2000 - vendedor.precisao_para("curiosidades_visuais")) < 0.04


def test_listar_mostra_bloqueio_so_enquanto_dura(ambiente) -> None:
    perfis, _, _, relogio, _ = ambiente
    perfis.creditar_diamantes("u1", 100)
    servico = _servico(ambiente)
    servico.comprar("u1", "optometrista", "p1")

    estados = {e.vendedor.id: e.disponivel_em for e in servico.listar("u1").vendedores}
    assert estados["optometrista"] == relogio.agora + timedelta(hours=4)
    assert estados["estudante-medicina"] is None

    relogio.agora += timedelta(hours=4, seconds=1)
    assert all(e.disponivel_em is None for e in servico.listar("u1").vendedores)


# --- Certeza por categoria (afinidades) --------------------------------------

_POR_ID = {v.id: v for v in VENDEDORES}


@pytest.mark.parametrize(
    ("vendedor_id", "categoria", "afinidade", "precisao"),
    [
        # Estudante de Medicina (João): forte em anatomia e curiosidades,
        # ainda sem casos clínicos.
        ("estudante-medicina", "anatomia_ocular", "especialista", 0.75),
        ("estudante-medicina", "curiosidades_visuais", "especialista", 0.75),
        ("estudante-medicina", "doencas_estrabismo", "fraco", 0.35),
        ("estudante-medicina", "ciencia_ocular", "neutro", 0.50),
        # Enfermeira Oftálmica (Marta): prevenção, cuidados e estilo de vida.
        ("enfermeira-oftalmica", "prevencao_cuidados", "especialista", 0.85),
        ("enfermeira-oftalmica", "estilo_vida_visao", "especialista", 0.85),
        ("enfermeira-oftalmica", "ciencia_ocular", "fraco", 0.50),
        ("enfermeira-oftalmica", "anatomia_ocular", "neutro", 0.70),
        # Optometrista (Dr. Paulo): ciência ocular.
        ("optometrista", "ciencia_ocular", "especialista", 0.95),
        ("optometrista", "doencas_estrabismo", "fraco", 0.75),
        ("optometrista", "prevencao_cuidados", "neutro", 0.85),
        # Oftalmologista Especialista (Dra. Helena): doenças e estrabismo.
        ("oftalmologista", "doencas_estrabismo", "especialista", 0.98),
        ("oftalmologista", "estilo_vida_visao", "fraco", 0.80),
        ("oftalmologista", "ciencia_ocular", "neutro", 0.90),
        # Sem pergunta em curso: a certeza base.
        ("oftalmologista", None, "neutro", 0.90),
    ],
)
def test_certeza_depende_da_categoria(vendedor_id, categoria, afinidade, precisao) -> None:
    vendedor = _POR_ID[vendedor_id]
    assert vendedor.afinidade(categoria) == afinidade
    assert vendedor.precisao_para(categoria) == precisao


def test_afinidades_so_usam_categorias_oficiais_e_nunca_pior_que_adivinhar() -> None:
    for v in VENDEDORES:
        assert (v.especialidades | v.pontos_fracos) <= set(CATEGORIAS_PERGUNTA_JOGO)
        assert not (v.especialidades & v.pontos_fracos)
        if v.especialidades:
            assert v.precisao_especialidade > v.precisao
        if v.pontos_fracos:
            assert 0.25 < v.precisao_fraca < v.precisao


def test_listar_devolve_a_certeza_para_a_categoria_da_pergunta_em_curso(ambiente) -> None:
    _, perguntas, _, _, partidas = ambiente
    perguntas.adicionar("p-doenca", "C", nivel_dificuldade=1, categoria="doencas_estrabismo")
    _na_pergunta(partidas, "u1", "p-doenca")

    mercado = _servico(ambiente).listar("u1")

    assert mercado.categoria == "doencas_estrabismo"
    por_id = {e.vendedor.id: e for e in mercado.vendedores}
    assert (por_id["oftalmologista"].afinidade, por_id["oftalmologista"].precisao) == ("especialista", 0.98)
    assert (por_id["estudante-medicina"].afinidade, por_id["estudante-medicina"].precisao) == ("fraco", 0.35)
    assert (por_id["enfermeira-oftalmica"].afinidade, por_id["enfermeira-oftalmica"].precisao) == ("neutro", 0.70)


def test_listar_sem_partida_mostra_a_certeza_base(ambiente) -> None:
    mercado = _servico(ambiente).listar("sem-partida")
    assert mercado.categoria is None
    assert [e.precisao for e in mercado.vendedores] == [v.precisao for v in VENDEDORES]


def test_comprar_usa_a_certeza_da_categoria(ambiente) -> None:
    # 0.60: acima da certeza fraca do estudante (0.35, doenças), abaixo da
    # especialidade (0.75, anatomia) -- acerta numa, erra na outra.
    perfis, perguntas, _, _, partidas = ambiente
    perfis.creditar_diamantes("u1", 100)
    perfis.creditar_diamantes("u2", 100)
    perguntas.adicionar("p-anatomia", "C", nivel_dificuldade=1, categoria="anatomia_ocular")
    perguntas.adicionar("p-doenca", "C", nivel_dificuldade=1, categoria="doencas_estrabismo")
    _na_pergunta(partidas, "u1", "p-anatomia")
    _na_pergunta(partidas, "u2", "p-doenca")

    servico = _servico(ambiente, AleatorioFixo(0.60))

    assert servico.comprar("u1", "estudante-medicina", "p-anatomia").resposta_sugerida == "C"
    assert servico.comprar("u2", "estudante-medicina", "p-doenca").resposta_sugerida != "C"
