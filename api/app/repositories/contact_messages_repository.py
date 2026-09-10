"""Mensagens de contacto do site. Escrita pública simples — o router fala
directo com este repository, sem service (ver CLAUDE.md secção 3: guardar
uma mensagem de contacto não decide acesso, dinheiro nem resultado
clínico). Sem `try/except` à volta do `commit()`: se falhar, a excepção
propaga e o frontend nunca vê um "enviado" falso.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.repositories.orm_models import ContactMessage


@dataclass(frozen=True)
class ContactMessageRegisto:
    id: str
    nome: str
    email: str
    assunto: str | None
    mensagem: str
    lida: bool
    created_at: datetime


class ContactMessagesRepository(Protocol):
    def criar(
        self, nome: str, email: str, mensagem: str, assunto: str | None
    ) -> ContactMessageRegisto: ...
    def listar(self) -> list[ContactMessageRegisto]: ...
    def marcar_lida(self, mensagem_id: str, lida: bool) -> ContactMessageRegisto | None: ...


def _para_registo(row: ContactMessage) -> ContactMessageRegisto:
    return ContactMessageRegisto(
        id=str(row.id),
        nome=row.nome,
        email=row.email,
        assunto=row.assunto,
        mensagem=row.mensagem,
        lida=bool(row.lida),
        created_at=row.created_at,
    )


class SQLAlchemyContactMessagesRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def criar(
        self, nome: str, email: str, mensagem: str, assunto: str | None
    ) -> ContactMessageRegisto:
        row = ContactMessage(nome=nome, email=email, mensagem=mensagem, assunto=assunto)
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row)

    def listar(self) -> list[ContactMessageRegisto]:
        linhas = self._sessao.scalars(
            select(ContactMessage).order_by(ContactMessage.created_at.desc())
        ).all()
        return [_para_registo(linha) for linha in linhas]

    def marcar_lida(self, mensagem_id: str, lida: bool) -> ContactMessageRegisto | None:
        row = self._sessao.get(ContactMessage, uuid.UUID(mensagem_id))
        if row is None:
            return None
        row.lida = lida
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row)
