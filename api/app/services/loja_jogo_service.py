"""Loja de diamantes do jogo "Você Sabia Que...".

A pergunta de sempre (CLAUDE.md secção 3): "o utilizador podia mentir sobre
isto?" -- sim, sobre quantos diamantes um pacote dá e quanto custa. Por
isso o catálogo vive só aqui: o cliente só escolhe um `pacote_id`, e a
quantidade creditada sai sempre de `PACOTES_DIAMANTES`, nunca do pedido.

Pagamento ainda **simulado**: não há integração real (nem transferência com
comprovativo como no Premium, nem gateway). Enquanto for assim, a compra só
credita diamantes quando `pagamentos_simulados` está ligado -- em
desenvolvimento (`JOGO_PAGAMENTOS_SIMULADOS=true` no docker-compose). Em
produção fica desligado por omissão e a compra é recusada: sem isto, um
botão "Comprar" simulado seria diamantes grátis para qualquer conta.

Preços em Kz aprovados pelo dono do projecto em 2026-09-24. Qualquer
alteração exige de novo confirmação humana (CLAUDE.md secção 10).
"""

from dataclasses import dataclass

from app.repositories.perfil_jogador_repository import PerfilJogadorRegisto, PerfilJogadorRepository


@dataclass(frozen=True)
class PacoteDiamantes:
    id: str
    diamantes: int
    # Diamantes oferecidos por cima de `diamantes` -- já incluídos no total
    # creditado (`total_diamantes`), só separados para a loja os destacar.
    bonus: int
    preco_kz: int

    @property
    def total_diamantes(self) -> int:
        return self.diamantes + self.bonus


PACOTES_DIAMANTES: tuple[PacoteDiamantes, ...] = (
    PacoteDiamantes(id="pequeno", diamantes=50, bonus=0, preco_kz=500),
    PacoteDiamantes(id="medio", diamantes=150, bonus=15, preco_kz=1_250),
    PacoteDiamantes(id="grande", diamantes=400, bonus=80, preco_kz=3_000),
)


class PacoteInexistenteError(Exception):
    def __init__(self, pacote_id: str) -> None:
        super().__init__(f"pacote de diamantes inexistente: {pacote_id}")
        self.pacote_id = pacote_id


class PagamentosIndisponiveisError(Exception):
    """A compra foi pedida mas ainda não há forma real de pagar."""


class LojaJogoService:
    def __init__(self, perfis: PerfilJogadorRepository, pagamentos_simulados: bool) -> None:
        self._perfis = perfis
        self._pagamentos_simulados = pagamentos_simulados

    @property
    def pagamentos_simulados(self) -> bool:
        return self._pagamentos_simulados

    def listar_pacotes(self) -> tuple[PacoteDiamantes, ...]:
        return PACOTES_DIAMANTES

    def comprar(self, utilizador_id: str, pacote_id: str) -> PerfilJogadorRegisto:
        pacote = next((p for p in PACOTES_DIAMANTES if p.id == pacote_id), None)
        if pacote is None:
            raise PacoteInexistenteError(pacote_id)
        if not self._pagamentos_simulados:
            raise PagamentosIndisponiveisError()
        return self._perfis.creditar_diamantes(utilizador_id, pacote.total_diamantes)
