"""Testes do `ClinicaParceiraService.remover`: uma clínica com pedidos de
consulta nunca se apaga (perdia-se o histórico das famílias) -- desactiva-se."""

from datetime import UTC, datetime

import pytest

from app.repositories.clinica_parceira_repository import ClinicaParceiraRegisto
from app.services.clinica_parceira_service import (
    ClinicaNaoEncontradaError,
    ClinicaParceiraService,
    ResultadoRemocao,
)


def _clinica(id_: str, ativa: bool = True) -> ClinicaParceiraRegisto:
    return ClinicaParceiraRegisto(
        id=id_,
        nome=f"Clínica {id_}",
        email_contacto=f"{id_}@example.com",
        telefone_contacto="+244900000000",
        ativa=ativa,
        especialidades=[],
        cidade=None,
        modalidades_suportadas=[],
        preco_indicativo=None,
        created_at=datetime.now(UTC),
    )


class RepositorioFalso:
    def __init__(self, clinicas: list[ClinicaParceiraRegisto], com_agendamentos: set[str] | None = None) -> None:
        self.clinicas = {c.id: c for c in clinicas}
        self.com_agendamentos = com_agendamentos or set()
        self.apagadas: list[str] = []

    def obter(self, clinica_id: str):
        return self.clinicas.get(clinica_id)

    def obter_para_remocao(self, clinica_id: str):
        return self.obter(clinica_id)

    def tem_agendamentos(self, clinica_id: str) -> bool:
        return clinica_id in self.com_agendamentos

    def definir_ativa(self, clinica_id: str, ativa: bool):
        atual = self.clinicas.get(clinica_id)
        if atual is None:
            return None
        self.clinicas[clinica_id] = ClinicaParceiraRegisto(**{**atual.__dict__, "ativa": ativa})
        return self.clinicas[clinica_id]

    def apagar(self, clinica_id: str) -> bool:
        if self.clinicas.pop(clinica_id, None) is None:
            return False
        self.apagadas.append(clinica_id)
        return True


def test_sem_agendamentos_apaga() -> None:
    repo = RepositorioFalso([_clinica("c1")])
    assert ClinicaParceiraService(repo).remover("c1") == ResultadoRemocao.apagada
    assert repo.apagadas == ["c1"]


def test_com_agendamentos_so_desativa() -> None:
    repo = RepositorioFalso([_clinica("c1")], com_agendamentos={"c1"})
    assert ClinicaParceiraService(repo).remover("c1") == ResultadoRemocao.desativada
    assert repo.apagadas == []
    assert repo.clinicas["c1"].ativa is False


def test_clinica_inexistente() -> None:
    repo = RepositorioFalso([])
    with pytest.raises(ClinicaNaoEncontradaError):
        ClinicaParceiraService(repo).remover("c1")
