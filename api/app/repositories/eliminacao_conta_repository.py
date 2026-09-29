"""Acesso a dados da anonimização de contas com eliminação vencida (W-03).

Cruza tabelas de propósito -- ao contrário do resto do projecto, esta
operação não pertence a uma entidade só. `Utilizador.eliminar_agendado_para`
marca a intenção (`ContaService.agendar_eliminacao`); este repository lê
quem já venceu o prazo e apaga o rasto pessoal em todo o lado onde ele foi
copiado directamente (`PremiumRequest`, `AgendamentoClinico`,
`ContactMessage`, `CandidaturaVoluntariado` guardam `nome`/`email`/`telefone`
sem depender de um join, mesmo padrão de `Doacao.email` -- ver CLAUDE.md).

Nunca apaga a linha de `Utilizador`: as tabelas com dados clínicos ou de
sessão (`screenings`, `sessoes_exercicio`, etc.) têm `ON DELETE CASCADE`
para `utilizadores.id` -- apagar a linha destruiria esse histórico junto
com a identidade. Anonimizar em vez de apagar preserva-o.
"""

import uuid
from datetime import datetime
from typing import Protocol

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.repositories.orm_models import (
    AgendamentoClinico,
    CandidaturaVoluntariado,
    ContactMessage,
    PartilhaRelatorio,
    PremiumRequest,
    Utilizador,
)


class EliminacaoContaRepository(Protocol):
    def listar_pendentes(self, agora: datetime) -> list[str]: ...

    def anonimizar(
        self,
        utilizador_id: str,
        agora: datetime,
        email_anonimo: str,
        password_hash_invalido: str,
        nome_anonimo: str,
    ) -> None: ...


class SQLAlchemyEliminacaoContaRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def listar_pendentes(self, agora: datetime) -> list[str]:
        linhas = self._sessao.scalars(
            select(Utilizador.id).where(
                Utilizador.eliminar_agendado_para.is_not(None),
                Utilizador.eliminar_agendado_para <= agora,
                Utilizador.anonimizado_em.is_(None),
            )
        ).all()
        return [str(row_id) for row_id in linhas]

    def anonimizar(
        self,
        utilizador_id: str,
        agora: datetime,
        email_anonimo: str,
        password_hash_invalido: str,
        nome_anonimo: str,
    ) -> None:
        id_ = uuid.UUID(utilizador_id)

        utilizador = self._sessao.get(Utilizador, id_)
        if utilizador is None or utilizador.anonimizado_em is not None:
            return  # já processado, ou já não existe -- nunca reprocessar

        # O formulário de contacto não liga a mensagem à conta (não há
        # `user_id` em `contact_messages`): as mensagens da pessoa só se
        # encontram pelo email da conta, por isso guarda-se antes de o apagar.
        email_original = utilizador.email

        utilizador.email = email_anonimo
        utilizador.password_hash = password_hash_invalido
        utilizador.nome_completo = None
        utilizador.avatar_url = None
        utilizador.biografia = None
        utilizador.data_nascimento = None
        utilizador.genero = None
        utilizador.provincia = None
        utilizador.telefone = None
        utilizador.px_por_mm = None
        utilizador.olho_mais_fraco = None
        utilizador.usa_oculos = None
        utilizador.faixa_etaria = None
        utilizador.notificacoes_projetos = False
        utilizador.notificacoes_lembretes = False
        utilizador.notificacoes_comunidade = False
        utilizador.premium_ativo = False
        utilizador.anonimizado_em = agora

        for row in self._sessao.scalars(
            select(PremiumRequest).where(PremiumRequest.user_id == id_)
        ):
            row.nome = nome_anonimo
            row.email = email_anonimo
            row.telefone = None

        for row in self._sessao.scalars(
            select(AgendamentoClinico).where(AgendamentoClinico.utilizador_id == id_)
        ):
            row.nome = nome_anonimo
            row.email = email_anonimo
            row.telefone = "+000000000"

        for row in self._sessao.scalars(
            select(ContactMessage).where(func.lower(ContactMessage.email) == email_original.lower())
        ):
            row.nome = nome_anonimo
            row.email = email_anonimo

        for row in self._sessao.scalars(
            select(CandidaturaVoluntariado).where(CandidaturaVoluntariado.utilizador_id == id_)
        ):
            row.telefone = None

        # Links do relatório para o médico (Fase B): nenhum pode continuar a
        # abrir depois de a conta ser anonimizada.
        self._sessao.execute(
            update(PartilhaRelatorio)
            .where(PartilhaRelatorio.utilizador_id == id_, PartilhaRelatorio.revogado_em.is_(None))
            .values(revogado_em=agora)
        )

        self._sessao.commit()
