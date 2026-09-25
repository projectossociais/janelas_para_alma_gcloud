"""Pedidos de consulta clínica -- ver services/agendamento_clinico_service.py.

Não exige sessão: pedir uma consulta é um pedido pontual, não uma relação
contínua como o voluntariado (que exige conta, ver routers/voluntariado.py).
Quando parte de uma sessão activa, liga-se ao utilizador via sessão opcional
(mesmo padrão de POST /jogo/validar).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import (
    obter_disponibilidade_clinica_repository,
    obter_email_sender,
    obter_teleconsulta_repository,
    obter_utilizador_admin,
    obter_utilizador_atual_opcional,
)
from app.core.email import EmailSender
from app.db import obter_sessao
from app.repositories.agendamento_clinico_repository import (
    AgendamentoClinicoRegisto,
    SQLAlchemyAgendamentoClinicoRepository,
)
from app.repositories.clinica_parceira_repository import (
    ClinicaParceiraRegisto,
    SQLAlchemyClinicaParceiraRepository,
)
from app.repositories.disponibilidade_clinica_repository import (
    SQLAlchemyDisponibilidadeClinicaRepository,
)
from app.repositories.teleconsulta_repository import SQLAlchemyTeleconsultaRepository
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.schemas.agendamento import (
    AgendamentoClinicoAdmin,
    AgendamentoClinicoCriar,
    AgendamentoClinicoPublico,
    ClinicaParceiraPublica,
    HorarioDisponivel,
    Modalidade,
)
from app.services.agendamento_clinico_service import (
    AgendamentoClinicoService,
    AgendamentoJaDecididoError,
    AgendamentoNaoEncontradoError,
    ClinicaNaoEncontradaError,
    HorarioIndisponivelError,
)

router = APIRouter(tags=["agendamentos"])


def obter_clinica_parceira_repository(
    sessao: Session = Depends(obter_sessao),
) -> SQLAlchemyClinicaParceiraRepository:
    return SQLAlchemyClinicaParceiraRepository(sessao)


def obter_agendamento_clinico_repository(
    sessao: Session = Depends(obter_sessao),
) -> SQLAlchemyAgendamentoClinicoRepository:
    return SQLAlchemyAgendamentoClinicoRepository(sessao)


def obter_agendamento_clinico_service(
    agendamentos: SQLAlchemyAgendamentoClinicoRepository = Depends(obter_agendamento_clinico_repository),
    clinicas: SQLAlchemyClinicaParceiraRepository = Depends(obter_clinica_parceira_repository),
    disponibilidades: SQLAlchemyDisponibilidadeClinicaRepository = Depends(
        obter_disponibilidade_clinica_repository
    ),
    teleconsultas: SQLAlchemyTeleconsultaRepository = Depends(obter_teleconsulta_repository),
    email_sender: EmailSender = Depends(obter_email_sender),
) -> AgendamentoClinicoService:
    return AgendamentoClinicoService(agendamentos, clinicas, disponibilidades, teleconsultas, email_sender)


@router.get("/clinicas", response_model=list[ClinicaParceiraPublica])
def listar_clinicas(
    repo: SQLAlchemyClinicaParceiraRepository = Depends(obter_clinica_parceira_repository),
) -> list[ClinicaParceiraRegisto]:
    return repo.listar_ativas()


@router.get("/clinicas/{clinica_id}/horarios", response_model=list[HorarioDisponivel])
def listar_horarios_disponiveis(
    clinica_id: str,
    modalidade: Modalidade,
    servico: AgendamentoClinicoService = Depends(obter_agendamento_clinico_service),
) -> list[HorarioDisponivel]:
    try:
        return servico.horarios_disponiveis(clinica_id, modalidade)
    except ClinicaNaoEncontradaError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="clínica não encontrada") from exc


@router.post("/agendamentos", response_model=AgendamentoClinicoPublico, status_code=status.HTTP_201_CREATED)
def pedir_agendamento(
    dados: AgendamentoClinicoCriar,
    utilizador: UtilizadorRegisto | None = Depends(obter_utilizador_atual_opcional),
    servico: AgendamentoClinicoService = Depends(obter_agendamento_clinico_service),
) -> AgendamentoClinicoRegisto:
    try:
        return servico.pedir(
            clinica_id=dados.clinica_id,
            nome=dados.nome,
            email=dados.email,
            telefone=dados.telefone,
            modalidade=dados.modalidade,
            horario_inicio=dados.horario_inicio,
            motivo=dados.motivo,
            utilizador_id=utilizador.id if utilizador else None,
            screening_id=dados.screening_id,
        )
    except ClinicaNaoEncontradaError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="clínica não encontrada") from exc
    except HorarioIndisponivelError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="este horário deixou de estar disponível"
        ) from exc


@router.get(
    "/admin/agendamentos",
    response_model=list[AgendamentoClinicoAdmin],
    dependencies=[Depends(obter_utilizador_admin)],
)
def listar_agendamentos(
    repo: SQLAlchemyAgendamentoClinicoRepository = Depends(obter_agendamento_clinico_repository),
) -> list[AgendamentoClinicoRegisto]:
    return repo.listar()


@router.post("/admin/agendamentos/{agendamento_id}/confirmar", response_model=AgendamentoClinicoAdmin)
def confirmar_agendamento(
    agendamento_id: str,
    admin: UtilizadorRegisto = Depends(obter_utilizador_admin),
    servico: AgendamentoClinicoService = Depends(obter_agendamento_clinico_service),
) -> AgendamentoClinicoRegisto:
    try:
        return servico.confirmar(agendamento_id, admin.id)
    except AgendamentoNaoEncontradoError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="agendamento não encontrado") from exc
    except AgendamentoJaDecididoError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="este agendamento já foi decidido") from exc


@router.post("/admin/agendamentos/{agendamento_id}/recusar", response_model=AgendamentoClinicoAdmin)
def recusar_agendamento(
    agendamento_id: str,
    admin: UtilizadorRegisto = Depends(obter_utilizador_admin),
    servico: AgendamentoClinicoService = Depends(obter_agendamento_clinico_service),
) -> AgendamentoClinicoRegisto:
    try:
        return servico.recusar(agendamento_id, admin.id)
    except AgendamentoNaoEncontradoError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="agendamento não encontrado") from exc
    except AgendamentoJaDecididoError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="este agendamento já foi decidido") from exc
