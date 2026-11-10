"""Acesso a dados do apoio mensal (Kamba Mensal). As regras -- valores
aceites, quando lembrar, o que conta como mês em falta -- vivem no
`ApoioMensalService`; aqui só se lê e escreve.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.repositories.orm_models import ApoioMensal, Doacao, Utilizador


@dataclass(frozen=True)
class ApoioMensalRegisto:
    id: str
    utilizador_id: str
    valor_mensal_kz: int
    estado: str
    criado_em: datetime
    ultimo_comprovativo_em: datetime | None
    ultimo_lembrete_em: datetime | None
    meses_com_comprovativo: int


@dataclass(frozen=True)
class DestinatarioLembreteApoio:
    apoio_id: str
    email: str
    nome: str | None
    valor_mensal_kz: int


class ApoioMensalJaActivoError(Exception):
    """A conta já tem um apoio activo (o índice único parcial recusou o segundo)."""


class ApoiosMensaisRepository(Protocol):
    def obter_activo(self, utilizador_id: str) -> ApoioMensalRegisto | None: ...
    def criar(self, utilizador_id: str, valor_mensal_kz: int) -> ApoioMensalRegisto: ...
    def registar_comprovativo(
        self,
        apoio_id: str,
        recibo_id: str,
        email: str,
        detalhes: str,
        comprovativo_url: str,
        momento: datetime,
    ) -> ApoioMensalRegisto: ...
    def cancelar(self, apoio_id: str, momento: datetime) -> None: ...
    def listar_para_lembrete(self, limite: datetime) -> list[DestinatarioLembreteApoio]: ...
    def marcar_lembrete(self, apoio_id: str, momento: datetime) -> None: ...


class SQLAlchemyApoiosMensaisRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def _para_registo(self, row: ApoioMensal) -> ApoioMensalRegisto:
        meses = self._sessao.scalar(
            select(func.count()).select_from(Doacao).where(Doacao.apoio_mensal_id == row.id)
        )
        return ApoioMensalRegisto(
            id=str(row.id),
            utilizador_id=str(row.utilizador_id),
            valor_mensal_kz=row.valor_mensal_kz,
            estado=row.estado,
            criado_em=row.criado_em,
            ultimo_comprovativo_em=row.ultimo_comprovativo_em,
            ultimo_lembrete_em=row.ultimo_lembrete_em,
            meses_com_comprovativo=meses or 0,
        )

    def obter_activo(self, utilizador_id: str) -> ApoioMensalRegisto | None:
        row = self._sessao.scalars(
            select(ApoioMensal).where(
                ApoioMensal.utilizador_id == uuid.UUID(utilizador_id), ApoioMensal.estado == "ativo"
            )
        ).first()
        return self._para_registo(row) if row else None

    def criar(self, utilizador_id: str, valor_mensal_kz: int) -> ApoioMensalRegisto:
        row = ApoioMensal(utilizador_id=uuid.UUID(utilizador_id), valor_mensal_kz=valor_mensal_kz, estado="ativo")
        self._sessao.add(row)
        try:
            self._sessao.commit()
        except IntegrityError as exc:
            # Dois pedidos em simultâneo: o índice único parcial deixa passar só um.
            self._sessao.rollback()
            raise ApoioMensalJaActivoError(utilizador_id) from exc
        self._sessao.refresh(row)
        return self._para_registo(row)

    def registar_comprovativo(
        self,
        apoio_id: str,
        recibo_id: str,
        email: str,
        detalhes: str,
        comprovativo_url: str,
        momento: datetime,
    ) -> ApoioMensalRegisto:
        # A doação do mês e a data do último comprovativo gravam-se na mesma
        # transacção: nunca um sem o outro. Uma falha propaga (nunca um
        # "recebido" fabricado -- ver DoacaoService).
        apoio = self._sessao.get(ApoioMensal, uuid.UUID(apoio_id))
        assert apoio is not None  # o service só chama isto com um apoio activo
        self._sessao.add(
            Doacao(
                recibo_id=recibo_id,
                tipo="financeiro",
                email=email,
                status="comprovativo_enviado",
                detalhes=detalhes,
                comprovativo_url=comprovativo_url,
                apoio_mensal_id=apoio.id,
            )
        )
        apoio.ultimo_comprovativo_em = momento
        self._sessao.commit()
        self._sessao.refresh(apoio)
        return self._para_registo(apoio)

    def cancelar(self, apoio_id: str, momento: datetime) -> None:
        self._sessao.execute(
            update(ApoioMensal)
            .where(ApoioMensal.id == uuid.UUID(apoio_id), ApoioMensal.estado == "ativo")
            .values(estado="cancelado", cancelado_em=momento)
        )
        self._sessao.commit()

    def listar_para_lembrete(self, limite: datetime) -> list[DestinatarioLembreteApoio]:
        # Activo, sem comprovativo (nem adesão) desde `limite`, e sem lembrete
        # desde `limite` -- no máximo um lembrete por ciclo.
        referencia = func.coalesce(ApoioMensal.ultimo_comprovativo_em, ApoioMensal.criado_em)
        linhas = self._sessao.execute(
            select(ApoioMensal.id, Utilizador.email, Utilizador.nome_completo, ApoioMensal.valor_mensal_kz)
            .join(Utilizador, Utilizador.id == ApoioMensal.utilizador_id)
            .where(
                ApoioMensal.estado == "ativo",
                referencia <= limite,
                or_(ApoioMensal.ultimo_lembrete_em.is_(None), ApoioMensal.ultimo_lembrete_em <= limite),
                Utilizador.email_confirmado.is_(True),
                Utilizador.anonimizado_em.is_(None),
            )
        ).all()
        return [
            DestinatarioLembreteApoio(apoio_id=str(i), email=e, nome=n, valor_mensal_kz=v) for i, e, n, v in linhas
        ]

    def marcar_lembrete(self, apoio_id: str, momento: datetime) -> None:
        self._sessao.execute(
            update(ApoioMensal).where(ApoioMensal.id == uuid.UUID(apoio_id)).values(ultimo_lembrete_em=momento)
        )
        self._sessao.commit()
