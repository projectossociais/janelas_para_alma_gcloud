"""W-11 — pedidos de Premium e aprovação de pagamento.

`POST /premium-requests` é público (o formulário funciona com ou sem
sessão); a listagem e as decisões (aprovar / revogar) exigem `papel: admin`
via `obter_utilizador_admin`. A activação em si é lógica de dinheiro e
acesso — vive no `PremiumService`, ver CLAUDE.md §3/§10.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import (
    obter_utilizador_admin,
    obter_utilizador_atual_opcional,
)
from app.db import obter_sessao
from app.repositories.premium_repository import PedidoPremiumRegisto, SQLAlchemyPremiumRepository
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.schemas.premium import (
    PedidoPremiumAdmin,
    PedidoPremiumCriar,
    PedidoPremiumPublico,
)
from app.services.premium_service import (
    PedidoJaAprovadoError,
    PedidoNaoEncontradoError,
    PedidoSemContaError,
    PremiumService,
)

router = APIRouter(prefix="/premium-requests", tags=["premium"])


def obter_premium_service(sessao: Session = Depends(obter_sessao)) -> PremiumService:
    return PremiumService(SQLAlchemyPremiumRepository(sessao))


def obter_premium_repository(sessao: Session = Depends(obter_sessao)) -> SQLAlchemyPremiumRepository:
    return SQLAlchemyPremiumRepository(sessao)


@router.post("", response_model=PedidoPremiumPublico, status_code=status.HTTP_201_CREATED)
def criar_pedido(
    dados: PedidoPremiumCriar,
    utilizador: UtilizadorRegisto | None = Depends(obter_utilizador_atual_opcional),
    repo: SQLAlchemyPremiumRepository = Depends(obter_premium_repository),
) -> PedidoPremiumRegisto:
    return repo.criar(
        nome=dados.nome,
        email=dados.email,
        telefone=dados.telefone,
        plano=dados.plano,
        user_id=utilizador.id if utilizador else None,
    )


@router.get(
    "", response_model=list[PedidoPremiumAdmin], dependencies=[Depends(obter_utilizador_admin)]
)
def listar_pedidos(
    repo: SQLAlchemyPremiumRepository = Depends(obter_premium_repository),
) -> list[PedidoPremiumRegisto]:
    return repo.listar()


@router.post("/{pedido_id}/aprovar", response_model=PedidoPremiumAdmin)
def aprovar_pagamento(
    pedido_id: str,
    admin: UtilizadorRegisto = Depends(obter_utilizador_admin),
    servico: PremiumService = Depends(obter_premium_service),
) -> PedidoPremiumRegisto:
    try:
        return servico.aprovar_pagamento(pedido_id, admin.id)
    except PedidoNaoEncontradoError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="pedido não encontrado") from exc
    except PedidoJaAprovadoError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="este pedido já foi aprovado"
        ) from exc
    except PedidoSemContaError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="o pedido não está ligado a uma conta — não há Premium para activar",
        ) from exc


@router.post("/{pedido_id}/revogar", response_model=PedidoPremiumAdmin)
def revogar_premium(
    pedido_id: str,
    admin: UtilizadorRegisto = Depends(obter_utilizador_admin),
    servico: PremiumService = Depends(obter_premium_service),
) -> PedidoPremiumRegisto:
    try:
        return servico.revogar(pedido_id, admin.id)
    except PedidoNaoEncontradoError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="pedido não encontrado") from exc
