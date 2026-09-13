"""W-13/W-15 — sinal geométrico experimental a partir dos landmarks do
MediaPipe FaceMesh já extraídos no browser (`Scanner.tsx`).

**O que isto NÃO é**: um diagnóstico, uma percentagem de confiança clínica,
ou um substituto do método validado (Hirschberg/reflexo corneano) descrito em
`docs/SCANNER-METODO.md` (W-13). `requer_avaliacao_humana` é **sempre**
`True` — não existe, hoje, nenhum limiar validado que separe "normal" de
"desvio" a partir deste número (isso é o W-16, bloqueado por precisar de
casos reais com diagnóstico conhecido). Ver CLAUDE.md secção 11 e
docs/BACKLOG.md, Sprint 3.

**O que isto é**: a posição da íris dentro da própria abertura ocular, para
cada olho, na pose "center" (a única em que se assume que os dois olhos
fixam o mesmo ponto — nas poses "right"/"left" os dois olhos movem-se juntos
em versão, o que não serve para detectar um desvio). A diferença entre os
dois olhos é um sinal geométrico real, calculado a partir de coordenadas
reais — nunca `Math.random()` — mas não calibrado nem validado clinicamente.

Isto é lógica que o utilizador podia falsear (enviar landmarks fabricados
para simular qualquer resultado) e que decide o que aparece como "resultado"
de um exame de saúde — por isso vive aqui, com testes, e não no frontend
nem directamente no router (CLAUDE.md secção 3).
"""

import math
from dataclasses import dataclass, field
from typing import Literal

from app.repositories.screening_repository import (
    ScreeningCalculado,
    ScreeningRegisto,
    ScreeningRepository,
)

Pose = Literal["center", "right", "left"]

# Índices de landmarks do MediaPipe FaceMesh com refineLandmarks activo —
# mesmos usados em `frontend/src/hooks/useEyeTracking.ts` (EYE_A/EYE_B) e em
# `EyeLandmarkOverlay.tsx`. Mantidos em sincronia manualmente: não há um
# esquema partilhado entre o browser (JS) e a API (Python) para isto.
_OLHO_A = {"outer": 33, "inner": 133, "top": 159, "bottom": 145, "iris": 468}
_OLHO_B = {"outer": 362, "inner": 263, "top": 386, "bottom": 374, "iris": 473}

# Acima disto, a cabeça já não está suficientemente direita para o
# pressuposto "os dois olhos fixam o mesmo ponto" ser razoável.
LIMITE_INCLINACAO_GRAUS = 8.0
# Score de qualidade abaixo disto: não mostrar o número como algo em que se
# possa confiar, nem sequer como sinal técnico "normal".
LIMIAR_QUALIDADE_FIAVEL = 0.6


@dataclass(frozen=True)
class Ponto:
    x: float
    y: float
    z: float | None = None


@dataclass(frozen=True)
class PoseCapturada:
    pose: Pose
    landmarks: list[Ponto] = field(default_factory=list)


def _ponto(landmarks: list[Ponto], indice: int) -> Ponto | None:
    return landmarks[indice] if 0 <= indice < len(landmarks) else None


def _posicao_iris_na_abertura(landmarks: list[Ponto], olho: dict[str, int]) -> Ponto | None:
    """Onde a íris está dentro do rectângulo do próprio olho (0-1 em cada
    eixo). ~0.5 em ambos os eixos quando a íris está centrada na abertura."""
    outer, inner, top, bottom, iris = (
        _ponto(landmarks, olho["outer"]),
        _ponto(landmarks, olho["inner"]),
        _ponto(landmarks, olho["top"]),
        _ponto(landmarks, olho["bottom"]),
        _ponto(landmarks, olho["iris"]),
    )
    if outer is None or inner is None or top is None or bottom is None or iris is None:
        return None
    min_x, max_x = min(outer.x, inner.x), max(outer.x, inner.x)
    min_y, max_y = min(top.y, bottom.y), max(top.y, bottom.y)
    largura, altura = max_x - min_x, max_y - min_y
    if largura <= 0 or altura <= 0:
        return None
    return Ponto(x=(iris.x - min_x) / largura, y=(iris.y - min_y) / altura)


def _inclinacao_graus(landmarks: list[Ponto]) -> float | None:
    """Ângulo da linha entre os dois cantos externos dos olhos — proxy de
    inclinação da cabeça (roll). 0° = olhos ao nível."""
    a = _ponto(landmarks, _OLHO_A["outer"])
    b = _ponto(landmarks, _OLHO_B["outer"])
    if a is None or b is None:
        return None
    return math.degrees(math.atan2(b.y - a.y, b.x - a.x))


def _sem_deteccao(estado: str, motivos: list[str], poses_recebidas: list[str]) -> ScreeningCalculado:
    return ScreeningCalculado(
        estado=estado,
        rosto_detetado=estado != "sem_deteccao",
        requer_avaliacao_humana=True,
        assimetria_horizontal=None,
        assimetria_vertical=None,
        qualidade_captura=0.0,
        qualidade_fiavel=False,
        qualidade_motivos=motivos,
        medicoes={"poses_recebidas": poses_recebidas},
    )


def calcular_screening(
    poses: list[PoseCapturada], ambiente_escuro_em_algum_momento: bool
) -> ScreeningCalculado:
    """Pura: sem I/O, sem base de dados. Testável com qualquer combinação de
    landmarks, incluindo os casos em que a câmara falhou a meio."""
    poses_recebidas = [p.pose for p in poses]
    motivos_captura_incompleta = [
        f"pose '{esperada}' não foi capturada"
        for esperada in ("center", "right", "left")
        if esperada not in poses_recebidas
    ]

    central = next((p for p in poses if p.pose == "center"), None)
    if central is None or not central.landmarks:
        return _sem_deteccao(
            "sem_deteccao",
            ["rosto não detetado na pose central", *motivos_captura_incompleta],
            poses_recebidas,
        )

    ratio_a = _posicao_iris_na_abertura(central.landmarks, _OLHO_A)
    ratio_b = _posicao_iris_na_abertura(central.landmarks, _OLHO_B)
    if ratio_a is None or ratio_b is None:
        return _sem_deteccao(
            "pontos_insuficientes",
            ["pontos do olho em falta na pose central", *motivos_captura_incompleta],
            poses_recebidas,
        )

    inclinacao = _inclinacao_graus(central.landmarks)
    motivos = list(motivos_captura_incompleta)
    qualidade = 1.0

    if inclinacao is not None and abs(inclinacao) > LIMITE_INCLINACAO_GRAUS:
        qualidade -= 0.3
        motivos.append(f"cabeça inclinada (~{abs(inclinacao):.0f}°) durante a captura")
    if ambiente_escuro_em_algum_momento:
        qualidade -= 0.2
        motivos.append("ambiente pouco iluminado em algum momento da captura")
    qualidade -= 0.1 * len(motivos_captura_incompleta)
    qualidade = max(0.0, min(1.0, qualidade))

    return ScreeningCalculado(
        estado="concluido",
        rosto_detetado=True,
        requer_avaliacao_humana=True,
        assimetria_horizontal=ratio_b.x - ratio_a.x,
        assimetria_vertical=ratio_b.y - ratio_a.y,
        qualidade_captura=qualidade,
        qualidade_fiavel=qualidade >= LIMIAR_QUALIDADE_FIAVEL,
        qualidade_motivos=motivos,
        medicoes={
            "poses_recebidas": poses_recebidas,
            "inclinacao_graus": inclinacao,
            "metodo": "posicao_da_iris_na_abertura_ocular_pose_central",
        },
    )


class ScreeningService:
    def __init__(self, repositorio: ScreeningRepository) -> None:
        self._repo = repositorio

    def registar(
        self, user_id: str, poses: list[PoseCapturada], ambiente_escuro_em_algum_momento: bool
    ) -> ScreeningRegisto:
        calculado = calcular_screening(poses, ambiente_escuro_em_algum_momento)
        return self._repo.criar(user_id, calculado)
