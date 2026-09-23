"""Quem pode fazer que exercício — lógica de acesso pago, por isso vive num
service com testes (CLAUDE.md §3/§10).

Modelo (decidido pelo dono do projecto, 2026-09-23): os 8 exercícios são
todos pagos.
- Admin e Premium válido: os 8, sem limite.
- Trial activo (7 dias, uma vez por conta): só os 4 `EXERCICIOS_TRIAL`.
- Trial terminado ou nunca iniciado: nenhum.

Os ids são os que o frontend já grava em `sessoes_exercicio.exercicio_id`
— não mudar sem migrar os dados existentes.

O que o utilizador podia falsear e é recusado aqui (nunca só na interface):
- gravar sessões / pedir o vídeo de um exercício sem direito → sem acesso
- iniciar o trial uma segunda vez (ganhava mais 7 dias) → `TrialJaUtilizadoError`
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import Enum
from typing import Protocol

from app.repositories.acesso_exercicios_repository import (
    AcessoExerciciosRepository,
    EstadoAcessoRegisto,
)

TRIAL_DURACAO_DIAS = 7

EXERCICIOS_TRIAL: tuple[str, ...] = ("figure8", "convergence", "cerebro", "relax")
EXERCICIOS_PREMIUM: tuple[str, ...] = (
    "ambliopia",
    "sacadas-convergencia",
    "flexibilidade-acomodativa",
    "estereopsia",
)
TODOS_OS_EXERCICIOS: tuple[str, ...] = EXERCICIOS_TRIAL + EXERCICIOS_PREMIUM

# Os vídeos do personagem animado vivem num prefixo privado do bucket — só
# acessíveis por URL assinado, nunca pelo domínio público do R2.
PREFIXO_VIDEOS = "videos-exercicios"


class EstadoAcesso(str, Enum):
    premium = "premium"
    trial_disponivel = "trial_disponivel"
    trial_ativo = "trial_ativo"
    trial_terminado = "trial_terminado"


class ContaNaoEncontradaError(Exception):
    pass


class TrialJaUtilizadoError(Exception):
    pass


class ExercicioDesconhecidoError(Exception):
    pass


class SemAcessoAoExercicioError(Exception):
    pass


class PresignerDeLeitura(Protocol):
    def url_de_leitura(self, chave: str) -> str: ...


@dataclass(frozen=True)
class AcessoExercicios:
    estado: EstadoAcesso
    exercicios_desbloqueados: tuple[str, ...]
    trial_iniciado_em: datetime | None
    trial_termina_em: datetime | None
    # Dias que faltam, arredondados para cima (6 dias e 2 horas → 7): o
    # banner nunca diz "0 dias" enquanto ainda há acesso.
    trial_dias_restantes: int | None


def _premium_valido(conta: EstadoAcessoRegisto, agora: datetime) -> bool:
    return (
        conta.premium_ativo
        and conta.premium_expira_em is not None
        and conta.premium_expira_em > agora
    )


class AcessoExerciciosService:
    def __init__(
        self,
        repositorio: AcessoExerciciosRepository,
        relogio=lambda: datetime.now(UTC),
    ) -> None:
        self._repo = repositorio
        self._agora = relogio

    def _conta(self, utilizador_id: str) -> EstadoAcessoRegisto:
        conta = self._repo.obter(utilizador_id)
        if conta is None:
            raise ContaNaoEncontradaError(utilizador_id)
        return conta

    def obter_acesso(self, utilizador_id: str) -> AcessoExercicios:
        conta = self._conta(utilizador_id)
        agora = self._agora()

        if conta.papel == "admin" or _premium_valido(conta, agora):
            estado, desbloqueados = EstadoAcesso.premium, TODOS_OS_EXERCICIOS
        elif conta.trial_iniciado_em is None:
            estado, desbloqueados = EstadoAcesso.trial_disponivel, ()
        elif conta.trial_termina_em is not None and conta.trial_termina_em > agora:
            estado, desbloqueados = EstadoAcesso.trial_ativo, EXERCICIOS_TRIAL
        else:
            estado, desbloqueados = EstadoAcesso.trial_terminado, ()

        dias_restantes = None
        if estado is EstadoAcesso.trial_ativo and conta.trial_termina_em is not None:
            restante = conta.trial_termina_em - agora
            dias_restantes = restante.days + (1 if restante % timedelta(days=1) else 0)

        return AcessoExercicios(
            estado=estado,
            exercicios_desbloqueados=desbloqueados,
            trial_iniciado_em=conta.trial_iniciado_em,
            trial_termina_em=conta.trial_termina_em,
            trial_dias_restantes=dias_restantes,
        )

    def iniciar_trial(self, utilizador_id: str) -> AcessoExercicios:
        conta = self._conta(utilizador_id)
        if conta.trial_iniciado_em is not None:
            raise TrialJaUtilizadoError(utilizador_id)
        inicio = self._agora()
        fim = inicio + timedelta(days=TRIAL_DURACAO_DIAS)
        # A condição "ainda não iniciado" é reverificada no próprio UPDATE —
        # a verificação acima sozinha perderia uma corrida entre dois pedidos.
        if not self._repo.iniciar_trial(utilizador_id, inicio, fim):
            raise TrialJaUtilizadoError(utilizador_id)
        return self.obter_acesso(utilizador_id)

    def verificar_acesso(self, utilizador_id: str, exercicio_id: str) -> None:
        if exercicio_id not in TODOS_OS_EXERCICIOS:
            raise ExercicioDesconhecidoError(exercicio_id)
        if exercicio_id not in self.obter_acesso(utilizador_id).exercicios_desbloqueados:
            raise SemAcessoAoExercicioError(exercicio_id)

    def url_do_video(
        self, utilizador_id: str, exercicio_id: str, presigner: PresignerDeLeitura
    ) -> str:
        """URL assinado, de curta duração, para o vídeo do exercício — só
        depois de confirmar o acesso. O id vem sempre da lista fechada
        `TODOS_OS_EXERCICIOS`, nunca é concatenado cru numa chave do bucket."""
        self.verificar_acesso(utilizador_id, exercicio_id)
        return presigner.url_de_leitura(f"{PREFIXO_VIDEOS}/{exercicio_id}.mp4")
