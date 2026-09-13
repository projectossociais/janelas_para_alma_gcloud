"""Testes do cálculo geométrico experimental (W-13/W-15).

O que importa provar aqui: o número calculado é sempre uma função
determinística das coordenadas recebidas (nunca aleatório), que falta de
dados degrada honestamente (estado + qualidade baixa, nunca um valor
fabricado), e que `requer_avaliacao_humana` nunca é `False` -- não existe,
ainda, nenhum limiar validado (W-16 continua bloqueado).
"""

from datetime import UTC, datetime

import pytest

from app.repositories.screening_repository import ScreeningCalculado, ScreeningRegisto
from app.services.screening_service import (
    LIMIAR_QUALIDADE_FIAVEL,
    LIMITE_INCLINACAO_GRAUS,
    Ponto,
    PoseCapturada,
    ScreeningService,
    calcular_screening,
)

_OLHO_A = {"outer": 33, "inner": 133, "top": 159, "bottom": 145, "iris": 468}
_OLHO_B = {"outer": 362, "inner": 263, "top": 386, "bottom": 374, "iris": 473}


def _landmarks(overrides: dict[int, tuple[float, float]], tamanho: int = 480) -> list[Ponto]:
    pontos = [Ponto(x=0.0, y=0.0) for _ in range(tamanho)]
    for indice, (x, y) in overrides.items():
        pontos[indice] = Ponto(x=x, y=y)
    return pontos


def _landmarks_centrados(*, iris_b_x: float = 0.65, outer_b_y: float = 0.50) -> list[Ponto]:
    """Dois olhos bem formados; por omissão, simétricos (íris no centro de
    cada abertura, olhos ao mesmo nível)."""
    return _landmarks(
        {
            _OLHO_A["outer"]: (0.30, 0.50),
            _OLHO_A["inner"]: (0.40, 0.50),
            _OLHO_A["top"]: (0.35, 0.48),
            _OLHO_A["bottom"]: (0.35, 0.52),
            _OLHO_A["iris"]: (0.35, 0.50),
            _OLHO_B["outer"]: (0.70, outer_b_y),
            _OLHO_B["inner"]: (0.60, 0.50),
            _OLHO_B["top"]: (0.65, 0.48),
            _OLHO_B["bottom"]: (0.65, 0.52),
            _OLHO_B["iris"]: (iris_b_x, 0.50),
        }
    )


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

    def test_assimetria_reflete_a_posicao_real_da_iris_com_sinal_correto(self) -> None:
        landmarks = _landmarks_centrados(iris_b_x=0.68)  # íris B desviada para o lado externo
        resultado = calcular_screening(_poses_completas(landmarks), False)

        # ratio_b.x = (0.68-0.60)/0.10 = 0.8; ratio_a.x = 0.5 -> diferença 0.3
        assert resultado.assimetria_horizontal == pytest.approx(0.3)
        assert resultado.assimetria_vertical == pytest.approx(0.0, abs=1e-9)

    def test_e_deterministico_mesmas_coordenadas_mesmo_resultado(self) -> None:
        landmarks = _landmarks_centrados(iris_b_x=0.72)
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
    def test_cabeca_inclinada_reduz_qualidade_e_regista_o_motivo(self) -> None:
        import math

        # dx entre os cantos externos = 0.70-0.30 = 0.40; escolhe dy para um
        # ângulo claramente acima do limite.
        dx = 0.40
        angulo_alvo_graus = LIMITE_INCLINACAO_GRAUS + 5
        dy = dx * math.tan(math.radians(angulo_alvo_graus))
        landmarks = _landmarks_centrados(outer_b_y=0.50 + dy)

        resultado = calcular_screening(_poses_completas(landmarks), False)

        assert resultado.qualidade_captura < 1.0
        assert any("inclinada" in m for m in resultado.qualidade_motivos)
        # a inclinação não deve alterar o cálculo da assimetria (índices distintos)
        assert resultado.assimetria_horizontal == pytest.approx(0.0, abs=1e-9)

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
        landmarks = _landmarks_centrados(outer_b_y=0.90)  # inclinação extrema
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
            versao_analise="geometria-iris-v1-experimental",
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
