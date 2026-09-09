"""Acesso a dados de utilizadores.

`UtilizadoresRepository` é o contrato (Protocol) de que o service depende —
não a implementação concreta. Isto é o que permite testar `auth_service.py`
sem base de dados nenhuma (ver tests/services/test_auth_service.py, que usa
um `RepositorioFalso` a implementar o mesmo contrato).
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy.orm import Session

from app.repositories.orm_models import AppRole, Utilizador


@dataclass(frozen=True)
class UtilizadorRegisto:
    """Representação interna de um utilizador — não é o schema da API nem o
    modelo ORM. É o que o service manipula, independente de ambos.

    Só os campos que a autenticação precisa de conhecer directamente. O
    resto do perfil (biografia, telefone, avatar, ...) vive só no modelo ORM
    até existir um serviço de perfil próprio — ver docs/BACKLOG.md."""

    id: str
    email: str
    password_hash: str
    papel: str
    nome_completo: str | None
    provincia: str | None
    genero: str | None
    criado_em: datetime


class UtilizadoresRepository(Protocol):
    def obter_por_email(self, email: str) -> UtilizadorRegisto | None: ...

    def obter_por_id(self, utilizador_id: str) -> UtilizadorRegisto | None: ...

    def criar(
        self,
        email: str,
        password_hash: str,
        papel: str = "comum",
        nome_completo: str | None = None,
        provincia: str | None = None,
        genero: str | None = None,
    ) -> UtilizadorRegisto: ...


class SQLAlchemyUtilizadoresRepository:
    """Implementação real, usada pela API. Ver app/db.py para a sessão."""

    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    @staticmethod
    def _para_registo(row: Utilizador) -> UtilizadorRegisto:
        return UtilizadorRegisto(
            id=str(row.id),
            email=row.email,
            password_hash=row.password_hash,
            papel=row.papel.value,
            nome_completo=row.nome_completo,
            provincia=row.provincia,
            genero=row.genero,
            criado_em=row.created_at,
        )

    def obter_por_email(self, email: str) -> UtilizadorRegisto | None:
        row = self._sessao.query(Utilizador).filter(Utilizador.email == email).one_or_none()
        return self._para_registo(row) if row else None

    def obter_por_id(self, utilizador_id: str) -> UtilizadorRegisto | None:
        row = self._sessao.get(Utilizador, uuid.UUID(utilizador_id))
        return self._para_registo(row) if row else None

    def criar(
        self,
        email: str,
        password_hash: str,
        papel: str = "comum",
        nome_completo: str | None = None,
        provincia: str | None = None,
        genero: str | None = None,
    ) -> UtilizadorRegisto:
        row = Utilizador(
            email=email,
            password_hash=password_hash,
            papel=AppRole(papel),
            nome_completo=nome_completo,
            provincia=provincia,
            genero=genero,
        )
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return self._para_registo(row)
