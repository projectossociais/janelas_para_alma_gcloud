"""Acesso a dados dos comprovativos de pagamento validados automaticamente
(`comprovativos_pagamento`) e do efeito no Premium do utilizador.

Quando um comprovativo dá Premium, a linha do comprovativo e as colunas
`premium_*` do utilizador mudam **numa só transacção** (um `commit`), com a
linha do utilizador bloqueada (`SELECT ... FOR UPDATE`) enquanto se calcula a
nova validade -- dois comprovativos aprovados ao mesmo tempo somam os dois
30 dias, nunca se sobrepõem. A regra de quanto somar vive no service
(`ajustar_premium`), que a testa sem base de dados através do `Protocol`.

Os índices únicos parciais (ver `ComprovativoPagamento`) são a última
palavra no anti-replay: se dois pedidos com o mesmo ficheiro ou a mesma
operação passarem as verificações ao mesmo tempo, o segundo `commit` falha
aqui e sai como `ComprovativoDuplicadoError`.
"""

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.repositories.orm_models import ComprovativoPagamento, Utilizador

# Recebe a validade actual do Premium (None se não estiver activo) e devolve
# a nova (None = desliga o Premium).
AjustePremium = Callable[[datetime | None], datetime | None]


@dataclass(frozen=True)
class NovoComprovativo:
    utilizador_id: str
    chave_ficheiro: str
    hash_sha256: str
    estado: str
    referencia_transacao: str | None = None
    montante_kz: Decimal | None = None
    origem: str | None = None
    destinatario_detectado: str | None = None
    data_transacao: datetime | None = None
    metadados_pdf: dict | None = None
    texto_extraido: str | None = None
    motivo_codigo: str | None = None
    motivo: str | None = None


@dataclass(frozen=True)
class ComprovativoRegisto:
    id: str
    utilizador_id: str | None
    utilizador_email: str | None
    utilizador_nome: str | None
    estado: str
    referencia_transacao: str | None
    hash_sha256: str
    montante_kz: Decimal | None
    origem: str | None
    destinatario_detectado: str | None
    data_transacao: datetime | None
    metadados_pdf: dict | None
    texto_extraido: str | None
    chave_ficheiro: str
    motivo_codigo: str | None
    motivo: str | None
    premium_expira_em: datetime | None
    decidido_por: str | None
    decidido_em: datetime | None
    criado_em: datetime


class ComprovativoDuplicadoError(Exception):
    """O mesmo ficheiro ou a mesma operação já conta noutro comprovativo
    (corrida entre dois pedidos -- apanhada pelo índice único)."""


class ComprovativoNaoEncontradoError(Exception):
    pass


class ComprovativosPagamentoRepository(Protocol):
    def estado_por_hash(self, hash_sha256: str) -> str | None: ...
    def estado_por_referencia(self, referencia: str) -> str | None: ...
    def registar(
        self, dados: NovoComprovativo, ajustar_premium: AjustePremium | None = None
    ) -> ComprovativoRegisto: ...
    def obter(self, comprovativo_id: str) -> ComprovativoRegisto | None: ...
    def listar(self, estado: str | None = None, limite: int = 200) -> list[ComprovativoRegisto]: ...
    def decidir(
        self,
        comprovativo_id: str,
        estado: str,
        admin_id: str,
        quando: datetime,
        motivo_codigo: str | None = None,
        motivo: str | None = None,
        ajustar_premium: AjustePremium | None = None,
    ) -> ComprovativoRegisto: ...


def _para_registo(row: ComprovativoPagamento, utilizador: Utilizador | None) -> ComprovativoRegisto:
    return ComprovativoRegisto(
        id=str(row.id),
        utilizador_id=str(row.utilizador_id) if row.utilizador_id else None,
        utilizador_email=utilizador.email if utilizador else None,
        utilizador_nome=utilizador.nome_completo if utilizador else None,
        estado=row.estado,
        referencia_transacao=row.referencia_transacao,
        hash_sha256=row.hash_sha256,
        montante_kz=Decimal(row.montante_kz) if row.montante_kz is not None else None,
        origem=row.origem,
        destinatario_detectado=row.destinatario_detectado,
        data_transacao=row.data_transacao,
        metadados_pdf=row.metadados_pdf,
        texto_extraido=row.texto_extraido,
        chave_ficheiro=row.chave_ficheiro,
        motivo_codigo=row.motivo_codigo,
        motivo=row.motivo,
        premium_expira_em=row.premium_expira_em,
        decidido_por=str(row.decidido_por) if row.decidido_por else None,
        decidido_em=row.decidido_em,
        criado_em=row.criado_em,
    )


class SQLAlchemyComprovativosPagamentoRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def _estado_activo(self, condicao) -> str | None:
        """Estado do comprovativo que conta (tudo menos `rejeitado`)."""
        return self._sessao.scalars(
            select(ComprovativoPagamento.estado)
            .where(condicao, ComprovativoPagamento.estado != "rejeitado")
            .limit(1)
        ).first()

    def estado_por_hash(self, hash_sha256: str) -> str | None:
        return self._estado_activo(ComprovativoPagamento.hash_sha256 == hash_sha256)

    def estado_por_referencia(self, referencia: str) -> str | None:
        return self._estado_activo(ComprovativoPagamento.referencia_transacao == referencia)

    def _aplicar_premium(self, utilizador_id: uuid.UUID, ajustar: AjustePremium) -> datetime | None:
        utilizador = self._sessao.scalars(
            select(Utilizador).where(Utilizador.id == utilizador_id).with_for_update()
        ).one()
        actual = utilizador.premium_expira_em if utilizador.premium_ativo else None
        nova = ajustar(actual)
        utilizador.premium_ativo = nova is not None
        utilizador.premium_expira_em = nova
        return nova

    def _gravar(self, alterar: Callable[[], ComprovativoPagamento]) -> ComprovativoRegisto:
        """Corre `alterar` e faz `commit` como uma só unidade. O índice único
        pode rebentar já no autoflush do `SELECT ... FOR UPDATE` do
        utilizador, não só no `commit` -- por isso o `try` cobre tudo, e um
        rollback deixa a sessão limpa para gravar a rejeição a seguir."""
        try:
            row = alterar()
            self._sessao.commit()
        except IntegrityError as exc:
            self._sessao.rollback()
            raise ComprovativoDuplicadoError from exc
        self._sessao.refresh(row)
        utilizador = self._sessao.get(Utilizador, row.utilizador_id) if row.utilizador_id else None
        return _para_registo(row, utilizador)

    def registar(
        self, dados: NovoComprovativo, ajustar_premium: AjustePremium | None = None
    ) -> ComprovativoRegisto:
        def alterar() -> ComprovativoPagamento:
            row = ComprovativoPagamento(
                utilizador_id=uuid.UUID(dados.utilizador_id),
                chave_ficheiro=dados.chave_ficheiro,
                hash_sha256=dados.hash_sha256,
                estado=dados.estado,
                referencia_transacao=dados.referencia_transacao,
                montante_kz=dados.montante_kz,
                origem=dados.origem,
                destinatario_detectado=dados.destinatario_detectado,
                data_transacao=dados.data_transacao,
                metadados_pdf=dados.metadados_pdf,
                texto_extraido=dados.texto_extraido,
                motivo_codigo=dados.motivo_codigo,
                motivo=dados.motivo,
            )
            self._sessao.add(row)
            if ajustar_premium is not None:
                row.premium_expira_em = self._aplicar_premium(row.utilizador_id, ajustar_premium)
            return row

        return self._gravar(alterar)

    def obter(self, comprovativo_id: str) -> ComprovativoRegisto | None:
        try:
            row = self._sessao.get(ComprovativoPagamento, uuid.UUID(comprovativo_id))
        except ValueError:
            return None
        if row is None:
            return None
        utilizador = self._sessao.get(Utilizador, row.utilizador_id) if row.utilizador_id else None
        return _para_registo(row, utilizador)

    def listar(self, estado: str | None = None, limite: int = 200) -> list[ComprovativoRegisto]:
        consulta = (
            select(ComprovativoPagamento, Utilizador)
            .outerjoin(Utilizador, Utilizador.id == ComprovativoPagamento.utilizador_id)
            .order_by(ComprovativoPagamento.criado_em.desc())
            .limit(limite)
        )
        if estado:
            consulta = consulta.where(ComprovativoPagamento.estado == estado)
        return [_para_registo(c, u) for c, u in self._sessao.execute(consulta).all()]

    def decidir(
        self,
        comprovativo_id: str,
        estado: str,
        admin_id: str,
        quando: datetime,
        motivo_codigo: str | None = None,
        motivo: str | None = None,
        ajustar_premium: AjustePremium | None = None,
    ) -> ComprovativoRegisto:
        def alterar() -> ComprovativoPagamento:
            row = self._sessao.scalars(
                select(ComprovativoPagamento)
                .where(ComprovativoPagamento.id == uuid.UUID(comprovativo_id))
                .with_for_update()
            ).first()
            if row is None:
                raise ComprovativoNaoEncontradoError(comprovativo_id)
            row.estado = estado
            row.decidido_por = uuid.UUID(admin_id)
            row.decidido_em = quando
            if motivo_codigo is not None:
                row.motivo_codigo = motivo_codigo
                row.motivo = motivo
            if ajustar_premium is not None and row.utilizador_id is not None:
                nova = self._aplicar_premium(row.utilizador_id, ajustar_premium)
                if estado == "aprovado":
                    row.premium_expira_em = nova
            return row

        return self._gravar(alterar)
