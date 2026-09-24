"""Regras de negócio do jogo "Você Sabia Que...".

A pergunta de sempre (CLAUDE.md secção 3): "o utilizador podia mentir sobre
isto?" -- sim, sobre o patamar alcançado. Antes desta correcção (2026-09-23),
`POST /jogo/recompensas` aceitava `patamar_alcancado` directo do corpo do
pedido; um pedido forjado dava o prémio máximo sem nunca responder a uma
pergunta. Aqui o patamar em curso só avança quando `responder` confirma, no
servidor, que a resposta está certa **e** que a pergunta é do nível esperado
para o próximo patamar -- nunca aceite tal e qual do cliente.
"""

import random
from dataclasses import dataclass

from app.repositories.jogo_repository import (
    PerguntaJogoRegisto,
    PerguntaJogoRepository,
    nivel_dificuldade_do_patamar,
)
from app.repositories.perfil_jogador_repository import (
    PerfilJogadorRegisto,
    PerfilJogadorRepository,
    calcular_recompensa,
)


OPCOES = ("A", "B", "C", "D")


class PerguntaNaoEncontradaError(Exception):
    def __init__(self, pergunta_id: str) -> None:
        super().__init__(f"pergunta não encontrada: {pergunta_id}")
        self.pergunta_id = pergunta_id


@dataclass(frozen=True)
class ResultadoResposta:
    correta: bool
    resposta_correta: str
    explicacao: str | None


class JogoService:
    def __init__(self, perguntas: PerguntaJogoRepository, perfis: PerfilJogadorRepository) -> None:
        self._perguntas = perguntas
        self._perfis = perfis

    def responder(
        self, utilizador_id: str | None, pergunta_id: str, resposta_usuario: str
    ) -> ResultadoResposta:
        """Valida a resposta. Sem sessão (`utilizador_id is None`), só
        valida -- não há perfil para rastrear progresso, e sem sessão não há
        como reclamar recompensa de qualquer forma (`/jogo/recompensas`
        exige sessão). Com sessão, o progresso só avança se a pergunta
        respondida for do nível esperado para o próximo patamar -- reutilizar
        uma pergunta de nível errado (ex.: um pedido forjado) não conta."""
        pergunta = self._perguntas.obter_por_id(pergunta_id)
        if pergunta is None:
            raise PerguntaNaoEncontradaError(pergunta_id)

        correta = resposta_usuario == pergunta.resposta_correta

        if utilizador_id is not None:
            perfil = self._perfis.obter_ou_criar(utilizador_id)
            proximo_patamar = perfil.patamar_em_curso + 1
            nivel_esperado = nivel_dificuldade_do_patamar(proximo_patamar)
            if correta and pergunta.nivel_dificuldade == nivel_esperado:
                self._perfis.atualizar_patamar_em_curso(utilizador_id, proximo_patamar)
            elif not correta:
                # Errou -- a partida em curso acaba, o progresso perde-se.
                self._perfis.atualizar_patamar_em_curso(utilizador_id, 0)
            # Acertou mas a pergunta não era do nível esperado: mostra-se a
            # resposta normalmente, mas não conta para o patamar em curso
            # (nem prémio nem penalização).

        return ResultadoResposta(
            correta=correta,
            resposta_correta=pergunta.resposta_correta,
            explicacao=pergunta.explicacao,
        )

    def esgotar_tempo(self, utilizador_id: str | None, pergunta_id: str) -> ResultadoResposta:
        """O tempo acabou sem resposta -- conta sempre como errada. Antes
        disto (2026-09-24) o cliente enviava "A" a `responder`; quando "A"
        era a certa, o servidor avançava o progresso e pagava uma recompensa
        por uma pergunta que o jogador nunca respondeu."""
        pergunta = self._obter(pergunta_id)
        if utilizador_id is not None:
            self._perfis.atualizar_patamar_em_curso(utilizador_id, 0)
        return ResultadoResposta(
            correta=False,
            resposta_correta=pergunta.resposta_correta,
            explicacao=pergunta.explicacao,
        )

    # --- Ajudas grátis ------------------------------------------------------
    #
    # Antes disto (2026-09-24) o 50:50 e a Opinião do Público chamavam
    # `responder` com "A" para descobrir a resposta certa -- e quando "A"
    # estava errada o servidor punha o progresso a 0, apagando a recompensa
    # da partida. Agora têm endpoints próprios que nunca mexem no progresso.
    #
    # Deterministas por pergunta (semente = id da pergunta): repetir o pedido
    # devolve sempre o mesmo resultado, por isso não dá para somar várias
    # sondagens até a resposta certa sobressair.

    def cinquenta_cinquenta(self, pergunta_id: str) -> list[str]:
        """Duas opções erradas a esconder, por ordem alfabética."""
        pergunta = self._obter(pergunta_id)
        erradas = [o for o in OPCOES if o != pergunta.resposta_correta]
        return sorted(random.Random(f"5050:{pergunta_id}").sample(erradas, 2))

    def opiniao_publico(self, pergunta_id: str) -> dict[str, int]:
        """Sondagem simulada: a certa entre 55% e 75%, o resto repartido
        pelas outras três (nunca 0%), soma sempre 100."""
        pergunta = self._obter(pergunta_id)
        gerador = random.Random(f"publico:{pergunta_id}")
        correta = pergunta.resposta_correta
        percentagem_correta = gerador.randint(55, 75)
        restantes = [o for o in OPCOES if o != correta]
        pesos = [gerador.random() + 0.1 for _ in restantes]
        disponivel = 100 - percentagem_correta
        valores = [max(1, round(p / sum(pesos) * disponivel)) for p in pesos]
        # Acerta o arredondamento na maior das erradas, para a soma dar 100.
        maior = valores.index(max(valores))
        valores[maior] += disponivel - sum(valores)
        resultado = {correta: percentagem_correta}
        resultado.update(zip(restantes, valores, strict=True))
        return {o: resultado[o] for o in OPCOES}

    def _obter(self, pergunta_id: str) -> PerguntaJogoRegisto:
        pergunta = self._perguntas.obter_por_id(pergunta_id)
        if pergunta is None:
            raise PerguntaNaoEncontradaError(pergunta_id)
        return pergunta

    def reclamar_recompensa(self, utilizador_id: str) -> PerfilJogadorRegisto:
        """O patamar pago é sempre o que o servidor rastreou -- nunca um
        valor vindo do corpo do pedido (ver docstring do módulo)."""
        perfil = self._perfis.obter_ou_criar(utilizador_id)
        patamar_alcancado = perfil.patamar_em_curso
        moedas_ganhas, diamantes_ganhos = calcular_recompensa(patamar_alcancado)
        return self._perfis.registar_recompensa(
            utilizador_id, moedas_ganhas, diamantes_ganhos, patamar_alcancado
        )
