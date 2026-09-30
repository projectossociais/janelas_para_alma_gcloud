from dataclasses import replace
from datetime import UTC, datetime

import pytest

from app.repositories.consentimento_saude_repository import ConsentimentoRegisto
from app.services.consentimento_saude_service import (
    VERSAO_ACTUAL,
    ConsentimentoEmFaltaError,
    ConsentimentoSaudeService,
    DeclaracaoEmFaltaError,
)

AGORA = datetime(2026, 9, 30, 10, 0, tzinfo=UTC)


class RepositorioConsentimentoFalso:
    def __init__(self) -> None:
        self.linhas: list[ConsentimentoRegisto] = []

    def criar(
        self, utilizador_id: str, versao: str, declara_maioridade: bool, representa_menor: bool
    ) -> ConsentimentoRegisto:
        c = ConsentimentoRegisto(
            id=f"c-{len(self.linhas) + 1}",
            utilizador_id=utilizador_id,
            versao=versao,
            declara_maioridade=declara_maioridade,
            representa_menor=representa_menor,
            aceite_em=AGORA,
            revogado_em=None,
        )
        self.linhas.append(c)
        return c

    def obter_activo(self, utilizador_id: str) -> ConsentimentoRegisto | None:
        activos = [c for c in self.linhas if c.utilizador_id == utilizador_id and c.revogado_em is None]
        return activos[-1] if activos else None

    def revogar_activos(self, utilizador_id: str, agora: datetime) -> int:
        n = 0
        for i, c in enumerate(self.linhas):
            if c.utilizador_id == utilizador_id and c.revogado_em is None:
                self.linhas[i] = replace(c, revogado_em=agora)
                n += 1
        return n


def servico(repo: RepositorioConsentimentoFalso | None = None) -> ConsentimentoSaudeService:
    return ConsentimentoSaudeService(repo or RepositorioConsentimentoFalso(), agora=lambda: AGORA)


def servico_com_consentimento(*utilizador_ids: str) -> ConsentimentoSaudeService:
    """Para testes de outras rotas: estes utilizadores já consentiram."""
    s = servico()
    for uid in utilizador_ids:
        s.registar(uid, declara_maioridade=True, aceita_tratamento=True, representa_menor=False)
    return s


class ServicoQueConsenteTodos(ConsentimentoSaudeService):
    """Para testes de rotas que não são sobre consentimento: qualquer conta
    conta como tendo consentido."""

    def __init__(self) -> None:
        super().__init__(RepositorioConsentimentoFalso(), agora=lambda: AGORA)

    def exigir(self, utilizador_id: str) -> None:
        return None


def test_sem_consentimento_nao_esta_consentido_e_exigir_recusa() -> None:
    s = servico()
    assert s.estado("u1").consentido is False
    with pytest.raises(ConsentimentoEmFaltaError):
        s.exigir("u1")


def test_registar_exige_as_duas_declaracoes() -> None:
    s = servico()
    with pytest.raises(DeclaracaoEmFaltaError):
        s.registar("u1", declara_maioridade=False, aceita_tratamento=True, representa_menor=False)
    with pytest.raises(DeclaracaoEmFaltaError):
        s.registar("u1", declara_maioridade=True, aceita_tratamento=False, representa_menor=False)
    assert s.estado("u1").consentido is False


def test_registar_da_consentimento_na_versao_actual() -> None:
    s = servico()
    estado = s.registar("u1", declara_maioridade=True, aceita_tratamento=True, representa_menor=True)
    assert estado.consentido is True
    assert estado.versao_aceite == VERSAO_ACTUAL
    assert estado.representa_menor is True
    s.exigir("u1")


def test_registar_duas_vezes_nao_duplica_linhas() -> None:
    repo = RepositorioConsentimentoFalso()
    s = servico(repo)
    s.registar("u1", declara_maioridade=True, aceita_tratamento=True, representa_menor=False)
    s.registar("u1", declara_maioridade=True, aceita_tratamento=True, representa_menor=False)
    assert len(repo.linhas) == 1


def test_consentimento_de_um_nao_serve_a_outro() -> None:
    s = servico_com_consentimento("u1")
    with pytest.raises(ConsentimentoEmFaltaError):
        s.exigir("u2")


def test_retirar_consentimento_bloqueia_novas_gravacoes() -> None:
    s = servico_com_consentimento("u1")
    estado = s.retirar("u1")
    assert estado.consentido is False
    with pytest.raises(ConsentimentoEmFaltaError):
        s.exigir("u1")


def test_versao_antiga_deixa_de_contar_e_nova_aceitacao_substitui_a_antiga() -> None:
    repo = RepositorioConsentimentoFalso()
    repo.criar("u1", versao="2025-01-01", declara_maioridade=True, representa_menor=False)
    s = servico(repo)
    assert s.estado("u1").consentido is False
    with pytest.raises(ConsentimentoEmFaltaError):
        s.exigir("u1")

    s.registar("u1", declara_maioridade=True, aceita_tratamento=True, representa_menor=False)
    assert s.estado("u1").consentido is True
    # A antiga fica revogada: nunca mais do que um consentimento activo.
    assert [c.revogado_em is None for c in repo.linhas] == [False, True]
