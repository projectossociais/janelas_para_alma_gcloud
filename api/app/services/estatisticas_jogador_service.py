"""Perfil do jogador do jogo "Inclusivamente": nível, totais e estatísticas
por categoria de pergunta.

Só leitura -- nada aqui altera saldo nem progresso. O nível sai sempre do
total de patamares superados que o próprio servidor contou ao terminar cada
partida (`perfis_jogador.patamares_superados_total`), nunca do cliente.
"""

from dataclasses import dataclass

from app.repositories.estatisticas_jogo_repository import EstatisticasJogoRepository
from app.repositories.orm_models import CATEGORIAS_PERGUNTA_JOGO
from app.repositories.perfil_jogador_repository import PerfilJogadorRegisto, PerfilJogadorRepository


@dataclass(frozen=True)
class NivelJogador:
    numero: int
    id: str
    # Patamares superados (acumulados) a partir dos quais se está neste nível.
    minimo: int


# Decisão do dono do projecto (2026-09-24), por patamares superados no total:
# 0-15 Iniciante, 16-45 Aprendiz, 46-90 Conhecedor, 91-150 Especialista,
# mais de 150 Mestre da Visão.
NIVEIS: tuple[NivelJogador, ...] = (
    NivelJogador(1, "iniciante", 0),
    NivelJogador(2, "aprendiz", 16),
    NivelJogador(3, "conhecedor", 46),
    NivelJogador(4, "especialista", 91),
    NivelJogador(5, "mestre_visao", 151),
)


@dataclass(frozen=True)
class ProgressoNivel:
    nivel: NivelJogador
    patamares_total: int
    # Mínimo do nível seguinte; `None` no último nível.
    proximo_minimo: int | None
    # 0 a 1 -- quanto já se andou entre o mínimo deste nível e o do seguinte.
    progresso: float


def calcular_nivel(patamares_total: int) -> ProgressoNivel:
    total = max(0, patamares_total)
    indice = max(i for i, n in enumerate(NIVEIS) if total >= n.minimo)
    nivel = NIVEIS[indice]
    if indice == len(NIVEIS) - 1:
        return ProgressoNivel(nivel, total, None, 1.0)
    proximo = NIVEIS[indice + 1].minimo
    return ProgressoNivel(nivel, total, proximo, (total - nivel.minimo) / (proximo - nivel.minimo))


@dataclass(frozen=True)
class EstatisticaCategoria:
    categoria: str
    respostas: int
    acertos: int

    @property
    def taxa_acerto(self) -> float:
        """0 a 1; 0 quando ainda não respondeu a nenhuma desta categoria."""
        return self.acertos / self.respostas if self.respostas else 0.0


@dataclass(frozen=True)
class EstatisticasJogador:
    perfil: PerfilJogadorRegisto
    nivel: ProgressoNivel
    # Sempre as 6 categorias, pela ordem oficial -- as que ainda não têm
    # respostas vêm a zero.
    categorias: list[EstatisticaCategoria]


class EstatisticasJogadorService:
    def __init__(self, perfis: PerfilJogadorRepository, estatisticas: EstatisticasJogoRepository) -> None:
        self._perfis = perfis
        self._estatisticas = estatisticas

    def obter(self, utilizador_id: str) -> EstatisticasJogador:
        perfil = self._perfis.obter_ou_criar(utilizador_id)
        por_categoria = {e.categoria: e for e in self._estatisticas.listar_por_categoria(utilizador_id)}
        categorias = [
            EstatisticaCategoria(
                categoria=c,
                respostas=por_categoria[c].respostas if c in por_categoria else 0,
                acertos=por_categoria[c].acertos if c in por_categoria else 0,
            )
            for c in CATEGORIAS_PERGUNTA_JOGO
        ]
        return EstatisticasJogador(perfil, calcular_nivel(perfil.patamares_superados_total), categorias)
