"""Testes do `EquipaClinicaService`.

`papel: "profissional"` é auto-registável sem verificação nenhuma -- por
isso a ligação conta→clínica só pode nascer aqui (sempre por acção de um
admin), nunca a partir do papel escolhido no registo.
"""

from datetime import UTC, datetime

import pytest

from app.repositories.clinica_parceira_repository import ClinicaParceiraRegisto
from app.repositories.equipa_clinica_repository import MembroEquipaRegisto
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.services.equipa_clinica_service import (
    ClinicaNaoEncontradaError,
    EquipaClinicaService,
    JaLigadoAOutraClinicaError,
    UtilizadorNaoEncontradoError,
)


def _clinica(**over) -> ClinicaParceiraRegisto:
    base = {
        "id": "clinica-1",
        "nome": "Óptica Optioptika",
        "email_contacto": "geral@optioptika.com",
        "telefone_contacto": "+244931240304",
        "ativa": True,
        "especialidades": [],
        "cidade": "Luanda",
        "modalidades_suportadas": ["presencial", "online"],
        "preco_indicativo": None,
        "created_at": datetime.now(UTC),
    }
    base.update(over)
    return ClinicaParceiraRegisto(**base)


class RepositorioClinicasFalso:
    def __init__(self, clinica: ClinicaParceiraRegisto | None) -> None:
        self._clinica = clinica

    def listar_ativas(self):  # pragma: no cover
        raise NotImplementedError

    def listar_todas(self):  # pragma: no cover
        raise NotImplementedError

    def obter(self, clinica_id: str) -> ClinicaParceiraRegisto | None:
        return self._clinica if self._clinica and self._clinica.id == clinica_id else None

    def atualizar_perfil(self, *a, **k):  # pragma: no cover
        raise NotImplementedError


class RepositorioUtilizadoresFalso:
    def __init__(self, utilizadores: dict[str, UtilizadorRegisto] | None = None) -> None:
        self._utilizadores = utilizadores or {}

    def obter_por_email(self, email: str) -> UtilizadorRegisto | None:
        return self._utilizadores.get(email)

    def obter_por_id(self, utilizador_id: str) -> UtilizadorRegisto | None:
        return next((u for u in self._utilizadores.values() if u.id == utilizador_id), None)


class RepositorioEquipaFalso:
    def __init__(self) -> None:
        self._ligacoes: dict[str, MembroEquipaRegisto] = {}  # utilizador_id -> registo

    def obter_por_utilizador(self, utilizador_id: str) -> MembroEquipaRegisto | None:
        return self._ligacoes.get(utilizador_id)

    def listar_da_clinica(self, clinica_id: str) -> list[MembroEquipaRegisto]:
        return [m for m in self._ligacoes.values() if m.clinica_id == clinica_id]

    def criar(self, utilizador_id: str, clinica_id: str) -> MembroEquipaRegisto:
        registo = MembroEquipaRegisto(
            id=f"membro-{len(self._ligacoes) + 1}",
            utilizador_id=utilizador_id,
            utilizador_email="",
            utilizador_nome=None,
            clinica_id=clinica_id,
            created_at=datetime.now(UTC),
        )
        self._ligacoes[utilizador_id] = registo
        return registo

    def remover(self, utilizador_id: str, clinica_id: str) -> bool:
        atual = self._ligacoes.get(utilizador_id)
        if atual is None or atual.clinica_id != clinica_id:
            return False
        del self._ligacoes[utilizador_id]
        return True


def _utilizador(id_: str, email: str) -> UtilizadorRegisto:
    return UtilizadorRegisto(
        id=id_,
        email=email,
        password_hash="hash",
        papel="profissional",
        nome_completo=None,
        provincia=None,
        genero=None,
        criado_em=datetime.now(UTC),
    )


class TestAdicionar:
    def test_liga_uma_conta_existente_a_clinica(self) -> None:
        utilizadores = RepositorioUtilizadoresFalso({"dr.ana@optioptika.com": _utilizador("u-1", "dr.ana@optioptika.com")})
        equipa = RepositorioEquipaFalso()
        servico = EquipaClinicaService(equipa, RepositorioClinicasFalso(_clinica()), utilizadores)

        resultado = servico.adicionar("clinica-1", "dr.ana@optioptika.com")

        assert resultado.utilizador_id == "u-1"
        assert resultado.clinica_id == "clinica-1"

    def test_recusa_clinica_inexistente(self) -> None:
        utilizadores = RepositorioUtilizadoresFalso({"dr.ana@optioptika.com": _utilizador("u-1", "dr.ana@optioptika.com")})
        servico = EquipaClinicaService(RepositorioEquipaFalso(), RepositorioClinicasFalso(None), utilizadores)

        with pytest.raises(ClinicaNaoEncontradaError):
            servico.adicionar("clinica-1", "dr.ana@optioptika.com")

    def test_recusa_email_sem_conta(self) -> None:
        servico = EquipaClinicaService(
            RepositorioEquipaFalso(), RepositorioClinicasFalso(_clinica()), RepositorioUtilizadoresFalso()
        )

        with pytest.raises(UtilizadorNaoEncontradoError):
            servico.adicionar("clinica-1", "ninguem@example.com")

    def test_recusa_conta_ja_ligada_a_outra_clinica(self) -> None:
        utilizadores = RepositorioUtilizadoresFalso({"dr.ana@optioptika.com": _utilizador("u-1", "dr.ana@optioptika.com")})
        equipa = RepositorioEquipaFalso()
        equipa.criar("u-1", "outra-clinica")
        servico = EquipaClinicaService(equipa, RepositorioClinicasFalso(_clinica()), utilizadores)

        with pytest.raises(JaLigadoAOutraClinicaError):
            servico.adicionar("clinica-1", "dr.ana@optioptika.com")

    def test_adicionar_a_mesma_clinica_outra_vez_e_idempotente(self) -> None:
        utilizadores = RepositorioUtilizadoresFalso({"dr.ana@optioptika.com": _utilizador("u-1", "dr.ana@optioptika.com")})
        equipa = RepositorioEquipaFalso()
        equipa.criar("u-1", "clinica-1")
        servico = EquipaClinicaService(equipa, RepositorioClinicasFalso(_clinica()), utilizadores)

        resultado = servico.adicionar("clinica-1", "dr.ana@optioptika.com")

        assert resultado.clinica_id == "clinica-1"


class TestRemover:
    def test_remove_uma_ligacao_existente(self) -> None:
        equipa = RepositorioEquipaFalso()
        equipa.criar("u-1", "clinica-1")
        servico = EquipaClinicaService(equipa, RepositorioClinicasFalso(_clinica()), RepositorioUtilizadoresFalso())

        assert servico.remover("clinica-1", "u-1") is True
        assert equipa.obter_por_utilizador("u-1") is None

    def test_remover_uma_ligacao_inexistente_devolve_false(self) -> None:
        servico = EquipaClinicaService(
            RepositorioEquipaFalso(), RepositorioClinicasFalso(_clinica()), RepositorioUtilizadoresFalso()
        )
        assert servico.remover("clinica-1", "nao-ligado") is False
