"""Loja de diamantes do jogo "Inclusivamente".

A pergunta de sempre (CLAUDE.md secção 3): "o utilizador podia mentir sobre
isto?" -- sim, sobre quantos diamantes um pacote dá, quanto custa e se já
pagou. Por isso o catálogo vive só aqui: o cliente só escolhe um
`pacote_id` (e o método), e a quantidade e o preço saem sempre de
`PACOTES_DIAMANTES`, nunca do pedido.

Duas formas de pagar cada pacote (2026-09-24):

- **Moedas do jogo** -- `comprar(..., metodo="moedas")`: débito das moedas e
  crédito dos diamantes numa só instrução atómica, só com saldo suficiente
  (`trocar_moedas_por_diamantes`). Preço em moedas deliberadamente alto: as
  moedas ganham-se a jogar (50 por patamar, 750 numa partida perfeita).
- **Kwanzas** -- o mesmo fluxo do Premium (`premium_service.py`), porque é o
  único pagamento real do projecto: transferência bancária, comprovativo
  enviado directamente ao R2, `pedir_com_kwanzas` grava um pedido pendente,
  e só `aprovar_pedido` (um admin que confirmou o pagamento) credita os
  diamantes -- na mesma transacção que marca o pedido como aprovado, uma
  única vez. É esta confirmação humana que faz de "webhook de liquidação":
  não há gateway nem cartão ligados ao projecto.

  Com `pagamentos_simulados` (só `docker-compose.yml` de desenvolvimento),
  `comprar(..., metodo="kwanzas")` credita logo, sem comprovativo; sem ele
  é recusado (`PagamentosIndisponiveisError`, 501) -- em produção os
  Kwanzas passam sempre pelo pedido com comprovativo.

Preços em Kz aprovados pelo dono do projecto em 2026-09-24; preços em
moedas pedidos pelo dono do projecto no mesmo dia (50 diamantes ~ 2.000
moedas). Qualquer alteração exige de novo confirmação humana (CLAUDE.md
secção 10).
"""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

from app.repositories.pedido_diamantes_repository import (
    PedidoAprovado,
    PedidoDiamantesRegisto,
    PedidoDiamantesRepository,
)
from app.repositories.perfil_jogador_repository import PerfilJogadorRegisto, PerfilJogadorRepository
from app.services.comprovativo_upload_service import url_publico_do_comprovativo

MetodoPagamento = Literal["moedas", "kwanzas"]


@dataclass(frozen=True)
class PacoteDiamantes:
    id: str
    diamantes: int
    # Diamantes oferecidos por cima de `diamantes` -- já incluídos no total
    # creditado (`total_diamantes`), só separados para a loja os destacar.
    bonus: int
    preco_kz: int
    preco_moedas: int

    @property
    def total_diamantes(self) -> int:
        return self.diamantes + self.bonus


PACOTES_DIAMANTES: tuple[PacoteDiamantes, ...] = (
    PacoteDiamantes(id="pequeno", diamantes=50, bonus=0, preco_kz=500, preco_moedas=2_000),
    PacoteDiamantes(id="medio", diamantes=150, bonus=15, preco_kz=1_250, preco_moedas=5_500),
    PacoteDiamantes(id="grande", diamantes=400, bonus=80, preco_kz=3_000, preco_moedas=14_000),
)


class PacoteInexistenteError(Exception):
    def __init__(self, pacote_id: str) -> None:
        super().__init__(f"pacote de diamantes inexistente: {pacote_id}")
        self.pacote_id = pacote_id


class PagamentosIndisponiveisError(Exception):
    """Pedido de crédito imediato em Kwanzas sem pagamentos simulados --
    em produção, os Kwanzas passam pelo pedido com comprovativo."""


class MoedasInsuficientesError(Exception):
    def __init__(self, custo: int) -> None:
        super().__init__(f"moedas insuficientes (custo: {custo})")
        self.custo = custo


class PedidoDiamantesNaoEncontradoError(Exception):
    pass


class PedidoDiamantesJaDecididoError(Exception):
    """Já aprovado ou rejeitado -- nunca se credita duas vezes."""


class PedidoDiamantesSemContaError(Exception):
    """A conta do pedido foi apagada -- não há a quem creditar."""


class LojaJogoService:
    def __init__(
        self,
        perfis: PerfilJogadorRepository,
        pedidos: PedidoDiamantesRepository,
        pagamentos_simulados: bool,
        relogio=lambda: datetime.now(UTC),
    ) -> None:
        self._perfis = perfis
        self._pedidos = pedidos
        self._pagamentos_simulados = pagamentos_simulados
        self._relogio = relogio

    @property
    def pagamentos_simulados(self) -> bool:
        return self._pagamentos_simulados

    def listar_pacotes(self) -> tuple[PacoteDiamantes, ...]:
        return PACOTES_DIAMANTES

    def _pacote(self, pacote_id: str) -> PacoteDiamantes:
        pacote = next((p for p in PACOTES_DIAMANTES if p.id == pacote_id), None)
        if pacote is None:
            raise PacoteInexistenteError(pacote_id)
        return pacote

    def comprar(self, utilizador_id: str, pacote_id: str, metodo: MetodoPagamento = "kwanzas") -> PerfilJogadorRegisto:
        """Compra com crédito imediato: por moedas (sempre) ou por Kwanzas
        simulados (só em desenvolvimento)."""
        pacote = self._pacote(pacote_id)
        if metodo == "moedas":
            self._perfis.obter_ou_criar(utilizador_id)
            perfil = self._perfis.trocar_moedas_por_diamantes(
                utilizador_id, pacote.preco_moedas, pacote.total_diamantes
            )
            if perfil is None:
                raise MoedasInsuficientesError(pacote.preco_moedas)
            return perfil
        if not self._pagamentos_simulados:
            raise PagamentosIndisponiveisError()
        return self._perfis.creditar_diamantes(utilizador_id, pacote.total_diamantes)

    # --- Kwanzas: pedido com comprovativo, confirmado por um admin ----------

    def pedir_com_kwanzas(self, utilizador_id: str, pacote_id: str, comprovativo_chave: str) -> PedidoDiamantesRegisto:
        """O comprovativo já foi enviado directamente ao R2 -- aqui só se
        confirma que a chave é mesmo um comprovativo (nunca um caminho
        arbitrário do bucket), como no Premium. Não credita nada."""
        pacote = self._pacote(pacote_id)
        comprovativo_url = url_publico_do_comprovativo(comprovativo_chave)
        return self._pedidos.criar(
            utilizador_id=utilizador_id,
            pacote_id=pacote.id,
            diamantes=pacote.total_diamantes,
            preco_kz=pacote.preco_kz,
            comprovativo_url=comprovativo_url,
        )

    def listar_pedidos_do_utilizador(self, utilizador_id: str) -> list[PedidoDiamantesRegisto]:
        return self._pedidos.listar_do_utilizador(utilizador_id)

    def listar_pedidos(self) -> list[PedidoDiamantesRegisto]:
        return self._pedidos.listar()

    def _pedido_pendente(self, pedido_id: str) -> PedidoDiamantesRegisto:
        pedido = self._pedidos.obter(pedido_id)
        if pedido is None:
            raise PedidoDiamantesNaoEncontradoError(pedido_id)
        if pedido.estado != "pendente":
            raise PedidoDiamantesJaDecididoError(pedido_id)
        return pedido

    def aprovar_pedido(self, pedido_id: str, admin_id: str) -> PedidoAprovado:
        """Pagamento confirmado: marca o pedido aprovado e credita os
        diamantes gravados nele, atomicamente e uma única vez. `admin_id`
        vem sempre do JWT (router), nunca do corpo do pedido."""
        pedido = self._pedido_pendente(pedido_id)
        if pedido.utilizador_id is None:
            raise PedidoDiamantesSemContaError(pedido_id)
        self._perfis.obter_ou_criar(pedido.utilizador_id)
        aprovado = self._pedidos.aprovar_e_creditar(pedido_id, admin_id, self._relogio())
        if aprovado is None:
            # Outro admin decidiu entretanto -- não se credita outra vez.
            raise PedidoDiamantesJaDecididoError(pedido_id)
        return aprovado

    def rejeitar_pedido(self, pedido_id: str, admin_id: str) -> PedidoDiamantesRegisto:
        self._pedido_pendente(pedido_id)
        rejeitado = self._pedidos.rejeitar(pedido_id, admin_id, self._relogio())
        if rejeitado is None:
            raise PedidoDiamantesJaDecididoError(pedido_id)
        return rejeitado
