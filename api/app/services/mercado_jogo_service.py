"""Consultório do jogo "Inclusivamente" (antes "Mercado") -- ajuda paga por
diamantes.

Cada profissional de saúde ocular dá uma opinião sobre a pergunta em curso. Quanto mais caro o vendedor, maior a probabilidade de a sugestão
estar certa (`precisao`) -- e essa certeza muda com a categoria da pergunta
(`VendedorAmbulante.precisao_para`): cada vendedor é especialista nuns temas
e está pouco à vontade noutros. Depois de vender, fica bloqueado para esse jogador
durante `DURACAO_BLOQUEIO` (4 horas, UTC).

A pergunta de sempre (CLAUDE.md secção 3): "o utilizador podia mentir sobre
isto?" -- sim, sobre o custo, o saldo e o bloqueio. Por isso tudo isto vive
aqui: o cliente só diz a que vendedor quer comprar e para que pergunta; o
preço, a precisão e o bloqueio saem sempre do catálogo abaixo, e o débito e
o bloqueio são gravados juntos e de forma atómica
(`MercadoJogoRepository.debitar_e_bloquear`).

Os nomes, profissões e falas (Estudante João, Enfermeira Marta...) vivem
nas traduções do frontend, chaveados pelo `id` -- o servidor só conhece o
id, o custo e a precisão.
"""

import random
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

from app.repositories.jogo_repository import PerguntaJogoRepository
from app.repositories.mercado_jogo_repository import MercadoJogoRepository
from app.repositories.partida_jogo_repository import PartidaJogoRepository
from app.repositories.perfil_jogador_repository import PerfilJogadorRegisto
from app.services.jogo_service import PerguntaForaDaPartidaError, PerguntaNaoEncontradaError

OPCOES = ("A", "B", "C", "D")

DURACAO_BLOQUEIO = timedelta(hours=4)


Afinidade = Literal["especialista", "neutro", "fraco"]


@dataclass(frozen=True)
class VendedorAmbulante:
    id: str
    custo_diamantes: int
    # Probabilidade (0-1) de a sugestão estar certa numa categoria neutra --
    # a "certeza base" que o Mercado mostra.
    precisao: float
    # Categorias em que o vendedor é especialista (mais certeza) ou está
    # pouco à vontade (menos certeza) -- ver `precisao_para`.
    especialidades: frozenset[str] = frozenset()
    precisao_especialidade: float = 0.0
    pontos_fracos: frozenset[str] = frozenset()
    precisao_fraca: float = 0.0

    def afinidade(self, categoria: str | None) -> Afinidade:
        if categoria in self.especialidades:
            return "especialista"
        if categoria in self.pontos_fracos:
            return "fraco"
        return "neutro"

    def precisao_para(self, categoria: str | None) -> float:
        """Certeza para uma pergunta desta categoria. Determinista: reabrir o
        Mercado para a mesma pergunta nunca "sorteia" uma certeza melhor."""
        return {
            "especialista": self.precisao_especialidade,
            "fraco": self.precisao_fraca,
            "neutro": self.precisao,
        }[self.afinidade(categoria)]


# O "Consultório" (2026-09-24; antes "Mercado", com vendedores ambulantes):
# quatro profissionais de saúde ocular, do mais barato ao mais caro.
# Equilíbrio com o que o jogador ganha: uma partida boa dá dezenas de
# diamantes (marcos + sequências de acertos), o pacote pequeno da loja dá 50
# -- a especialista mais fiável custa quase isso. Os ids, nomes, profissões
# e falas vivem nas traduções do frontend (`Mercado.vendedores.<id>`); o
# código interno continua a chamar-lhes "vendedores" e "Mercado" (endpoints
# e tabela `bloqueios_vendedores_jogo` inalterados).
#
# Afinidades por categoria -- o que cada profissão sabe de perto:
# - Estudante de Medicina: acabou de estudar anatomia e lê tudo o que é
#   curiosidade; ainda não viu casos clínicos (doenças e estrabismo).
# - Enfermeira Oftálmica: prática do consultório -- prevenção, cuidados e
#   hábitos do dia a dia; menos à vontade com ciência pura.
# - Optometrista: ciência da visão (óptica, refracção, acuidade); diagnosticar
#   e tratar doenças é trabalho do oftalmologista.
# - Oftalmologista Especialista: doenças e estrabismo são a sua clínica; os
#   hábitos do dia a dia são o tema em que está menos atenta.
VENDEDORES: tuple[VendedorAmbulante, ...] = (
    VendedorAmbulante(
        id="estudante-medicina",
        custo_diamantes=5,
        precisao=0.50,
        especialidades=frozenset({"anatomia_ocular", "curiosidades_visuais"}),
        precisao_especialidade=0.75,
        pontos_fracos=frozenset({"doencas_estrabismo"}),
        precisao_fraca=0.35,
    ),
    VendedorAmbulante(
        id="enfermeira-oftalmica",
        custo_diamantes=12,
        precisao=0.70,
        especialidades=frozenset({"prevencao_cuidados", "estilo_vida_visao"}),
        precisao_especialidade=0.85,
        pontos_fracos=frozenset({"ciencia_ocular"}),
        precisao_fraca=0.50,
    ),
    VendedorAmbulante(
        id="optometrista",
        custo_diamantes=25,
        precisao=0.85,
        especialidades=frozenset({"ciencia_ocular"}),
        precisao_especialidade=0.95,
        pontos_fracos=frozenset({"doencas_estrabismo"}),
        precisao_fraca=0.75,
    ),
    VendedorAmbulante(
        id="oftalmologista",
        custo_diamantes=45,
        precisao=0.90,
        especialidades=frozenset({"doencas_estrabismo"}),
        precisao_especialidade=0.98,
        pontos_fracos=frozenset({"estilo_vida_visao"}),
        precisao_fraca=0.80,
    ),
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
    # Certeza para a pergunta em curso (a base, se não houver pergunta).
    precisao: float
    afinidade: Afinidade


@dataclass(frozen=True)
class MercadoParaPergunta:
    # Categoria da pergunta em curso -- `None` sem pergunta por responder.
    categoria: str | None
    vendedores: list[EstadoVendedor]


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
        partidas: PartidaJogoRepository,
        relogio: Callable[[], datetime] = _agora_utc,
        aleatorio: random.Random | None = None,
    ) -> None:
        self._mercado = mercado
        self._perguntas = perguntas
        self._partidas = partidas
        self._relogio = relogio
        self._aleatorio = aleatorio or random.SystemRandom()

    def agora(self) -> datetime:
        return self._relogio()

    def listar(self, utilizador_id: str) -> MercadoParaPergunta:
        """Os vendedores com a certeza para a pergunta em curso (pela
        categoria dela) -- a mesma que `comprar` usa."""
        agora = self._relogio()
        bloqueios = self._mercado.listar_bloqueios(utilizador_id)
        categoria = self._categoria_em_curso(utilizador_id)
        estados = []
        for vendedor in VENDEDORES:
            ate = bloqueios.get(vendedor.id)
            estados.append(
                EstadoVendedor(
                    vendedor=vendedor,
                    disponivel_em=ate if ate and ate > agora else None,
                    precisao=vendedor.precisao_para(categoria),
                    afinidade=vendedor.afinidade(categoria),
                )
            )
        return MercadoParaPergunta(categoria=categoria, vendedores=estados)

    def _categoria_em_curso(self, utilizador_id: str) -> str | None:
        partida = self._partidas.obter_ativa(utilizador_id)
        if partida is None or partida.estado != "em_curso" or partida.pergunta_atual_id is None:
            return None
        pergunta = self._perguntas.obter_por_id(partida.pergunta_atual_id)
        return pergunta.categoria if pergunta is not None else None

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
        # Só a pergunta que a partida em curso entregou -- nunca uma qualquer.
        partida = self._partidas.obter_ativa(utilizador_id)
        if partida is None or partida.estado != "em_curso" or partida.pergunta_atual_id != pergunta_id:
            raise PerguntaForaDaPartidaError()
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
            resposta_sugerida=self._sugerir(
                vendedor.precisao_para(pergunta.categoria), pergunta.resposta_correta, set(opcoes_excluidas)
            ),
            disponivel_em=disponivel_em,
            perfil=resultado.perfil,
        )

    def _sugerir(self, precisao: float, correta: str, excluidas: set[str]) -> str:
        if self._aleatorio.random() < precisao:
            return correta
        erradas = [o for o in OPCOES if o != correta]
        visiveis = [o for o in erradas if o not in excluidas]
        return self._aleatorio.choice(visiveis or erradas)
