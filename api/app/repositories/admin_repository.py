"""Acesso a dados para o painel de administração: listar utilizadores e
mudar o `papel` de um deles.

Separado de `utilizadores_repository.py` (a fatia da autenticação) porque é
outra preocupação — quem pode ver e promover contas é o admin, não o dono
da conta. Mudar `papel` é acção sensível (CLAUDE.md §10): só chega aqui
depois de `obter_utilizador_admin` no router, e o `criar_admin` (CLI) é a
única forma de fazer o primeiro.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.repositories.orm_models import AppRole, Utilizador

# Nenhum admin devia ter de adivinhar "quantos dias contam como recentes" —
# ver /admin/estatisticas, que já usa o mesmo período (7/30/365) escolhido
# no filtro Semanal/Mensal/Anual do topo do dashboard.


@dataclass(frozen=True)
class AdminUtilizadorRegisto:
    id: str
    email: str
    nome_completo: str | None
    papel: str
    premium_ativo: bool
    criado_em: datetime


class AdminRepository(Protocol):
    def listar(self, papel: str | None = None, desde: datetime | None = None) -> list[AdminUtilizadorRegisto]: ...
    def obter_por_email(self, email: str) -> AdminUtilizadorRegisto | None: ...
    def obter_por_id(self, utilizador_id: str) -> AdminUtilizadorRegisto | None: ...
    def definir_papel(self, utilizador_id: str, papel: str) -> AdminUtilizadorRegisto | None: ...


def _para_registo(row: Utilizador) -> AdminUtilizadorRegisto:
    return AdminUtilizadorRegisto(
        id=str(row.id),
        email=row.email,
        nome_completo=row.nome_completo,
        papel=row.papel.value,
        premium_ativo=bool(row.premium_ativo),
        criado_em=row.created_at,
    )


class SQLAlchemyAdminRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def listar(self, papel: str | None = None, desde: datetime | None = None) -> list[AdminUtilizadorRegisto]:
        consulta = select(Utilizador).order_by(Utilizador.created_at.desc())
        if papel is not None:
            consulta = consulta.where(Utilizador.papel == AppRole(papel))
        if desde is not None:
            consulta = consulta.where(Utilizador.created_at >= desde)
        return [_para_registo(linha) for linha in self._sessao.scalars(consulta).all()]

    def obter_por_email(self, email: str) -> AdminUtilizadorRegisto | None:
        row = (
            self._sessao.query(Utilizador)
            .filter(Utilizador.email == email.strip().lower())
            .one_or_none()
        )
        return _para_registo(row) if row else None

    def obter_por_id(self, utilizador_id: str) -> AdminUtilizadorRegisto | None:
        row = self._sessao.get(Utilizador, uuid.UUID(utilizador_id))
        return _para_registo(row) if row else None

    def definir_papel(self, utilizador_id: str, papel: str) -> AdminUtilizadorRegisto | None:
        row = self._sessao.get(Utilizador, uuid.UUID(utilizador_id))
        if row is None:
            return None
        row.papel = AppRole(papel)
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row)
