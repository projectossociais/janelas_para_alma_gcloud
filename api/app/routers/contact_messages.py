"""Formulário de contacto do site — público (não exige sessão), como o
feedback. Sem service: só validação de forma, não decide acesso, dinheiro
nem resultado clínico (CLAUDE.md secção 3).

A notificação por email à equipa fica pendente (depende de escolher um
fornecedor de email) — mas a mensagem em si já fica guardada, que é o que
não pode perder-se.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import obter_utilizador_admin
from app.db import obter_sessao
from app.repositories.contact_messages_repository import (
    ContactMessageRegisto,
    SQLAlchemyContactMessagesRepository,
)
from app.schemas.contact_message import (
    ContactMessageAdmin,
    ContactMessageCriar,
    ContactMessageMarcar,
    ContactMessagePublico,
)

router = APIRouter(prefix="/contact-messages", tags=["contact-messages"])


def obter_contact_messages_repository(
    sessao: Session = Depends(obter_sessao),
) -> SQLAlchemyContactMessagesRepository:
    return SQLAlchemyContactMessagesRepository(sessao)


@router.post("", response_model=ContactMessagePublico, status_code=status.HTTP_201_CREATED)
def enviar_mensagem(
    dados: ContactMessageCriar,
    repo: SQLAlchemyContactMessagesRepository = Depends(obter_contact_messages_repository),
) -> ContactMessageRegisto:
    return repo.criar(
        nome=dados.nome,
        email=dados.email,
        mensagem=dados.mensagem,
        assunto=dados.assunto,
    )


# --- Leitura e gestão (só admin) --------------------------------------------
# A leitura de mensagens de contacto não é pública — protegida por
# `obter_utilizador_admin` (401 sem sessão, 403 se não-admin).


@router.get("", response_model=list[ContactMessageAdmin], dependencies=[Depends(obter_utilizador_admin)])
def listar_mensagens(
    repo: SQLAlchemyContactMessagesRepository = Depends(obter_contact_messages_repository),
) -> list[ContactMessageRegisto]:
    return repo.listar()


@router.patch(
    "/{mensagem_id}",
    response_model=ContactMessageAdmin,
    dependencies=[Depends(obter_utilizador_admin)],
)
def marcar_mensagem(
    mensagem_id: str,
    dados: ContactMessageMarcar,
    repo: SQLAlchemyContactMessagesRepository = Depends(obter_contact_messages_repository),
) -> ContactMessageRegisto:
    registo = repo.marcar_lida(mensagem_id, dados.lida)
    if registo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="mensagem não encontrada"
        )
    return registo
