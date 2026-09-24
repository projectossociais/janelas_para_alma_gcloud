"""Testes do `AcessoExerciciosService` — decide acesso pago, por isso cada
estado (premium, trial disponível/activo/terminado) e cada recusa tem teste.
"""

from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from app.repositories.acesso_exercicios_repository import EstadoAcessoRegisto
from app.services.acesso_exercicios_service import (
    EXERCICIOS_PREMIUM,
    EXERCICIOS_TRIAL,
    TODOS_OS_EXERCICIOS,
    TRIAL_DURACAO_DIAS,
    AcessoExerciciosService,
    ContaNaoEncontradaError,
    EstadoAcesso,
    ExercicioDesconhecidoError,
    SemAcessoAoExercicioError,
    TrialJaUtilizadoError,
)

AGORA = datetime(2026, 9, 23, 12, 0, tzinfo=UTC)


def _conta(**over) -> EstadoAcessoRegisto:
    base = EstadoAcessoRegisto(
        papel="comum",
        premium_ativo=False,
        premium_expira_em=None,
        trial_iniciado_em=None,
        trial_termina_em=None,
    )
    return replace(base, **over)


class RepositorioAcessoFalso:
    def __init__(self, conta: EstadoAcessoRegisto | None) -> None:
        self.conta = conta
        self.chamadas_iniciar = 0

    def obter(self, utilizador_id: str) -> EstadoAcessoRegisto | None:
        return self.conta

    def iniciar_trial(self, utilizador_id: str, inicio: datetime, fim: datetime) -> bool:
        self.chamadas_iniciar += 1
        if self.conta is None or self.conta.trial_iniciado_em is not None:
            return False
        self.conta = replace(self.conta, trial_iniciado_em=inicio, trial_termina_em=fim)
        return True


def _service(conta: EstadoAcessoRegisto | None, agora: datetime = AGORA):
    repo = RepositorioAcessoFalso(conta)
    return AcessoExerciciosService(repo, relogio=lambda: agora), repo


def test_os_8_exercicios_sao_4_do_trial_mais_4_premium() -> None:
    assert len(TODOS_OS_EXERCICIOS) == 8
    assert set(EXERCICIOS_TRIAL) == {"figure8", "convergence", "cerebro", "relax"}
    assert set(EXERCICIOS_PREMIUM) == {
        "ambliopia",
        "sacadas-convergencia",
        "flexibilidade-acomodativa",
        "estereopsia",
    }


def test_conta_existente_sem_trial_fica_com_trial_disponivel_e_nada_desbloqueado() -> None:
    service, _ = _service(_conta())
    acesso = service.obter_acesso("u1")
    assert acesso.estado is EstadoAcesso.trial_disponivel
    assert acesso.exercicios_desbloqueados == ()


def test_premium_valido_desbloqueia_os_8() -> None:
    service, _ = _service(_conta(premium_ativo=True, premium_expira_em=AGORA + timedelta(days=3)))
    acesso = service.obter_acesso("u1")
    assert acesso.estado is EstadoAcesso.premium
    assert acesso.exercicios_desbloqueados == TODOS_OS_EXERCICIOS


def test_premium_expirado_nao_conta_mesmo_com_flag_ativa() -> None:
    service, _ = _service(_conta(premium_ativo=True, premium_expira_em=AGORA - timedelta(seconds=1)))
    assert service.obter_acesso("u1").estado is EstadoAcesso.trial_disponivel


def test_admin_tem_os_8_sem_premium() -> None:
    service, _ = _service(_conta(papel="admin"))
    acesso = service.obter_acesso("u1")
    assert acesso.estado is EstadoAcesso.premium
    assert acesso.exercicios_desbloqueados == TODOS_OS_EXERCICIOS


def test_trial_ativo_desbloqueia_so_os_4_do_trial() -> None:
    service, _ = _service(
        _conta(trial_iniciado_em=AGORA - timedelta(days=1), trial_termina_em=AGORA + timedelta(days=6))
    )
    acesso = service.obter_acesso("u1")
    assert acesso.estado is EstadoAcesso.trial_ativo
    assert acesso.exercicios_desbloqueados == EXERCICIOS_TRIAL
    assert acesso.trial_dias_restantes == 6


def test_dias_restantes_arredonda_para_cima() -> None:
    service, _ = _service(
        _conta(trial_iniciado_em=AGORA - timedelta(days=6), trial_termina_em=AGORA + timedelta(hours=2))
    )
    assert service.obter_acesso("u1").trial_dias_restantes == 1


def test_trial_terminado_no_instante_exacto_do_fim() -> None:
    service, _ = _service(
        _conta(trial_iniciado_em=AGORA - timedelta(days=7), trial_termina_em=AGORA)
    )
    acesso = service.obter_acesso("u1")
    assert acesso.estado is EstadoAcesso.trial_terminado
    assert acesso.exercicios_desbloqueados == ()
    assert acesso.trial_dias_restantes is None


def test_premium_ganha_ao_trial_ativo() -> None:
    service, _ = _service(
        _conta(
            premium_ativo=True,
            premium_expira_em=AGORA + timedelta(days=30),
            trial_iniciado_em=AGORA,
            trial_termina_em=AGORA + timedelta(days=7),
        )
    )
    assert service.obter_acesso("u1").estado is EstadoAcesso.premium


def test_iniciar_trial_grava_7_dias_completos_em_utc() -> None:
    service, repo = _service(_conta())
    acesso = service.iniciar_trial("u1")
    assert acesso.estado is EstadoAcesso.trial_ativo
    assert repo.conta.trial_iniciado_em == AGORA
    assert repo.conta.trial_termina_em == AGORA + timedelta(days=TRIAL_DURACAO_DIAS)
    assert repo.conta.trial_termina_em.tzinfo is UTC
    assert acesso.trial_dias_restantes == 7


def test_iniciar_trial_segunda_vez_e_recusado() -> None:
    service, repo = _service(
        _conta(trial_iniciado_em=AGORA - timedelta(days=10), trial_termina_em=AGORA - timedelta(days=3))
    )
    with pytest.raises(TrialJaUtilizadoError):
        service.iniciar_trial("u1")
    assert repo.chamadas_iniciar == 0


def test_iniciar_trial_perde_corrida_no_update_e_recusado() -> None:
    """Outro pedido iniciou o trial entre a leitura e o UPDATE."""

    class RepositorioCorrida(RepositorioAcessoFalso):
        def iniciar_trial(self, utilizador_id, inicio, fim) -> bool:
            return False

    service = AcessoExerciciosService(RepositorioCorrida(_conta()), relogio=lambda: AGORA)
    with pytest.raises(TrialJaUtilizadoError):
        service.iniciar_trial("u1")


def test_conta_inexistente() -> None:
    service, _ = _service(None)
    with pytest.raises(ContaNaoEncontradaError):
        service.obter_acesso("u1")


def test_verificar_acesso_recusa_premium_durante_trial() -> None:
    service, _ = _service(
        _conta(trial_iniciado_em=AGORA, trial_termina_em=AGORA + timedelta(days=7))
    )
    service.verificar_acesso("u1", "figure8")  # não levanta
    with pytest.raises(SemAcessoAoExercicioError):
        service.verificar_acesso("u1", "ambliopia")


def test_verificar_acesso_recusa_exercicio_eliminado_ou_desconhecido() -> None:
    service, _ = _service(_conta(papel="admin"))
    for eliminado in ("sacadas-distratores", "facilidade-vergencia", "consciencia-periferica", "programa-ia"):
        with pytest.raises(ExercicioDesconhecidoError):
            service.verificar_acesso("u1", eliminado)


class PresignerFalso:
    def __init__(self) -> None:
        self.chaves: list[str] = []

    def url_de_leitura(self, chave: str) -> str:
        self.chaves.append(chave)
        return f"https://assinado.test/{chave}"


def test_url_do_video_so_e_assinado_com_acesso() -> None:
    presigner = PresignerFalso()
    service, _ = _service(_conta())  # trial disponível, nada desbloqueado
    with pytest.raises(SemAcessoAoExercicioError):
        service.url_do_video("u1", "figure8", presigner)
    assert presigner.chaves == []


def test_url_do_video_com_acesso_usa_chave_da_lista_fechada() -> None:
    presigner = PresignerFalso()
    service, _ = _service(_conta(premium_ativo=True, premium_expira_em=AGORA + timedelta(days=1)))
    url = service.url_do_video("u1", "estereopsia", presigner)
    assert presigner.chaves == ["videos-exercicios/estereopsia.mp4"]
    assert url.endswith("videos-exercicios/estereopsia.mp4")
    with pytest.raises(ExercicioDesconhecidoError):
        service.url_do_video("u1", "../avatares/x", presigner)
