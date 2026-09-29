"""Bónus de assiduidade dos treinos no jogo Inclusivamente (Fase B).

Decisão do dono do projecto (2026-09-29, docs/ANALISE_EXERCICIOS.md): 100
moedas no primeiro treino que conta de cada dia (de Luanda), mais 5 diamantes
quando a sequência de dias chega a um múltiplo de 7. É dinheiro do jogo --
decidido só aqui, nunca pelo corpo do pedido (CLAUDE.md §1, economia do jogo).

"O utilizador podia mentir sobre isto?" Sim: uma sessão é declarada pelo
browser. Por isso o bónus é limitado a uma vez por dia (chave única na base
de dados) e exige um treino real segundo as mesmas regras da dose: um dos 4
treinos, versão 2, pelo menos 1 minuto activo e sem baixa atenção. Gravar
sessões já exige acesso pago (Premium ou trial), por isso o ganho máximo
possível de uma fraude é o mesmo do uso honesto: 100 moedas por dia.
"""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.core.fuso import dia_em_luanda
from app.repositories.bonus_assiduidade_repository import BonusAssiduidadeRepository
from app.services.acesso_exercicios_service import IDS_TREINOS

MOEDAS_POR_DIA = 100
DIAMANTES_POR_MARCO = 5
DIAS_POR_MARCO = 7
SEGUNDOS_ACTIVOS_MINIMOS = 60


@dataclass(frozen=True)
class BonusAtribuido:
    moedas: int
    diamantes: int
    dias_seguidos: int


def conta_para_bonus(exercicio_id: str, versao: int, segundos_activos: int | None, sinais: dict | None) -> bool:
    return (
        exercicio_id in IDS_TREINOS
        and versao == 2
        and (segundos_activos or 0) >= SEGUNDOS_ACTIVOS_MINIMOS
        and (sinais or {}).get("baixa_atencao") is not True
    )


class BonusAssiduidadeService:
    def __init__(
        self,
        repositorio: BonusAssiduidadeRepository,
        relogio: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._repo = repositorio
        self._relogio = relogio

    def registar_treino(
        self,
        utilizador_id: str,
        exercicio_id: str,
        versao: int,
        segundos_activos: int | None,
        sinais: dict | None,
    ) -> BonusAtribuido | None:
        """Credita o bónus do dia, se este for o primeiro treino que conta hoje.
        `None` quando não conta ou quando o dia já tinha bónus."""
        if not conta_para_bonus(exercicio_id, versao, segundos_activos, sinais):
            return None
        hoje = dia_em_luanda(self._relogio())
        dias_seguidos = self._repo.dias_seguidos_ate(utilizador_id, hoje - timedelta(days=1)) + 1
        diamantes = DIAMANTES_POR_MARCO if dias_seguidos % DIAS_POR_MARCO == 0 else 0
        if not self._repo.creditar_dia(utilizador_id, hoje, MOEDAS_POR_DIA, diamantes):
            return None
        return BonusAtribuido(moedas=MOEDAS_POR_DIA, diamantes=diamantes, dias_seguidos=dias_seguidos)
