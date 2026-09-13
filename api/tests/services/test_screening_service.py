"""Testes do cálculo geométrico experimental (W-13/W-15).

O eixo horizontal implementa o método publicado em Huang et al. (2021,
PLOS ONE 16(8):e0255643): razão, por olho, entre a distância da íris ao
canto medial e ao canto lateral. O eixo vertical é uma extensão própria,
sem equivalente publicado -- ver docstring de `screening_service.py` e
`docs/SCANNER-METODO.md`.

O que importa provar aqui: o número calculado é sempre uma função
determinística das coordenadas recebidas (nunca aleatório), que falta de
dados degrada honestamente (estado + qualidade baixa, nunca um valor
fabricado), que a qualidade capta tanto inclinação (roll) como desvio de
eixo (yaw) da cabeça, e que `requer_avaliacao_humana` nunca é `False` --
não existe, ainda, nenhum limiar validado (W-16 continua bloqueado).
"""

import math
from datetime import UTC, datetime

import pytest

from app.repositories.screening_repository import ScreeningCalculado, ScreeningRegisto
from app.services.screening_service import (
    LIMIAR_QUALIDADE_FIAVEL,
    LIMITE_DESVIO_YAW,
    LIMITE_INCLINACAO_GRAUS,
    Ponto,
    PoseCapturada,
    ScreeningService,
    calcular_screening,
)

# Índices verificados independentemente (ver comentário em
# screening_service.py): olho 1 = lateral 33 / medial 133 / íris 468;
# olho 2 = medial 362 / lateral 263 / íris 473.
_EYE_1 = {"lateral": 33, "medial": 133, "iris": 468}
_EYE_2 = {"medial": 362, "lateral": 263, "iris": 473}


def _landmarks(
    overrides: dict[int, tuple[float, float] | tuple[float, float, float]],
    tamanho: int = 480,
) -> list[Ponto]:
    pontos = [Ponto(x=0.0, y=0.0) for _ in range(tamanho)]
    for indice, valores in overrides.items():
        if len(valores) == 3:
            x, y, z = valores
            pontos[indice] = Ponto(x=x, y=y, z=z)
        else:
            x, y = valores
            pontos[indice] = Ponto(x=x, y=y)
    return pontos


def _landmarks_centrados(
    *,
    iris_2_x: float = 0.65,
    iris_2_y: float = 0.50,
    lateral_2_y: float = 0.50,
    lateral_2_z: float | None = None,
    lateral_1_z: float | None = None,
) -> list[Ponto]:
    """Dois olhos bem formados; por omissão, simétricos (íris a meio da
    distância entre os dois cantos, olhos ao mesmo nível, de frente)."""
    overrides: dict[int, tuple] = {
        _EYE_1["lateral"]: (0.30, 0.50) if lateral_1_z is None else (0.30, 0.50, lateral_1_z),
        _EYE_1["medial"]: (0.40, 0.50),
        _EYE_1["iris"]: (0.35, 0.50),
        _EYE_2["medial"]: (0.60, 0.50),
        _EYE_2["iris"]: (iris_2_x, iris_2_y),
    }
    overrides[_EYE_2["lateral"]] = (
        (0.70, lateral_2_y) if lateral_2_z is None else (0.70, lateral_2_y, lateral_2_z)
    )
    return _landmarks(overrides)


def _rodar_pontos(
    pontos: dict[int, tuple[float, float]], angulo_graus: float, pivot: tuple[float, float]
) -> dict[int, tuple[float, float]]:
    """Rotação rígida em torno de `pivot` -- preserva todas as distâncias
    entre pontos (por isso não deve alterar nenhum ratio medial/lateral),
    só muda o ângulo entre eles (o que a inclinação deve, de facto, captar).
    """
    rad = math.radians(angulo_graus)
    cos_a, sin_a = math.cos(rad), math.sin(rad)
    px, py = pivot
    rodados: dict[int, tuple[float, float]] = {}
    for indice, (x, y) in pontos.items():
        dx, dy = x - px, y - py
        rodados[indice] = (px + dx * cos_a - dy * sin_a, py + dx * sin_a + dy * cos_a)
    return rodados


def _poses_completas(landmarks_center: list[Ponto]) -> list[PoseCapturada]:
    return [
        PoseCapturada(pose="center", landmarks=landmarks_center),
        PoseCapturada(pose="right", landmarks=landmarks_center),
        PoseCapturada(pose="left", landmarks=landmarks_center),
    ]


class TestCalculoGeometrico:
    def test_olhos_simetricos_dao_assimetria_zero_e_qualidade_maxima(self) -> None:
        resultado = calcular_screening(_poses_completas(_landmarks_centrados()), False)

        assert resultado.estado == "concluido"
        assert resultado.rosto_detetado is True
        assert resultado.assimetria_horizontal == pytest.approx(0.0, abs=1e-9)
        assert resultado.assimetria_vertical == pytest.approx(0.0, abs=1e-9)
        assert resultado.qualidade_captura == 1.0
        assert resultado.qualidade_fiavel is True
        assert resultado.qualidade_motivos == []

    def test_assimetria_horizontal_segue_a_razao_medial_lateral_de_huang_2021(self) -> None:
        # íris do olho 2 desviada para o canto medial (0.60): ratio_2 =
        # dist(0.68,0.60)/dist(0.68,0.70) = 0.08/0.02 = 4.0; ratio_1 = 1.0
        landmarks = _landmarks_centrados(iris_2_x=0.68)
        resultado = calcular_screening(_poses_completas(landmarks), False)

        assert resultado.assimetria_horizontal == pytest.approx(3.0)
        assert resultado.assimetria_vertical == pytest.approx(0.0, abs=1e-9)
        # a estatística comparável ao artigo original (S = max/min) fica
        # disponível em `medicoes`, mesmo não sendo o valor principal aqui.
        assert resultado.medicoes["estatistica_s_huang2021"] == pytest.approx(4.0)

    def test_assimetria_vertical_usa_a_linha_intercantal_como_referencia(self) -> None:
        # íris do olho 2 desviada verticalmente; a do olho 1 mantém-se.
        landmarks = _landmarks_centrados(iris_2_y=0.45)
        resultado = calcular_screening(_poses_completas(landmarks), False)

        assert resultado.assimetria_horizontal == pytest.approx(0.0, abs=1e-9)
        assert resultado.assimetria_vertical == pytest.approx(-0.125)

    def test_e_deterministico_mesmas_coordenadas_mesmo_resultado(self) -> None:
        landmarks = _landmarks_centrados(iris_2_x=0.72)
        r1 = calcular_screening(_poses_completas(landmarks), False)
        r2 = calcular_screening(_poses_completas(landmarks), False)
        assert r1.assimetria_horizontal == r2.assimetria_horizontal

    def test_requer_avaliacao_humana_e_sempre_verdadeiro(self) -> None:
        # Mesmo no melhor caso possível -- nunca existe, hoje, um limiar
        # validado que dispense confirmação humana (W-16 bloqueado).
        resultado = calcular_screening(_poses_completas(_landmarks_centrados()), False)
        assert resultado.requer_avaliacao_humana is True


class TestFaltaDeDados:
    def test_sem_pose_center_nao_calcula_nada(self) -> None:
        poses = [
            PoseCapturada(pose="right", landmarks=_landmarks_centrados()),
            PoseCapturada(pose="left", landmarks=_landmarks_centrados()),
        ]
        resultado = calcular_screening(poses, False)

        assert resultado.estado == "sem_deteccao"
        assert resultado.rosto_detetado is False
        assert resultado.assimetria_horizontal is None
        assert resultado.qualidade_captura == 0.0
        assert resultado.qualidade_fiavel is False
        assert "rosto não detetado na pose central" in resultado.qualidade_motivos

    def test_pose_center_sem_landmarks_nao_calcula_nada(self) -> None:
        poses = [PoseCapturada(pose="center", landmarks=[])]
        resultado = calcular_screening(poses, False)
        assert resultado.estado == "sem_deteccao"
        assert resultado.assimetria_horizontal is None

    def test_landmarks_insuficientes_no_olho_nao_fabrica_um_numero(self) -> None:
        # Só 5 pontos, nenhum deles nos índices dos olhos.
        landmarks = _landmarks({0: (0.1, 0.1)}, tamanho=10)
        resultado = calcular_screening(_poses_completas(landmarks), False)

        assert resultado.estado == "pontos_insuficientes"
        assert resultado.rosto_detetado is True  # havia landmarks, só não os do olho
        assert resultado.assimetria_horizontal is None
        assert resultado.qualidade_fiavel is False


class TestQualidade:
    def test_cabeca_inclinada_reduz_qualidade_sem_afetar_os_ratios(self) -> None:
        # Rotação rígida de todos os pontos dos dois olhos: preserva as
        # distâncias internas (ratios inalterados), só muda o ângulo entre
        # os cantos laterais -- é isto que a inclinação deve captar.
        base = {
            _EYE_1["lateral"]: (0.30, 0.50),
            _EYE_1["medial"]: (0.40, 0.50),
            _EYE_1["iris"]: (0.35, 0.50),
            _EYE_2["medial"]: (0.60, 0.50),
            _EYE_2["lateral"]: (0.70, 0.50),
            _EYE_2["iris"]: (0.65, 0.50),
        }
        angulo_alvo_graus = LIMITE_INCLINACAO_GRAUS + 5
        rodados = _rodar_pontos(base, angulo_alvo_graus, pivot=(0.30, 0.50))
        landmarks = _landmarks(rodados)

        resultado = calcular_screening(_poses_completas(landmarks), False)

        assert resultado.qualidade_captura < 1.0
        assert any("inclinada" in m for m in resultado.qualidade_motivos)
        # rotação rígida preserva todas as distâncias -- os ratios (e por
        # isso a assimetria horizontal e vertical) não devem mudar
        assert resultado.assimetria_horizontal == pytest.approx(0.0, abs=1e-6)
        assert resultado.assimetria_vertical == pytest.approx(0.0, abs=1e-6)

    def test_cabeca_virada_yaw_reduz_qualidade_e_regista_o_motivo(self) -> None:
        # dx = 0.40; dz suficiente para ultrapassar LIMITE_DESVIO_YAW (0.15)
        dz = LIMITE_DESVIO_YAW * 0.40 * 2
        landmarks = _landmarks_centrados(lateral_1_z=0.0, lateral_2_z=dz)

        resultado = calcular_screening(_poses_completas(landmarks), False)

        assert resultado.qualidade_captura < 1.0
        assert any("virada" in m for m in resultado.qualidade_motivos)

    def test_sem_z_nos_landmarks_nao_penaliza_por_yaw(self) -> None:
        # `z` é opcional (o browser pode não o enviar) -- sem ele, não se
        # pode avaliar o yaw, e não se penaliza por não se saber.
        resultado = calcular_screening(_poses_completas(_landmarks_centrados()), False)
        assert not any("virada" in m for m in resultado.qualidade_motivos)

    def test_ambiente_escuro_reduz_qualidade_e_regista_o_motivo(self) -> None:
        resultado = calcular_screening(_poses_completas(_landmarks_centrados()), True)
        assert resultado.qualidade_captura == pytest.approx(0.8)
        assert any("iluminado" in m for m in resultado.qualidade_motivos)

    def test_poses_em_falta_reduzem_qualidade_mas_nao_impedem_o_calculo(self) -> None:
        landmarks = _landmarks_centrados()
        poses = [PoseCapturada(pose="center", landmarks=landmarks)]  # só a central

        resultado = calcular_screening(poses, False)

        assert resultado.estado == "concluido"
        assert resultado.assimetria_horizontal == pytest.approx(0.0, abs=1e-9)
        assert resultado.qualidade_captura < 1.0
        assert "pose 'right' não foi capturada" in resultado.qualidade_motivos
        assert "pose 'left' não foi capturada" in resultado.qualidade_motivos

    def test_qualidade_fiavel_fica_falso_quando_varios_problemas_se_acumulam(self) -> None:
        landmarks = _landmarks_centrados(lateral_2_y=0.90)  # inclinação extrema
        poses = [PoseCapturada(pose="center", landmarks=landmarks)]  # sem right/left

        resultado = calcular_screening(poses, True)  # + ambiente escuro

        assert resultado.qualidade_captura < LIMIAR_QUALIDADE_FIAVEL
        assert resultado.qualidade_fiavel is False


class _RepositorioScreeningFalso:
    def __init__(self) -> None:
        self.criados: list[dict] = []

    def criar(self, user_id: str, calculado: ScreeningCalculado) -> ScreeningRegisto:
        self.criados.append({"user_id": user_id, "calculado": calculado})
        return ScreeningRegisto(
            id="screening-1",
            user_id=user_id,
            estado=calculado.estado,
            rosto_detetado=calculado.rosto_detetado,
            requer_avaliacao_humana=calculado.requer_avaliacao_humana,
            assimetria_horizontal=calculado.assimetria_horizontal,
            assimetria_vertical=calculado.assimetria_vertical,
            qualidade_captura=calculado.qualidade_captura,
            qualidade_fiavel=calculado.qualidade_fiavel,
            qualidade_motivos=calculado.qualidade_motivos,
            versao_analise="geometria-canto-iris-huang2021-v2-experimental",
            criado_em=datetime.now(UTC),
        )

    def obter(self, screening_id: str) -> ScreeningRegisto | None:  # pragma: no cover
        raise NotImplementedError


class TestScreeningService:
    def test_registar_persiste_o_resultado_calculado_para_o_utilizador_certo(self) -> None:
        repo = _RepositorioScreeningFalso()
        poses = _poses_completas(_landmarks_centrados())

        resultado = ScreeningService(repo).registar("user-42", poses, False)

        assert resultado.user_id == "user-42"
        assert repo.criados[0]["user_id"] == "user-42"
        assert resultado.assimetria_horizontal == pytest.approx(0.0, abs=1e-9)
