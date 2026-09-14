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
    # AUTH-02. Default `True` só para não obrigar todos os outros testes
    # (banners, premium, admin, ...) que constroem um UtilizadorRegisto à
    # mão para simular "já há sessão" a passar isto explicitamente — esses
    # fixtures representam sempre uma conta já activa. Quem cria de facto
    # (RepositorioFalso.criar() e SQLAlchemyUtilizadoresRepository.criar())
    # continua a fixar `False` explicitamente, como uma conta nova de verdade.
    email_confirmado: bool = True


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

    def atualizar_password_hash(self, utilizador_id: str, password_hash: str) -> None: ...

    def confirmar_email(self, utilizador_id: str) -> None: ...

    def agendar_eliminacao(self, utilizador_id: str, quando: datetime) -> None: ...

    def cancelar_eliminacao_se_agendada(self, utilizador_id: str) -> bool: ...

    def apagar(self, utilizador_id: str) -> None: ...


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
            email_confirmado=row.email_confirmado,
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

    def atualizar_password_hash(self, utilizador_id: str, password_hash: str) -> None:
        row = self._sessao.get(Utilizador, uuid.UUID(utilizador_id))
        if row is None:
            return
        row.password_hash = password_hash
        self._sessao.commit()

    def confirmar_email(self, utilizador_id: str) -> None:
        row = self._sessao.get(Utilizador, uuid.UUID(utilizador_id))
        if row is None:
            return
        row.email_confirmado = True
        self._sessao.commit()

    def agendar_eliminacao(self, utilizador_id: str, quando: datetime) -> None:
        row = self._sessao.get(Utilizador, uuid.UUID(utilizador_id))
        if row is None:
            return
        row.eliminar_agendado_para = quando
        self._sessao.commit()

    def cancelar_eliminacao_se_agendada(self, utilizador_id: str) -> bool:
        row = self._sessao.get(Utilizador, uuid.UUID(utilizador_id))
        if row is None or row.eliminar_agendado_para is None:
            return False
        row.eliminar_agendado_para = None
        self._sessao.commit()
        return True

    def apagar(self, utilizador_id: str) -> None:
        row = self._sessao.get(Utilizador, uuid.UUID(utilizador_id))
        if row is None:
            return
        self._sessao.delete(row)
        self._sessao.commit()
