"""Rastreio completo com o motor próprio: classifica as medições e, com sessão e
consentimento, grava o resultado (docs/MOTOR_ANALISE_RASTREIO.md §7).

Duas decisões que vivem aqui e não no router (CLAUDE.md §3):

- **Convidados também recebem o resultado**, sem se gravar nada.
- **Só se grava quando houve medição.** Um "não mediu" não tem lugar em
  ``screenings.diagnostico`` (só "normal" / "requer_avaliacao"): gravá-lo como um
  dos dois seria dizer o que não se mediu.
"""

from dataclasses import dataclass
from typing import Protocol

from app.repositories.screening_repository import ScreeningRegisto
from app.services.classificacao_rastreio_service import (
    Classificacao,
    MedicoesRastreio,
    classificar,
)

ESTADO_MEDIDO = "OK"


class ScreeningsGravador(Protocol):
    def criar(
        self,
        user_id: str,
        estado: str,
        rosto_detetado: bool,
        requer_avaliacao_humana: bool,
        diagnostico: str,
        assimetria_horizontal: float | None,
        assimetria_vertical: float | None,
        qualidade_captura: float | None,
        qualidade_fiavel: bool | None,
        qualidade_motivos: list[str],
        medicoes: dict | None,
        versao_analise: str | None,
    ) -> ScreeningRegisto: ...


@dataclass(frozen=True)
class ResultadoRastreioCompleto:
    classificacao: Classificacao
    # Id do rastreio gravado, ou None (convidado, sem consentimento ou não mediu).
    screening_id: str | None


class RastreioCompletoService:
    def __init__(self, repo: ScreeningsGravador) -> None:
        self._repo = repo

    def classificar_e_registar(
        self, medicoes: MedicoesRastreio, user_id: str | None
    ) -> ResultadoRastreioCompleto:
        classificacao = classificar(medicoes)
        diagnostico = classificacao.diagnostico_registo
        if user_id is None or diagnostico is None:
            return ResultadoRastreioCompleto(classificacao, None)
        registo = self._repo.criar(
            user_id=user_id,
            estado=ESTADO_MEDIDO,
            rosto_detetado=True,
            requer_avaliacao_humana=classificacao.conclusao == "encaminhar",
            diagnostico=diagnostico,
            assimetria_horizontal=medicoes.horizontal_delta,
            assimetria_vertical=medicoes.vertical_delta,
            qualidade_captura=None,
            qualidade_fiavel=True,
            qualidade_motivos=[],
            medicoes={
                "unidade": "dioptrias_prismaticas",
                "horizontal_delta": medicoes.horizontal_delta,
                "vertical_delta": medicoes.vertical_delta,
                "dispersao_delta": medicoes.dispersao_delta,
                "fotografias_validas": medicoes.fotografias_validas,
                "fotografias_total": medicoes.fotografias_total,
                "conclusao": classificacao.conclusao,
                "motivo": classificacao.motivo,
            },
            versao_analise=f"{medicoes.versao_motor}|{classificacao.versao_regra}"[:100],
        )
        return ResultadoRastreioCompleto(classificacao, registo.id)
