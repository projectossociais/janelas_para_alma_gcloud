"""Regra de decisão do rastreio com o motor próprio (docs/MOTOR_ANALISE_RASTREIO.md §7).

O telemóvel mede (posição do reflexo da luz em cada olho, convertida em dioptrias
prismáticas, Δ); esta regra decide o que isso quer dizer. Vive aqui, e não no
browser, porque é um resultado clínico (CLAUDE.md §3): fica num só sítio, com
versão gravada em cada rastreio e testes.

Três conclusões, as mesmas do ecrã de resultados:

- ``encaminhar``: desvio igual ou acima do limiar (horizontal ou vertical).
- ``sem_sinais``: medição fiável e abaixo dos limiares.
- ``nao_mediu``: o motor falhou, faltaram fotografias válidas, as fotografias
  discordaram, ou o valor é impossível. **Nunca** se responde "sem sinais" sem uma
  medição fiável.

**Limiares provisórios.** A AAPOS (2021) pede que se detecte qualquer estrabismo
manifesto > 8 Δ. Enquanto não houver estudo clínico com crianças angolanas (fase V3),
o limiar fica abaixo disso, aceitando mais falsos positivos para perder menos casos.
Os valores definitivos fixam-se com o oftalmologista no fim da V3; quando mudarem,
sobe-se ``VERSAO_REGRA``.
"""

import math
from dataclasses import dataclass
from typing import Literal

VERSAO_REGRA = "jpa-regra-rastreio/2026-10-provisoria"

LIMIAR_HORIZONTAL_DELTA = 6.0
LIMIAR_VERTICAL_DELTA = 6.0
FOTOGRAFIAS_VALIDAS_MINIMAS = 2
# Igual ao portão do motor (frontend/src/lib/rastreio/analise/sessao.ts): a regra
# volta a verificá-lo, porque as medições chegam do browser.
DISPERSAO_MAXIMA_DELTA = 3.0
# Acima disto o reflexo estaria fora da córnea: é erro de medição, não desvio.
DESVIO_MAXIMO_PLAUSIVEL_DELTA = 80.0

Conclusao = Literal["encaminhar", "sem_sinais", "nao_mediu"]


@dataclass(frozen=True)
class MedicoesRastreio:
    """O que o motor no telemóvel mediu numa sessão (várias fotografias)."""

    horizontal_delta: float
    vertical_delta: float
    dispersao_delta: float
    fotografias_validas: int
    fotografias_total: int
    # Motivo de falha do motor (ex.: "sem-reflexo"), ou None se mediu.
    falha: str | None
    versao_motor: str


@dataclass(frozen=True)
class Classificacao:
    conclusao: Conclusao
    # Porquê (ex.: "desvio-horizontal", "medicoes-inconsistentes"), ou None.
    motivo: str | None
    versao_regra: str

    @property
    def diagnostico_registo(self) -> str | None:
        """Valor para ``screenings.diagnostico`` ("normal" / "requer_avaliacao").

        ``None`` quando não se mediu: um rastreio sem medição fiável nunca se grava
        como "normal".
        """
        return {"encaminhar": "requer_avaliacao", "sem_sinais": "normal"}.get(self.conclusao)


def _nao_mediu(motivo: str) -> Classificacao:
    return Classificacao(conclusao="nao_mediu", motivo=motivo, versao_regra=VERSAO_REGRA)


def classificar(m: MedicoesRastreio) -> Classificacao:
    if m.falha:
        return _nao_mediu(m.falha)
    if m.fotografias_validas < FOTOGRAFIAS_VALIDAS_MINIMAS:
        return _nao_mediu("poucas-fotografias-validas")
    numeros = (m.horizontal_delta, m.vertical_delta, m.dispersao_delta)
    if not all(math.isfinite(x) for x in numeros):
        return _nao_mediu("medicao-invalida")
    if m.dispersao_delta > DISPERSAO_MAXIMA_DELTA:
        return _nao_mediu("medicoes-inconsistentes")
    if max(abs(m.horizontal_delta), abs(m.vertical_delta)) > DESVIO_MAXIMO_PLAUSIVEL_DELTA:
        return _nao_mediu("medicao-implausivel")
    if abs(m.horizontal_delta) >= LIMIAR_HORIZONTAL_DELTA:
        return Classificacao(conclusao="encaminhar", motivo="desvio-horizontal", versao_regra=VERSAO_REGRA)
    if abs(m.vertical_delta) >= LIMIAR_VERTICAL_DELTA:
        return Classificacao(conclusao="encaminhar", motivo="desvio-vertical", versao_regra=VERSAO_REGRA)
    return Classificacao(conclusao="sem_sinais", motivo=None, versao_regra=VERSAO_REGRA)
