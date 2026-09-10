"""Mensagens de contacto do site. Escrita pública simples — o router fala
directo com este repository, sem service (ver CLAUDE.md secção 3: guardar
uma mensagem de contacto não decide acesso, dinheiro nem resultado
clínico). Sem `try/except` à volta do `commit()`: se falhar, a excepção
propaga e o frontend nunca vê um "enviado" falso.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

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
        return ContactMessageRegisto(
            id=str(row.id),
            nome=row.nome,
            email=row.email,
            assunto=row.assunto,
            mensagem=row.mensagem,
            lida=bool(row.lida),
            created_at=row.created_at,
        )
