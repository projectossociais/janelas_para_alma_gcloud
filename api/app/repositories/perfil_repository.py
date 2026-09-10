"""Acesso a dados do perfil — a mesma tabela `utilizadores` de
`utilizadores_repository.py`, mas a fatia de colunas que pertence ao perfil,
não à autenticação. Repositórios diferentes, mesma tabela: cada um só
conhece as colunas que lhe dizem respeito.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Protocol

from sqlalchemy.orm import Session

from app.repositories.orm_models import Utilizador


@dataclass(frozen=True)
class PerfilRegisto:
    id: str
    email: str
    papel: str
    nome_completo: str | None
    biografia: str | None
    telefone: str | None
    data_nascimento: date | None
    genero: str | None
    provincia: str | None
    avatar_url: str | None
    # `premium_ativo` já vem com a validade verificada — o frontend não
    # precisa de comparar datas. `premium_expira_em` fica para mostrar
    # "expira em X dias".
    premium_ativo: bool
    premium_expira_em: datetime | None
    notificacoes_projetos: bool
    notificacoes_lembretes: bool
    notificacoes_comunidade: bool
    criado_em: datetime


@dataclass(frozen=True)
class PerfilPatch:
    """Só os campos que o próprio utilizador pode alterar em si mesmo.
    Nunca `email`, `papel` ou `password_hash` — de propósito, não por
    esquecimento: mudar isso é responsabilidade doutros endpoints (ou de
    nenhum, no caso do papel)."""

    nome_completo: str | None = None
    biografia: str | None = None
    telefone: str | None = None
    data_nascimento: date | None = None
    genero: str | None = None
    provincia: str | None = None
    notificacoes_projetos: bool | None = None
    notificacoes_lembretes: bool | None = None
    notificacoes_comunidade: bool | None = None


class PerfilRepository(Protocol):
    def obter(self, utilizador_id: str) -> PerfilRegisto | None: ...

    def atualizar(self, utilizador_id: str, patch: PerfilPatch) -> PerfilRegisto | None: ...


class SQLAlchemyPerfilRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    @staticmethod
    def _para_registo(row: Utilizador) -> PerfilRegisto:
        expira = row.premium_expira_em
        premium_ativo = bool(row.premium_ativo) and expira is not None and expira > datetime.now(UTC)
        return PerfilRegisto(
            id=str(row.id),
            email=row.email,
            papel=row.papel.value,
            nome_completo=row.nome_completo,
            biografia=row.biografia,
            telefone=row.telefone,
            data_nascimento=row.data_nascimento,
            genero=row.genero,
            provincia=row.provincia,
            avatar_url=row.avatar_url,
            premium_ativo=premium_ativo,
            premium_expira_em=expira,
            notificacoes_projetos=row.notificacoes_projetos,
            notificacoes_lembretes=row.notificacoes_lembretes,
            notificacoes_comunidade=row.notificacoes_comunidade,
            criado_em=row.created_at,
        )

    def obter(self, utilizador_id: str) -> PerfilRegisto | None:
        row = self._sessao.get(Utilizador, uuid.UUID(utilizador_id))
        return self._para_registo(row) if row else None

    def definir_avatar_url(self, utilizador_id: str, url: str | None) -> None:
        """Fora de `atualizar`/`PerfilPatch` de propósito: `avatar_url` não
        é um campo que o utilizador escreve à mão no formulário — é o
        resultado de um upload já validado pelo `UploadService`."""
        row = self._sessao.get(Utilizador, uuid.UUID(utilizador_id))
        if row is None:
            return
        row.avatar_url = url
        self._sessao.commit()

    def atualizar(self, utilizador_id: str, patch: PerfilPatch) -> PerfilRegisto | None:
        row = self._sessao.get(Utilizador, uuid.UUID(utilizador_id))
        if row is None:
            return None

        # Só os campos explicitamente enviados — None aqui significa "não
        # mudar", não "limpar o campo" (ver PerfilService, que já separou
        # isto do que veio do pedido HTTP).
        for campo, valor in patch.__dict__.items():
            if valor is not None:
                setattr(row, campo, valor)

        self._sessao.commit()
        self._sessao.refresh(row)
        return self._para_registo(row)
