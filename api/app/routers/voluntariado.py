"""Voluntariado: candidatura, actividades publicadas por um admin, e
inscrições dos voluntários activos nelas.

Candidatar-se exige sessão (ver docs/BACKLOG.md — decisão do dono do
projecto: sem conta não há como ligar "as minhas actividades" nem
notificações). Publicar/cancelar actividades e decidir candidaturas exigem
`papel: admin`, via `obter_utilizador_admin`.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import obter_email_sender, obter_utilizador_admin, obter_utilizador_atual
from app.core.email import EmailSender
from app.db import obter_sessao
from app.repositories.atividade_voluntariado_repository import (
    AtividadeVoluntariadoRegisto,
    InscricaoAtividadeRegisto,
    SQLAlchemyAtividadeVoluntariadoRepository,
)
from app.repositories.candidatura_voluntariado_repository import (
    CandidaturaVoluntariadoRegisto,
    SQLAlchemyCandidaturaVoluntariadoRepository,
)
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.schemas.voluntariado import (
    AtividadeVoluntariadoAdmin,
    AtividadeVoluntariadoCriar,
    AtividadeVoluntariadoPublica,
    CandidaturaVoluntariadoAdmin,
    CandidaturaVoluntariadoCriar,
    CandidaturaVoluntariadoPublica,
    InscricaoAtividadeAdmin,
    InscricaoAtividadePublica,
)
from app.services.atividade_voluntariado_service import (
    AtividadeNaoEncontradaError,
    AtividadeNaoPublicadaError,
    AtividadeVoluntariadoService,
    InscricaoNaoEncontradaError,
    JaInscritoError,
    NaoEVoluntarioAtivoError,
    SemVagasError,
)
from app.services.candidatura_voluntariado_service import (
    CandidaturaJaDecididaError,
    CandidaturaJaExisteError,
    CandidaturaNaoEncontradaError,
    CandidaturaVoluntariadoService,
)

router = APIRouter(prefix="/voluntariado", tags=["voluntariado"])


def obter_candidatura_repository(
    sessao: Session = Depends(obter_sessao),
) -> SQLAlchemyCandidaturaVoluntariadoRepository:
    return SQLAlchemyCandidaturaVoluntariadoRepository(sessao)


def obter_candidatura_service(
    repo: SQLAlchemyCandidaturaVoluntariadoRepository = Depends(obter_candidatura_repository),
    email_sender: EmailSender = Depends(obter_email_sender),
) -> CandidaturaVoluntariadoService:
    return CandidaturaVoluntariadoService(repo, email_sender)


def obter_atividade_repository(
    sessao: Session = Depends(obter_sessao),
) -> SQLAlchemyAtividadeVoluntariadoRepository:
    return SQLAlchemyAtividadeVoluntariadoRepository(sessao)


def obter_atividade_service(
    repo: SQLAlchemyAtividadeVoluntariadoRepository = Depends(obter_atividade_repository),
    email_sender: EmailSender = Depends(obter_email_sender),
) -> AtividadeVoluntariadoService:
    return AtividadeVoluntariadoService(repo, email_sender)


# --- candidatura -------------------------------------------------------


@router.post(
    "/candidatar", response_model=CandidaturaVoluntariadoPublica, status_code=status.HTTP_201_CREATED
)
def candidatar(
    dados: CandidaturaVoluntariadoCriar,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: CandidaturaVoluntariadoService = Depends(obter_candidatura_service),
) -> CandidaturaVoluntariadoRegisto:
    try:
        return servico.candidatar(utilizador.id, dados.motivacao, dados.telefone)
    except CandidaturaJaExisteError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="já tem uma candidatura pendente ou aprovada",
        ) from exc


@router.get("/candidatura", response_model=CandidaturaVoluntariadoPublica | None)
def a_minha_candidatura(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    repo: SQLAlchemyCandidaturaVoluntariadoRepository = Depends(obter_candidatura_repository),
) -> CandidaturaVoluntariadoRegisto | None:
    return repo.obter_por_utilizador(utilizador.id)


@router.get(
    "/candidaturas",
    response_model=list[CandidaturaVoluntariadoAdmin],
    dependencies=[Depends(obter_utilizador_admin)],
)
def listar_candidaturas(
    repo: SQLAlchemyCandidaturaVoluntariadoRepository = Depends(obter_candidatura_repository),
) -> list[CandidaturaVoluntariadoRegisto]:
    return repo.listar()


@router.post("/candidaturas/{candidatura_id}/aprovar", response_model=CandidaturaVoluntariadoAdmin)
def aprovar_candidatura(
    candidatura_id: str,
    admin: UtilizadorRegisto = Depends(obter_utilizador_admin),
    servico: CandidaturaVoluntariadoService = Depends(obter_candidatura_service),
) -> CandidaturaVoluntariadoRegisto:
    try:
        return servico.aprovar(candidatura_id, admin.id)
    except CandidaturaNaoEncontradaError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="candidatura não encontrada"
        ) from exc
    except CandidaturaJaDecididaError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="esta candidatura já foi decidida"
        ) from exc


@router.post("/candidaturas/{candidatura_id}/rejeitar", response_model=CandidaturaVoluntariadoAdmin)
def rejeitar_candidatura(
    candidatura_id: str,
    admin: UtilizadorRegisto = Depends(obter_utilizador_admin),
    servico: CandidaturaVoluntariadoService = Depends(obter_candidatura_service),
) -> CandidaturaVoluntariadoRegisto:
    try:
        return servico.rejeitar(candidatura_id, admin.id)
    except CandidaturaNaoEncontradaError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="candidatura não encontrada"
        ) from exc
    except CandidaturaJaDecididaError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="esta candidatura já foi decidida"
        ) from exc


# --- actividades ---------------------------------------------------------


@router.post(
    "/atividades",
    response_model=AtividadeVoluntariadoAdmin,
    status_code=status.HTTP_201_CREATED,
)
def publicar_atividade(
    dados: AtividadeVoluntariadoCriar,
    admin: UtilizadorRegisto = Depends(obter_utilizador_admin),
    servico: AtividadeVoluntariadoService = Depends(obter_atividade_service),
) -> AtividadeVoluntariadoRegisto:
    return servico.publicar(
        admin.id,
        dados.titulo,
        dados.descricao,
        dados.local,
        dados.data_inicio,
        dados.data_fim,
        dados.vagas,
    )


@router.get("/atividades", response_model=list[AtividadeVoluntariadoPublica])
def listar_atividades(
    _utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: AtividadeVoluntariadoService = Depends(obter_atividade_service),
) -> list[AtividadeVoluntariadoRegisto]:
    return servico.listar_publicadas()


@router.get(
    "/atividades/todas",
    response_model=list[AtividadeVoluntariadoAdmin],
    dependencies=[Depends(obter_utilizador_admin)],
)
def listar_todas_as_atividades(
    servico: AtividadeVoluntariadoService = Depends(obter_atividade_service),
) -> list[AtividadeVoluntariadoRegisto]:
    return servico.listar_todas()


@router.post("/atividades/{atividade_id}/cancelar", response_model=AtividadeVoluntariadoAdmin)
def cancelar_atividade(
    atividade_id: str,
    admin: UtilizadorRegisto = Depends(obter_utilizador_admin),
    servico: AtividadeVoluntariadoService = Depends(obter_atividade_service),
) -> AtividadeVoluntariadoRegisto:
    try:
        return servico.cancelar(atividade_id)
    except AtividadeNaoEncontradaError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="actividade não encontrada"
        ) from exc


@router.get(
    "/atividades/{atividade_id}/inscritos",
    response_model=list[InscricaoAtividadeAdmin],
)
def listar_inscritos(
    atividade_id: str,
    _admin: UtilizadorRegisto = Depends(obter_utilizador_admin),
    servico: AtividadeVoluntariadoService = Depends(obter_atividade_service),
) -> list[InscricaoAtividadeRegisto]:
    try:
        return servico.listar_inscritos(atividade_id)
    except AtividadeNaoEncontradaError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="actividade não encontrada"
        ) from exc


# --- inscrições ------------------------------------------------------------


@router.post(
    "/atividades/{atividade_id}/inscrever",
    response_model=InscricaoAtividadePublica,
    status_code=status.HTTP_201_CREATED,
)
def inscrever(
    atividade_id: str,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: AtividadeVoluntariadoService = Depends(obter_atividade_service),
) -> InscricaoAtividadeRegisto:
    try:
        return servico.inscrever(atividade_id, utilizador.id, utilizador.email)
    except AtividadeNaoEncontradaError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="actividade não encontrada"
        ) from exc
    except AtividadeNaoPublicadaError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="esta actividade já não está disponível"
        ) from exc
    except NaoEVoluntarioAtivoError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="só voluntários activos se podem inscrever em actividades",
        ) from exc
    except JaInscritoError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="já está inscrito nesta actividade"
        ) from exc
    except SemVagasError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="já não há vagas") from exc


@router.delete("/atividades/{atividade_id}/inscrever", response_model=InscricaoAtividadePublica)
def cancelar_inscricao(
    atividade_id: str,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: AtividadeVoluntariadoService = Depends(obter_atividade_service),
) -> InscricaoAtividadeRegisto:
    try:
        return servico.cancelar_inscricao(atividade_id, utilizador.id)
    except InscricaoNaoEncontradaError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="não está inscrito nesta actividade"
        ) from exc


@router.get("/minhas-inscricoes", response_model=list[InscricaoAtividadePublica])
def minhas_inscricoes(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: AtividadeVoluntariadoService = Depends(obter_atividade_service),
) -> list[InscricaoAtividadeRegisto]:
    return servico.listar_minhas_inscricoes(utilizador.id)
