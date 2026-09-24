"""Mercado do jogo "Inclusivamente" -- ajuda paga por diamantes.

Cada vendedor ambulante vende uma sugestão de resposta para a pergunta em
curso. Quanto mais caro o vendedor, maior a probabilidade de a sugestão
estar certa (`precisao`). Depois de vender, fica bloqueado para esse jogador
durante `DURACAO_BLOQUEIO` (4 horas, UTC).

A pergunta de sempre (CLAUDE.md secção 3): "o utilizador podia mentir sobre
isto?" -- sim, sobre o custo, o saldo e o bloqueio. Por isso tudo isto vive
aqui: o cliente só diz a que vendedor quer comprar e para que pergunta; o
preço, a precisão e o bloqueio saem sempre do catálogo abaixo, e o débito e
o bloqueio são gravados juntos e de forma atómica
(`MercadoJogoRepository.debitar_e_bloquear`).

Os nomes e as falas dos vendedores (Tio Zé, Mana Fefa...) vivem nas
traduções do frontend, chaveados pelo `id` -- o servidor só conhece o id,
o custo e a precisão.
"""

import random
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.repositories.jogo_repository import PerguntaJogoRepository
from app.repositories.mercado_jogo_repository import MercadoJogoRepository
from app.repositories.perfil_jogador_repository import PerfilJogadorRegisto
from app.services.jogo_service import PerguntaNaoEncontradaError

OPCOES = ("A", "B", "C", "D")

DURACAO_BLOQUEIO = timedelta(hours=4)


@dataclass(frozen=True)
class VendedorAmbulante:
    id: str
    custo_diamantes: int
    # Probabilidade (0-1) de a sugestão vendida ser a resposta certa.
    precisao: float


# Do mais barato ao mais caro. Equilíbrio com o que o jogador ganha: uma
# partida boa dá dezenas de diamantes (marcos + sequências de acertos), o
# pacote pequeno da loja dá 50 -- o vendedor mais fiável custa quase isso.
VENDEDORES: tuple[VendedorAmbulante, ...] = (
    VendedorAmbulante(id="tio-ze", custo_diamantes=5, precisao=0.50),
    VendedorAmbulante(id="mana-fefa", custo_diamantes=12, precisao=0.70),
    VendedorAmbulante(id="dona-maria", custo_diamantes=25, precisao=0.85),
    VendedorAmbulante(id="kota-beto", custo_diamantes=45, precisao=0.95),
)


class VendedorInexistenteError(Exception):
    def __init__(self, vendedor_id: str) -> None:
        super().__init__(f"vendedor inexistente: {vendedor_id}")
        self.vendedor_id = vendedor_id


class VendedorBloqueadoError(Exception):
    def __init__(self, disponivel_em: datetime | None) -> None:
        super().__init__(f"vendedor bloqueado até {disponivel_em}")
        self.disponivel_em = disponivel_em


class DiamantesInsuficientesError(Exception):
    def __init__(self, custo: int) -> None:
        super().__init__(f"diamantes insuficientes (custo: {custo})")
        self.custo = custo


@dataclass(frozen=True)
class EstadoVendedor:
    vendedor: VendedorAmbulante
    # `None` quando o vendedor está disponível agora.
    disponivel_em: datetime | None


@dataclass(frozen=True)
class AjudaVendida:
    vendedor_id: str
    resposta_sugerida: str
    disponivel_em: datetime
    perfil: PerfilJogadorRegisto


def _agora_utc() -> datetime:
    return datetime.now(UTC)


class MercadoJogoService:
    def __init__(
        self,
        mercado: MercadoJogoRepository,
        perguntas: PerguntaJogoRepository,
        relogio: Callable[[], datetime] = _agora_utc,
        aleatorio: random.Random | None = None,
    ) -> None:
        self._mercado = mercado
        self._perguntas = perguntas
        self._relogio = relogio
        self._aleatorio = aleatorio or random.SystemRandom()

    def agora(self) -> datetime:
        return self._relogio()

    def listar(self, utilizador_id: str) -> list[EstadoVendedor]:
        agora = self._relogio()
        bloqueios = self._mercado.listar_bloqueios(utilizador_id)
        estados = []
        for vendedor in VENDEDORES:
            ate = bloqueios.get(vendedor.id)
            estados.append(EstadoVendedor(vendedor=vendedor, disponivel_em=ate if ate and ate > agora else None))
        return estados

    def comprar(
        self,
        utilizador_id: str,
        vendedor_id: str,
        pergunta_id: str,
        opcoes_excluidas: Iterable[str] = (),
    ) -> AjudaVendida:
        """`opcoes_excluidas` são as opções já escondidas no ecrã (ex.: pelo
        50:50) -- um vendedor que erra não sugere uma opção que o jogador
        já nem vê. Mentir sobre isto só prejudica quem mente: a sugestão
        certa continua a ser dada com a mesma probabilidade."""
        vendedor = next((v for v in VENDEDORES if v.id == vendedor_id), None)
        if vendedor is None:
            raise VendedorInexistenteError(vendedor_id)
        pergunta = self._perguntas.obter_por_id(pergunta_id)
        if pergunta is None:
            raise PerguntaNaoEncontradaError(pergunta_id)

        agora = self._relogio()
        disponivel_em = agora + DURACAO_BLOQUEIO
        resultado = self._mercado.debitar_e_bloquear(
            utilizador_id, vendedor.id, vendedor.custo_diamantes, agora, disponivel_em
        )
        if resultado.estado == "em_bloqueio":
            raise VendedorBloqueadoError(resultado.disponivel_em)
        if resultado.estado == "saldo_insuficiente" or resultado.perfil is None:
            raise DiamantesInsuficientesError(vendedor.custo_diamantes)

        return AjudaVendida(
            vendedor_id=vendedor.id,
            resposta_sugerida=self._sugerir(vendedor, pergunta.resposta_correta, set(opcoes_excluidas)),
            disponivel_em=disponivel_em,
            perfil=resultado.perfil,
        )

    def _sugerir(self, vendedor: VendedorAmbulante, correta: str, excluidas: set[str]) -> str:
        if self._aleatorio.random() < vendedor.precisao:
            return correta
        erradas = [o for o in OPCOES if o != correta]
        visiveis = [o for o in erradas if o not in excluidas]
        return self._aleatorio.choice(visiveis or erradas)
