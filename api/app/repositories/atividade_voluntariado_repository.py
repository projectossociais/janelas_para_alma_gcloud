"""Acesso a dados de actividades de voluntariado e das inscrições nelas.

As duas coisas vivem no mesmo repository porque uma inscrição só faz
sentido no contexto da sua actividade — é um único contexto delimitado,
tal como `admin_repository.py` mistura leitura de utilizadores com as
suas próprias tabelas. As regras (só voluntário activo se inscreve, nunca
duas vezes, nunca além das vagas) vivem no `AtividadeVoluntariadoService`.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.repositories.orm_models import AtividadeVoluntariado, InscricaoAtividade, Utilizador


@dataclass(frozen=True)
class AtividadeVoluntariadoRegisto:
    id: str
    titulo: str
    descricao: str
    local: str
    data_inicio: datetime
    data_fim: datetime | None
    vagas: int | None
    inscritos: int
    estado: str
    criado_por: str | None
    created_at: datetime


@dataclass(frozen=True)
class InscricaoAtividadeRegisto:
    id: str
    atividade_id: str
    atividade_titulo: str
    atividade_data_inicio: datetime
    atividade_local: str
    utilizador_id: str
    utilizador_email: str
    utilizador_nome: str | None
    estado: str
    created_at: datetime


@dataclass(frozen=True)
class VoluntarioParaNotificar:
    email: str
    nome: str | None


class AtividadeVoluntariadoRepository(Protocol):
    def criar_atividade(
        self,
        titulo: str,
        descricao: str,
        local: str,
        data_inicio: datetime,
        data_fim: datetime | None,
        vagas: int | None,
        criado_por: str,
    ) -> AtividadeVoluntariadoRegisto: ...
    def obter_atividade(self, atividade_id: str) -> AtividadeVoluntariadoRegisto | None: ...
    def listar_publicadas(self) -> list[AtividadeVoluntariadoRegisto]: ...
    def listar_todas(self) -> list[AtividadeVoluntariadoRegisto]: ...
    def cancelar_atividade(self, atividade_id: str) -> AtividadeVoluntariadoRegisto: ...
    def utilizador_e_voluntario_ativo(self, utilizador_id: str) -> bool: ...
    def criar_inscricao(self, atividade_id: str, utilizador_id: str) -> InscricaoAtividadeRegisto: ...
    def obter_inscricao(
        self, atividade_id: str, utilizador_id: str
    ) -> InscricaoAtividadeRegisto | None: ...
    def cancelar_inscricao(self, inscricao_id: str) -> InscricaoAtividadeRegisto: ...
    def listar_inscricoes_por_utilizador(self, utilizador_id: str) -> list[InscricaoAtividadeRegisto]: ...
    def listar_inscricoes_por_atividade(self, atividade_id: str) -> list[InscricaoAtividadeRegisto]: ...
    def listar_voluntarios_para_notificar(self) -> list[VoluntarioParaNotificar]: ...


class SQLAlchemyAtividadeVoluntariadoRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def _contar_inscritos(self, atividade_id: uuid.UUID) -> int:
        return self._sessao.scalar(
            select(func.count())
            .select_from(InscricaoAtividade)
            .where(
                InscricaoAtividade.atividade_id == atividade_id,
                InscricaoAtividade.estado == "inscrito",
            )
        ) or 0

    def _atividade_para_registo(self, row: AtividadeVoluntariado) -> AtividadeVoluntariadoRegisto:
        return AtividadeVoluntariadoRegisto(
            id=str(row.id),
            titulo=row.titulo,
            descricao=row.descricao,
            local=row.local,
            data_inicio=row.data_inicio,
            data_fim=row.data_fim,
            vagas=row.vagas,
            inscritos=self._contar_inscritos(row.id),
            estado=row.estado,
            criado_por=str(row.criado_por) if row.criado_por else None,
            created_at=row.created_at,
        )

    def _inscricao_para_registo(self, row: InscricaoAtividade) -> InscricaoAtividadeRegisto:
        atividade = self._sessao.get(AtividadeVoluntariado, row.atividade_id)
        utilizador = self._sessao.get(Utilizador, row.utilizador_id)
        return InscricaoAtividadeRegisto(
            id=str(row.id),
            atividade_id=str(row.atividade_id),
            atividade_titulo=atividade.titulo if atividade else "",
            atividade_data_inicio=atividade.data_inicio if atividade else row.created_at,
            atividade_local=atividade.local if atividade else "",
            utilizador_id=str(row.utilizador_id),
            utilizador_email=utilizador.email if utilizador else "",
            utilizador_nome=utilizador.nome_completo if utilizador else None,
            estado=row.estado,
            created_at=row.created_at,
        )

    def criar_atividade(
        self,
        titulo: str,
        descricao: str,
        local: str,
        data_inicio: datetime,
        data_fim: datetime | None,
        vagas: int | None,
        criado_por: str,
    ) -> AtividadeVoluntariadoRegisto:
        row = AtividadeVoluntariado(
            titulo=titulo,
            descricao=descricao,
            local=local,
            data_inicio=data_inicio,
            data_fim=data_fim,
            vagas=vagas,
            estado="publicada",
            criado_por=uuid.UUID(criado_por),
        )
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return self._atividade_para_registo(row)

    def obter_atividade(self, atividade_id: str) -> AtividadeVoluntariadoRegisto | None:
        row = self._sessao.get(AtividadeVoluntariado, uuid.UUID(atividade_id))
        return self._atividade_para_registo(row) if row else None

    def listar_publicadas(self) -> list[AtividadeVoluntariadoRegisto]:
        linhas = self._sessao.scalars(
            select(AtividadeVoluntariado)
            .where(AtividadeVoluntariado.estado == "publicada")
            .order_by(AtividadeVoluntariado.data_inicio.asc())
        ).all()
        return [self._atividade_para_registo(linha) for linha in linhas]

    def listar_todas(self) -> list[AtividadeVoluntariadoRegisto]:
        linhas = self._sessao.scalars(
            select(AtividadeVoluntariado).order_by(AtividadeVoluntariado.created_at.desc())
        ).all()
        return [self._atividade_para_registo(linha) for linha in linhas]

    def cancelar_atividade(self, atividade_id: str) -> AtividadeVoluntariadoRegisto:
        row = self._sessao.get(AtividadeVoluntariado, uuid.UUID(atividade_id))
        row.estado = "cancelada"
        self._sessao.commit()
        self._sessao.refresh(row)
        return self._atividade_para_registo(row)

    def utilizador_e_voluntario_ativo(self, utilizador_id: str) -> bool:
        utilizador = self._sessao.get(Utilizador, uuid.UUID(utilizador_id))
        return bool(utilizador and utilizador.voluntario_ativo)

    def criar_inscricao(self, atividade_id: str, utilizador_id: str) -> InscricaoAtividadeRegisto:
        row = InscricaoAtividade(
            atividade_id=uuid.UUID(atividade_id),
            utilizador_id=uuid.UUID(utilizador_id),
            estado="inscrito",
        )
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return self._inscricao_para_registo(row)

    def obter_inscricao(
        self, atividade_id: str, utilizador_id: str
    ) -> InscricaoAtividadeRegisto | None:
        row = self._sessao.scalars(
            select(InscricaoAtividade).where(
                InscricaoAtividade.atividade_id == uuid.UUID(atividade_id),
                InscricaoAtividade.utilizador_id == uuid.UUID(utilizador_id),
                InscricaoAtividade.estado == "inscrito",
            )
        ).first()
        return self._inscricao_para_registo(row) if row else None

    def cancelar_inscricao(self, inscricao_id: str) -> InscricaoAtividadeRegisto:
        row = self._sessao.get(InscricaoAtividade, uuid.UUID(inscricao_id))
        row.estado = "cancelado"
        self._sessao.commit()
        self._sessao.refresh(row)
        return self._inscricao_para_registo(row)

    def listar_inscricoes_por_utilizador(self, utilizador_id: str) -> list[InscricaoAtividadeRegisto]:
        linhas = self._sessao.scalars(
            select(InscricaoAtividade)
            .where(
                InscricaoAtividade.utilizador_id == uuid.UUID(utilizador_id),
                InscricaoAtividade.estado == "inscrito",
            )
            .order_by(InscricaoAtividade.created_at.desc())
        ).all()
        return [self._inscricao_para_registo(linha) for linha in linhas]

    def listar_inscricoes_por_atividade(self, atividade_id: str) -> list[InscricaoAtividadeRegisto]:
        linhas = self._sessao.scalars(
            select(InscricaoAtividade)
            .where(
                InscricaoAtividade.atividade_id == uuid.UUID(atividade_id),
                InscricaoAtividade.estado == "inscrito",
            )
            .order_by(InscricaoAtividade.created_at.asc())
        ).all()
        return [self._inscricao_para_registo(linha) for linha in linhas]

    def listar_voluntarios_para_notificar(self) -> list[VoluntarioParaNotificar]:
        linhas = self._sessao.scalars(
            select(Utilizador).where(
                Utilizador.voluntario_ativo.is_(True),
                Utilizador.notificacoes_projetos.is_(True),
            )
        ).all()
        return [VoluntarioParaNotificar(email=u.email, nome=u.nome_completo) for u in linhas]
