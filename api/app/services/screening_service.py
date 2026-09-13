"""W-13/W-15 — sinal geométrico experimental a partir dos landmarks do
MediaPipe FaceMesh já extraídos no browser (`Scanner.tsx`).

**O que isto NÃO é**: um diagnóstico, uma percentagem de confiança clínica,
ou um substituto do método validado (Hirschberg/reflexo corneano) descrito em
`docs/SCANNER-METODO.md` (W-13). `requer_avaliacao_humana` é **sempre**
`True` — não existe, hoje, nenhum limiar validado que separe "normal" de
"desvio" a partir deste número (isso é o W-16, bloqueado por precisar de
casos reais com diagnóstico conhecido). Ver CLAUDE.md secção 11 e
docs/BACKLOG.md, Sprint 3.

**Eixo horizontal — método de Huang et al. (2021)**: sem fonte de luz
controlada não há reflexo corneano, por isso a componente horizontal usa o
método publicado em Huang X., Lee S.J., Kim C.Z., Choi S.H., "An automatic
screening method for strabismus detection based on image processing",
PLOS ONE 16(8):e0255643, 2021 — a razão, por olho, entre a distância da
íris ao canto medial e ao canto lateral. Os autores comparam os dois olhos
via `S = max(ratio)/min(ratio)` (sem sinal); aqui usa-se a **diferença**
das duas razões, para preservar qual dos olhos está desviado (o `S` do
artigo original fica guardado em `medicoes` para referência, comparável
aos valores publicados: normal 1.073±0.039, estrábico 1.924±0.472).

**Eixo vertical — extensão própria, SEM equivalente publicado
encontrado**: nenhuma pesquisa devolveu um método de detecção vertical
(hipertropia/hipotropia) a partir só de landmarks, sem reflexo. Construído
por analogia: distância perpendicular de cada íris à recta que liga os
dois cantos laterais (referência estável, ao contrário da pálpebra —
ver nota sobre pseudoestrabismo abaixo), normalizada pela distância
inter-ocular. **Tratar com mais cepticismo do que o eixo horizontal.**

**Porque não se usa a pálpebra (superior/inferior) em nenhum eixo**: uma
versão anterior deste serviço usava a posição da íris dentro do
rectângulo pálpebra-superior/pálpebra-inferior/canto-medial/canto-lateral.
Abandonado porque colide com um viés clínico real e documentado —
**pseudoestrabismo por prega epicântica**: a aparência de desvio pode vir
inteiramente da pálpebra (menos esclera visível do lado nasal), sem
qualquer desalinhamento ocular real; clinicamente distingue-se pelo
reflexo corneano permanecer centrado nos dois olhos (EyeWiki,
"Pseudostrabismus"; Moran CORE, "Pseudoesotropia"). Sem reflexo, não há
como distinguir aqui — mas medir a partir dos cantos (não da pálpebra)
pelo menos não persegue directamente esse artefacto.

**Qualidade da captura considera agora também o desvio de eixo (yaw) da
cabeça**, não só a inclinação (roll): a documentação da própria MediaPipe
avisa que a posição da íris "degrada sem normalização de pose da cabeça"
quando a cara não está de frente para a câmara. Sem um modelo 3D
calibrado não há como corrigir isto — só detectar e penalizar a
qualidade, tal como já se fazia com a inclinação e a luz.

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

# Índices de landmarks do MediaPipe FaceMesh com refineLandmarks activo.
# Verificados independentemente (não copiados sem confirmar): olho 1 tem
# canto lateral em 33 e canto medial em 133; olho 2 tem canto medial em 362
# e canto lateral em 263. "Olho 1"/"olho 2" porque a lateralidade
# anatómica (esquerdo/direito real da pessoa) depende de a captura estar
# ou não espelhada -- não verificado aqui, por isso nunca rotulado como
# "esquerdo"/"direito" nos resultados (ver docs/SCANNER-METODO.md).
_EYE_1 = {"lateral": 33, "medial": 133, "iris": 468}
_EYE_2 = {"medial": 362, "lateral": 263, "iris": 473}

# Heurísticas, não valores derivados de um estudo -- ver docs/SCANNER-METODO.md.
LIMITE_INCLINACAO_GRAUS = 8.0
LIMITE_DESVIO_YAW = 0.15
LIMIAR_QUALIDADE_FIAVEL = 0.6

# A string de versão do método persistida com cada registo vive em
# `screening_repository.py` (`VERSAO_ANALISE`) -- não duplicada aqui para
# nunca poder dessincronizar das duas definições.


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


def _distancia(a: Ponto, b: Ponto) -> float:
    return math.hypot(a.x - b.x, a.y - b.y)


def _ratio_medial_lateral(landmarks: list[Ponto], olho: dict[str, int]) -> float | None:
    """Método de Huang et al. (2021): distância(íris, canto medial) /
    distância(íris, canto lateral). ~1.0 quando a íris está centrada; um
    olho desviado nasal ou temporalmente afasta este valor de 1.0."""
    medial, lateral, iris = (
        _ponto(landmarks, olho["medial"]),
        _ponto(landmarks, olho["lateral"]),
        _ponto(landmarks, olho["iris"]),
    )
    if medial is None or lateral is None or iris is None:
        return None
    r_lateral = _distancia(iris, lateral)
    if r_lateral <= 0:
        return None
    return _distancia(iris, medial) / r_lateral


def _inclinacao_graus(landmarks: list[Ponto]) -> float | None:
    """Ângulo da linha entre os dois cantos laterais -- proxy de
    inclinação da cabeça (roll). 0° = olhos ao nível."""
    a = _ponto(landmarks, _EYE_1["lateral"])
    b = _ponto(landmarks, _EYE_2["lateral"])
    if a is None or b is None:
        return None
    return math.degrees(math.atan2(b.y - a.y, b.x - a.x))


def _desvio_de_yaw(landmarks: list[Ponto]) -> float | None:
    """Diferença de profundidade (z) entre os dois cantos laterais,
    normalizada pela distância entre eles -- proxy de a cara estar (ou não)
    de frente para a câmara. `None` quando o browser não enviou `z`
    (campo opcional) -- nesse caso não se penaliza por não se saber."""
    a = _ponto(landmarks, _EYE_1["lateral"])
    b = _ponto(landmarks, _EYE_2["lateral"])
    if a is None or b is None or a.z is None or b.z is None:
        return None
    dx = b.x - a.x
    if dx == 0:
        return None
    return (b.z - a.z) / dx


def _offset_vertical_perpendicular(landmarks: list[Ponto], olho: dict[str, int]) -> float | None:
    """Distância perpendicular da íris à recta que liga os dois cantos
    laterais, normalizada pela distância entre eles. Extensão própria, sem
    equivalente publicado -- ver docstring do módulo."""
    a, b, iris = (
        _ponto(landmarks, _EYE_1["lateral"]),
        _ponto(landmarks, _EYE_2["lateral"]),
        _ponto(landmarks, olho["iris"]),
    )
    if a is None or b is None or iris is None:
        return None
    dx, dy = b.x - a.x, b.y - a.y
    comprimento = math.hypot(dx, dy)
    if comprimento <= 0:
        return None
    cruzado = dx * (iris.y - a.y) - dy * (iris.x - a.x)
    return cruzado / (comprimento**2)


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

    ratio_1 = _ratio_medial_lateral(central.landmarks, _EYE_1)
    ratio_2 = _ratio_medial_lateral(central.landmarks, _EYE_2)
    if ratio_1 is None or ratio_2 is None:
        return _sem_deteccao(
            "pontos_insuficientes",
            ["pontos do olho em falta na pose central", *motivos_captura_incompleta],
            poses_recebidas,
        )

    inclinacao = _inclinacao_graus(central.landmarks)
    yaw = _desvio_de_yaw(central.landmarks)
    offset_1 = _offset_vertical_perpendicular(central.landmarks, _EYE_1)
    offset_2 = _offset_vertical_perpendicular(central.landmarks, _EYE_2)

    motivos = list(motivos_captura_incompleta)
    qualidade = 1.0

    if yaw is not None and abs(yaw) > LIMITE_DESVIO_YAW:
        qualidade -= 0.4
        motivos.append("cabeça virada -- não estava de frente para a câmara durante a captura")
    if inclinacao is not None and abs(inclinacao) > LIMITE_INCLINACAO_GRAUS:
        qualidade -= 0.3
        motivos.append(f"cabeça inclinada (~{abs(inclinacao):.0f}°) durante a captura")
    if ambiente_escuro_em_algum_momento:
        qualidade -= 0.2
        motivos.append("ambiente pouco iluminado em algum momento da captura")
    qualidade -= 0.1 * len(motivos_captura_incompleta)
    qualidade = max(0.0, min(1.0, qualidade))

    s_huang2021 = max(ratio_1, ratio_2) / min(ratio_1, ratio_2) if min(ratio_1, ratio_2) > 0 else None
    assimetria_vertical = (
        offset_2 - offset_1 if offset_1 is not None and offset_2 is not None else None
    )

    return ScreeningCalculado(
        estado="concluido",
        rosto_detetado=True,
        requer_avaliacao_humana=True,
        assimetria_horizontal=ratio_2 - ratio_1,
        assimetria_vertical=assimetria_vertical,
        qualidade_captura=qualidade,
        qualidade_fiavel=qualidade >= LIMIAR_QUALIDADE_FIAVEL,
        qualidade_motivos=motivos,
        medicoes={
            "poses_recebidas": poses_recebidas,
            "inclinacao_graus": inclinacao,
            "desvio_de_yaw": yaw,
            "ratio_medial_lateral_olho_1": ratio_1,
            "ratio_medial_lateral_olho_2": ratio_2,
            "estatistica_s_huang2021": s_huang2021,
            "metodo_horizontal": "huang_et_al_2021_ratio_canto_iris",
            "metodo_vertical": "offset_perpendicular_a_linha_intercantal_experimental_nao_publicado",
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
