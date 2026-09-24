"""Perfil de clínica, equipa (login próprio) e portal da clínica.

Ver `core/dependencies.py` (`obter_clinica_do_utilizador`) para o porquê de
a ligação conta→clínica nunca poder vir do papel `profissional` sozinho.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import (
    obter_clinica_do_utilizador,
    obter_clinica_parceira_repository,
    obter_equipa_clinica_repository,
    obter_utilizador_admin,
    obter_utilizador_atual,
)
from app.db import obter_sessao
from app.repositories.agendamento_clinico_repository import (
    AgendamentoClinicoRegisto,
    SQLAlchemyAgendamentoClinicoRepository,
)
from app.repositories.clinica_parceira_repository import (
    ClinicaParceiraRegisto,
    SQLAlchemyClinicaParceiraRepository,
)
from app.repositories.equipa_clinica_repository import (
    MembroEquipaRegisto,
    SQLAlchemyEquipaClinicaRepository,
)
from app.repositories.utilizadores_repository import (
    SQLAlchemyUtilizadoresRepository,
    UtilizadorRegisto,
)
from app.schemas.agendamento import AgendamentoClinicoAdmin
from app.schemas.clinica import (
    ClinicaParceiraAdmin,
    ClinicaPerfilAtualizar,
    EquipaClinicaAdicionar,
    MembroEquipaPublico,
)
from app.services.equipa_clinica_service import (
    ClinicaNaoEncontradaError,
    EquipaClinicaService,
    JaLigadoAOutraClinicaError,
    UtilizadorNaoEncontradoError,
)

router = APIRouter(tags=["clinicas"])


def obter_agendamento_clinico_repository(
    sessao: Session = Depends(obter_sessao),
) -> SQLAlchemyAgendamentoClinicoRepository:
    return SQLAlchemyAgendamentoClinicoRepository(sessao)


def obter_equipa_clinica_service(
    equipa: SQLAlchemyEquipaClinicaRepository = Depends(obter_equipa_clinica_repository),
    clinicas: SQLAlchemyClinicaParceiraRepository = Depends(obter_clinica_parceira_repository),
    sessao: Session = Depends(obter_sessao),
) -> EquipaClinicaService:
    return EquipaClinicaService(equipa, clinicas, SQLAlchemyUtilizadoresRepository(sessao))


# --- Portal da própria clínica ----------------------------------------------


@router.get("/clinica/eu", response_model=ClinicaParceiraAdmin | None)
def a_minha_clinica(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    equipa: SQLAlchemyEquipaClinicaRepository = Depends(obter_equipa_clinica_repository),
    clinicas: SQLAlchemyClinicaParceiraRepository = Depends(obter_clinica_parceira_repository),
) -> ClinicaParceiraRegisto | None:
    """Nunca 403 -- é assim que o frontend distingue "esta conta não é de
    uma clínica" de um erro. Quem precisa de bloquear a sério usa
    `obter_clinica_do_utilizador` (ver `/clinica/agendamentos` abaixo)."""
    membro = equipa.obter_por_utilizador(utilizador.id)
    if membro is None:
        return None
    return clinicas.obter(membro.clinica_id)


@router.get("/clinica/agendamentos", response_model=list[AgendamentoClinicoAdmin])
def meus_agendamentos(
    clinica: ClinicaParceiraRegisto = Depends(obter_clinica_do_utilizador),
    repo: SQLAlchemyAgendamentoClinicoRepository = Depends(obter_agendamento_clinico_repository),
) -> list[AgendamentoClinicoRegisto]:
    return [a for a in repo.listar() if a.clinica_id == clinica.id]


# --- Administração -----------------------------------------------------------


@router.get(
    "/admin/clinicas", response_model=list[ClinicaParceiraAdmin], dependencies=[Depends(obter_utilizador_admin)]
)
def listar_clinicas_admin(
    repo: SQLAlchemyClinicaParceiraRepository = Depends(obter_clinica_parceira_repository),
) -> list[ClinicaParceiraRegisto]:
    return repo.listar_todas()


@router.patch(
    "/admin/clinicas/{clinica_id}",
    response_model=ClinicaParceiraAdmin,
    dependencies=[Depends(obter_utilizador_admin)],
)
def atualizar_perfil_clinica(
    clinica_id: str,
    dados: ClinicaPerfilAtualizar,
    repo: SQLAlchemyClinicaParceiraRepository = Depends(obter_clinica_parceira_repository),
) -> ClinicaParceiraRegisto:
    resultado = repo.atualizar_perfil(
        clinica_id,
        especialidades=dados.especialidades,
        cidade=dados.cidade,
        modalidades_suportadas=dados.modalidades_suportadas,
        preco_indicativo=dados.preco_indicativo,
    )
    if resultado is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="clínica não encontrada")
    return resultado


@router.get(
    "/admin/clinicas/{clinica_id}/equipa",
    response_model=list[MembroEquipaPublico],
    dependencies=[Depends(obter_utilizador_admin)],
)
def listar_equipa(
    clinica_id: str,
    repo: SQLAlchemyEquipaClinicaRepository = Depends(obter_equipa_clinica_repository),
) -> list[MembroEquipaRegisto]:
    return repo.listar_da_clinica(clinica_id)


@router.post(
    "/admin/clinicas/{clinica_id}/equipa",
    response_model=MembroEquipaPublico,
    status_code=status.HTTP_201_CREATED,
)
def adicionar_membro(
    clinica_id: str,
    dados: EquipaClinicaAdicionar,
    admin: UtilizadorRegisto = Depends(obter_utilizador_admin),
    servico: EquipaClinicaService = Depends(obter_equipa_clinica_service),
) -> MembroEquipaRegisto:
    try:
        return servico.adicionar(clinica_id, dados.email)
    except ClinicaNaoEncontradaError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="clínica não encontrada") from exc
    except UtilizadorNaoEncontradoError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="não existe nenhuma conta com este email"
        ) from exc
    except JaLigadoAOutraClinicaError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="esta conta já está ligada a outra clínica"
        ) from exc


@router.delete(
    "/admin/clinicas/{clinica_id}/equipa/{utilizador_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(obter_utilizador_admin)],
)
def remover_membro(
    clinica_id: str,
    utilizador_id: str,
    servico: EquipaClinicaService = Depends(obter_equipa_clinica_service),
) -> None:
    if not servico.remover(clinica_id, utilizador_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ligação não encontrada")
