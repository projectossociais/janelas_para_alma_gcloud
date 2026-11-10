"""Acesso a dados das clínicas parceiras -- leitura/escrita simples, sem
regra de negócio que o utilizador possa "mentir" sobre (CLAUDE.md secção
3): editar o perfil de uma clínica já exige `obter_utilizador_admin` no
router, e não há mais nada a validar aqui além disso."""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.repositories.orm_models import AgendamentoClinico, ClinicaParceira


@dataclass(frozen=True)
class ClinicaParceiraRegisto:
    id: str
    nome: str
    email_contacto: str
    telefone_contacto: str
    ativa: bool
    especialidades: list[str]
    cidade: str | None
    modalidades_suportadas: list[str]
    preco_indicativo: str | None
    created_at: datetime


class ClinicaParceiraRepository(Protocol):
    def listar_ativas(self) -> list[ClinicaParceiraRegisto]: ...
    def listar_todas(self) -> list[ClinicaParceiraRegisto]: ...
    def obter(self, clinica_id: str) -> ClinicaParceiraRegisto | None: ...
    def obter_para_remocao(self, clinica_id: str) -> ClinicaParceiraRegisto | None: ...
    def atualizar_perfil(
        self,
        clinica_id: str,
        especialidades: list[str],
        cidade: str | None,
        modalidades_suportadas: list[str],
        preco_indicativo: str | None,
    ) -> ClinicaParceiraRegisto | None: ...
    def criar(
        self,
        nome: str,
        email_contacto: str,
        telefone_contacto: str,
        especialidades: list[str],
        cidade: str | None,
        modalidades_suportadas: list[str],
        preco_indicativo: str | None,
    ) -> ClinicaParceiraRegisto: ...
    def tem_agendamentos(self, clinica_id: str) -> bool: ...
    def definir_ativa(self, clinica_id: str, ativa: bool) -> ClinicaParceiraRegisto | None: ...
    def apagar(self, clinica_id: str) -> bool: ...


def _para_registo(row: ClinicaParceira) -> ClinicaParceiraRegisto:
    return ClinicaParceiraRegisto(
        id=str(row.id),
        nome=row.nome,
        email_contacto=row.email_contacto,
        telefone_contacto=row.telefone_contacto,
        ativa=row.ativa,
        especialidades=list(row.especialidades or []),
        cidade=row.cidade,
        modalidades_suportadas=list(row.modalidades_suportadas or []),
        preco_indicativo=row.preco_indicativo,
        created_at=row.created_at,
    )


class SQLAlchemyClinicaParceiraRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def listar_ativas(self) -> list[ClinicaParceiraRegisto]:
        linhas = self._sessao.scalars(
            select(ClinicaParceira).where(ClinicaParceira.ativa.is_(True)).order_by(ClinicaParceira.nome)
        ).all()
        return [_para_registo(r) for r in linhas]

    def listar_todas(self) -> list[ClinicaParceiraRegisto]:
        linhas = self._sessao.scalars(select(ClinicaParceira).order_by(ClinicaParceira.nome)).all()
        return [_para_registo(r) for r in linhas]

    def obter(self, clinica_id: str) -> ClinicaParceiraRegisto | None:
        row = self._sessao.get(ClinicaParceira, uuid.UUID(clinica_id))
        return _para_registo(row) if row is not None else None

    def obter_para_remocao(self, clinica_id: str) -> ClinicaParceiraRegisto | None:
        row = self._sessao.scalar(
            select(ClinicaParceira)
            .where(ClinicaParceira.id == uuid.UUID(clinica_id))
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        return _para_registo(row) if row is not None else None

    def atualizar_perfil(
        self,
        clinica_id: str,
        especialidades: list[str],
        cidade: str | None,
        modalidades_suportadas: list[str],
        preco_indicativo: str | None,
    ) -> ClinicaParceiraRegisto | None:
        row = self._sessao.get(ClinicaParceira, uuid.UUID(clinica_id))
        if row is None:
            return None
        row.especialidades = especialidades
        row.cidade = cidade
        row.modalidades_suportadas = modalidades_suportadas
        row.preco_indicativo = preco_indicativo
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row)

    def criar(
        self,
        nome: str,
        email_contacto: str,
        telefone_contacto: str,
        especialidades: list[str],
        cidade: str | None,
        modalidades_suportadas: list[str],
        preco_indicativo: str | None,
    ) -> ClinicaParceiraRegisto:
        row = ClinicaParceira(
            nome=nome,
            email_contacto=email_contacto,
            telefone_contacto=telefone_contacto,
            ativa=True,
            especialidades=especialidades,
            cidade=cidade,
            modalidades_suportadas=modalidades_suportadas,
            preco_indicativo=preco_indicativo,
        )
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row)

    def tem_agendamentos(self, clinica_id: str) -> bool:
        return bool(
            self._sessao.scalar(
                select(exists().where(AgendamentoClinico.clinica_id == uuid.UUID(clinica_id)))
            )
        )

    def definir_ativa(self, clinica_id: str, ativa: bool) -> ClinicaParceiraRegisto | None:
        row = self._sessao.get(ClinicaParceira, uuid.UUID(clinica_id))
        if row is None:
            return None
        row.ativa = ativa
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row)

    def apagar(self, clinica_id: str) -> bool:
        """A equipa e a disponibilidade vão com ela (`ON DELETE CASCADE`).
        Os agendamentos têm `RESTRICT`: quem chama verifica-os antes
        (`ClinicaParceiraService.remover`)."""
        row = self._sessao.get(ClinicaParceira, uuid.UUID(clinica_id))
        if row is None:
            return False
        self._sessao.delete(row)
        self._sessao.commit()
        return True
