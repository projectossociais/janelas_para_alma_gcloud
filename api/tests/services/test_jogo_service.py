"""Testes do `JogoService` -- a mentira que este serviço existe para
impedir: um utilizador a reclamar uma recompensa maior do que o patamar que
realmente alcançou, respondendo perguntas correctamente no servidor."""

import pytest

from app.repositories.jogo_repository import PerguntaJogoRegisto
from app.repositories.perfil_jogador_repository import PerfilJogadorRegisto
from app.services.jogo_service import JogoService, PerguntaNaoEncontradaError


class RepositorioPerguntasFalso:
    def __init__(self) -> None:
        self._perguntas: dict[str, PerguntaJogoRegisto] = {}

    def adicionar(self, pergunta_id: str, resposta_correta: str, nivel_dificuldade: int) -> None:
        self._perguntas[pergunta_id] = PerguntaJogoRegisto(
            id=pergunta_id,
            texto_pergunta="pergunta",
            opcao_a="A",
            opcao_b="B",
            opcao_c="C",
            opcao_d="D",
            resposta_correta=resposta_correta,
            nivel_dificuldade=nivel_dificuldade,
            explicacao="explicação",
        )

    def obter_aleatoria(self, nivel_dificuldade: int | None = None) -> PerguntaJogoRegisto | None:
        raise NotImplementedError

    def obter_por_id(self, pergunta_id: str) -> PerguntaJogoRegisto | None:
        return self._perguntas.get(pergunta_id)

    def criar(self, *a, **k) -> PerguntaJogoRegisto:
        raise NotImplementedError


class RepositorioPerfisFalso:
    def __init__(self) -> None:
        self._perfis: dict[str, PerfilJogadorRegisto] = {}

    def obter_ou_criar(self, utilizador_id: str) -> PerfilJogadorRegisto:
        if utilizador_id not in self._perfis:
            self._perfis[utilizador_id] = PerfilJogadorRegisto(
                id=f"perfil-{utilizador_id}",
                utilizador_id=utilizador_id,
                moedas=0,
                diamantes=0,
                partidas_jogadas=0,
                patamar_maximo_alcancado=0,
                patamar_em_curso=0,
            )
        return self._perfis[utilizador_id]

    def atualizar_patamar_em_curso(self, utilizador_id: str, patamar_em_curso: int) -> PerfilJogadorRegisto:
        atual = self.obter_ou_criar(utilizador_id)
        novo = PerfilJogadorRegisto(**{**atual.__dict__, "patamar_em_curso": patamar_em_curso})
        self._perfis[utilizador_id] = novo
        return novo

    def registar_recompensa(
        self, utilizador_id: str, moedas_ganhas: int, diamantes_ganhos: int, patamar_alcancado: int
    ) -> PerfilJogadorRegisto:
        atual = self.obter_ou_criar(utilizador_id)
        novo = PerfilJogadorRegisto(
            id=atual.id,
            utilizador_id=utilizador_id,
            moedas=atual.moedas + moedas_ganhas,
            diamantes=atual.diamantes + diamantes_ganhos,
            partidas_jogadas=atual.partidas_jogadas + 1,
            patamar_maximo_alcancado=max(atual.patamar_maximo_alcancado, patamar_alcancado),
            patamar_em_curso=0,
        )
        self._perfis[utilizador_id] = novo
        return novo


@pytest.fixture
def perguntas() -> RepositorioPerguntasFalso:
    return RepositorioPerguntasFalso()


@pytest.fixture
def perfis() -> RepositorioPerfisFalso:
    return RepositorioPerfisFalso()


@pytest.fixture
def servico(perguntas, perfis) -> JogoService:
    return JogoService(perguntas, perfis)


class TestResponder:
    def test_pergunta_inexistente_levanta_erro(self, servico) -> None:
        with pytest.raises(PerguntaNaoEncontradaError):
            servico.responder("u-1", "nao-existe", "A")

    def test_anonimo_valida_sem_tocar_em_nenhum_perfil(self, servico, perguntas, perfis) -> None:
        perguntas.adicionar("p1", "A", nivel_dificuldade=1)
        resultado = servico.responder(None, "p1", "A")
        assert resultado.correta is True
        assert perfis._perfis == {}

    def test_resposta_certa_no_nivel_esperado_avanca_o_patamar_em_curso(self, servico, perguntas, perfis) -> None:
        perguntas.adicionar("p1", "A", nivel_dificuldade=1)  # nível 1 == patamares 1-5
        resultado = servico.responder("u-1", "p1", "A")
        assert resultado.correta is True
        assert perfis.obter_ou_criar("u-1").patamar_em_curso == 1

    def test_resposta_errada_zera_o_patamar_em_curso(self, servico, perguntas, perfis) -> None:
        perguntas.adicionar("p1", "A", nivel_dificuldade=1)
        perguntas.adicionar("p2", "B", nivel_dificuldade=1)
        servico.responder("u-1", "p1", "A")  # avança para 1
        assert perfis.obter_ou_criar("u-1").patamar_em_curso == 1

        resultado = servico.responder("u-1", "p2", "errada")
        assert resultado.correta is False
        assert perfis.obter_ou_criar("u-1").patamar_em_curso == 0

    def test_resposta_certa_de_nivel_errado_nao_avanca_o_patamar(self, servico, perguntas, perfis) -> None:
        # O golpe que esta correcção existe para impedir: reutilizar uma
        # pergunta fácil (nível 1) depois de já se estar no patamar 6+
        # (nível 2 esperado) não deve continuar a inflacionar o progresso.
        perguntas.adicionar("facil", "A", nivel_dificuldade=1)
        perfis.atualizar_patamar_em_curso("u-1", 5)  # já esgotou o nível 1

        resultado = servico.responder("u-1", "facil", "A")

        assert resultado.correta is True  # a resposta em si está certa...
        assert perfis.obter_ou_criar("u-1").patamar_em_curso == 5  # ...mas não avança

    def test_responder_repetidamente_a_mesma_pergunta_facil_nao_ultrapassa_o_nivel(
        self, servico, perguntas, perfis
    ) -> None:
        perguntas.adicionar("facil", "A", nivel_dificuldade=1)
        for _ in range(10):
            servico.responder("u-1", "facil", "A")
        # Nível 1 só cobre os patamares 1-5 -- responder à mesma pergunta
        # fácil repetidamente pára em 5, nunca ultrapassa para o nível 2.
        assert perfis.obter_ou_criar("u-1").patamar_em_curso == 5


class TestReclamarRecompensa:
    def test_paga_com_base_no_patamar_rastreado_no_servidor_nunca_no_cliente(
        self, servico, perguntas, perfis
    ) -> None:
        perguntas.adicionar("p1", "A", nivel_dificuldade=1)
        for _ in range(3):
            servico.responder("u-1", "p1", "A")
        assert perfis.obter_ou_criar("u-1").patamar_em_curso == 3

        perfil = servico.reclamar_recompensa("u-1")

        assert perfil.moedas == 150  # 3 x 50, nunca um valor "reclamado" pelo cliente
        assert perfil.partidas_jogadas == 1

    def test_reclamar_sem_ter_respondido_nada_nao_paga_nada(self, servico) -> None:
        # O ataque original: chamar /jogo/recompensas directamente, sem
        # nunca ter chamado /jogo/validar.
        perfil = servico.reclamar_recompensa("u-1")
        assert perfil.moedas == 0
        assert perfil.diamantes == 0

    def test_reclamar_reinicia_o_patamar_em_curso_impedindo_reclamar_duas_vezes(
        self, servico, perguntas, perfis
    ) -> None:
        perguntas.adicionar("p1", "A", nivel_dificuldade=1)
        servico.responder("u-1", "p1", "A")

        primeira = servico.reclamar_recompensa("u-1")
        segunda = servico.reclamar_recompensa("u-1")

        assert primeira.moedas == 50
        assert segunda.moedas == 50  # nada ganho na segunda chamada
        assert segunda.partidas_jogadas == 2
