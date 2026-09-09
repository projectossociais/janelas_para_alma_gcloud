from datetime import UTC, datetime, timedelta

import pytest

from app.core.security import verificar_password
from app.services.auth_service import AuthService
from app.services.conta_service import ContaService, PasswordAtualIncorretaError
from tests.services.test_auth_service import RepositorioFalso


@pytest.fixture
def repo() -> RepositorioFalso:
    return RepositorioFalso()


@pytest.fixture
def utilizador_id(repo: RepositorioFalso) -> str:
    sessao = AuthService(repo).registar("ana@example.com", "password-forte-123")
    return sessao.utilizador.id


class TestMudarPassword:
    def test_muda_a_password_quando_a_atual_esta_certa(self, repo: RepositorioFalso, utilizador_id: str) -> None:
        service = ContaService(repo)

        service.mudar_password(utilizador_id, "password-forte-123", "nova-password-456")

        atualizado = repo.obter_por_id(utilizador_id)
        assert verificar_password("nova-password-456", atualizado.password_hash)
        assert not verificar_password("password-forte-123", atualizado.password_hash)

    def test_rejeita_quando_a_password_atual_esta_errada(self, repo: RepositorioFalso, utilizador_id: str) -> None:
        service = ContaService(repo)

        with pytest.raises(PasswordAtualIncorretaError):
            service.mudar_password(utilizador_id, "password-errada", "nova-password-456")

        # nunca mudou nada
        atualizado = repo.obter_por_id(utilizador_id)
        assert verificar_password("password-forte-123", atualizado.password_hash)

    def test_rejeita_para_um_utilizador_inexistente(self, repo: RepositorioFalso) -> None:
        service = ContaService(repo)

        with pytest.raises(PasswordAtualIncorretaError):
            service.mudar_password("id-fantasma", "qualquer", "nova-password-456")


class TestAgendarEliminacao:
    def test_agenda_para_daqui_a_30_dias_e_nunca_apaga_na_hora(
        self, repo: RepositorioFalso, utilizador_id: str
    ) -> None:
        service = ContaService(repo)

        quando = service.agendar_eliminacao(utilizador_id)

        assert repo.obter_por_id(utilizador_id) is not None  # continua a existir
        esperado = datetime.now(UTC) + timedelta(days=30)
        assert abs((quando - esperado).total_seconds()) < 5

    def test_cancelar_quando_havia_um_pedido_agendado(self, repo: RepositorioFalso, utilizador_id: str) -> None:
        service = ContaService(repo)
        service.agendar_eliminacao(utilizador_id)

        cancelou = service.cancelar_eliminacao_se_agendada(utilizador_id)

        assert cancelou is True

    def test_cancelar_quando_nao_havia_nada_agendado_devolve_false(
        self, repo: RepositorioFalso, utilizador_id: str
    ) -> None:
        service = ContaService(repo)

        cancelou = service.cancelar_eliminacao_se_agendada(utilizador_id)

        assert cancelou is False
