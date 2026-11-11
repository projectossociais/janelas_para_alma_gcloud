"""Acesso a dados das partidas do Multijogador Local do "Inclusivamente".

As regras e os valores (quanto vale um acerto, o tecto por partida e por
dia) vivem em `services/jogo_local_service.py` e chegam aqui como
argumentos. Aqui garante-se que cada transição é **condicional e atómica**:
uma resposta só conta se a pergunta ainda for a que está por responder, e
terminar grava a partida e o saldo na mesma transacção, uma única vez, com
a linha do perfil bloqueada (`FOR UPDATE`) para o limite diário não ser
furado por duas partidas a terminar ao mesmo tempo.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.repositories.orm_models import PartidaLocalJogo, PerfilJogador
from app.repositories.perfil_jogador_repository import PerfilJogadorRegisto, para_registo


@dataclass(frozen=True)
class PartidaLocalRegisto:
    id: str
    utilizador_id: str
    numero_jogadores: int
    estado: str
    pergunta_atual_id: str | None
    perguntas_entregues: tuple[str, ...]
    perguntas_respondidas: int
    acertos: int
    moedas_ganhas: int | None


@dataclass(frozen=True)
class PartidaLocalTerminadaRegisto:
    partida: PartidaLocalRegisto
    perfil: PerfilJogadorRegisto
    # O prémio da partida antes do limite diário (o que se creditou está em
    # `partida.moedas_ganhas`).
    premio_sem_limite: int


class PartidaLocalJogoRepository(Protocol):
    def criar(self, utilizador_id: str, numero_jogadores: int, agora: datetime) -> PartidaLocalRegisto: ...
    def obter(self, partida_id: str, utilizador_id: str) -> PartidaLocalRegisto | None: ...
    def definir_pergunta(self, partida_id: str, pergunta_id: str) -> PartidaLocalRegisto | None: ...
    def registar_resposta(self, partida_id: str, pergunta_id: str, certa: bool) -> PartidaLocalRegisto | None: ...
    def terminar(
        self,
        partida_id: str,
        utilizador_id: str,
        *,
        moedas_por_acerto: int,
        maximo_por_partida: int,
        minimo_respostas: int,
        limite_diario: int,
        agora: datetime,
    ) -> PartidaLocalTerminadaRegisto | None: ...


def _uuid(valor: str) -> uuid.UUID | None:
    """Um id que não é UUID nunca existe -- `None`, em vez de rebentar."""
    try:
        return uuid.UUID(valor)
    except (ValueError, AttributeError, TypeError):
        return None


def _para_registo(row: PartidaLocalJogo) -> PartidaLocalRegisto:
    return PartidaLocalRegisto(
        id=str(row.id),
        utilizador_id=str(row.utilizador_id),
        numero_jogadores=row.numero_jogadores,
        estado=row.estado,
        pergunta_atual_id=str(row.pergunta_atual_id) if row.pergunta_atual_id is not None else None,
        perguntas_entregues=tuple(str(p) for p in (row.perguntas_entregues or [])),
        perguntas_respondidas=row.perguntas_respondidas,
        acertos=row.acertos,
        moedas_ganhas=row.moedas_ganhas,
    )


class SQLAlchemyPartidaLocalJogoRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def criar(self, utilizador_id: str, numero_jogadores: int, agora: datetime) -> PartidaLocalRegisto:
        """Abre uma partida nova. Uma que tenha ficado em curso (aparelho
        fechado a meio) é abandonada na mesma transacção, sem prémio."""
        dono = uuid.UUID(utilizador_id)
        for tentativa in range(2):
            try:
                self._sessao.execute(
                    update(PartidaLocalJogo)
                    .where(PartidaLocalJogo.utilizador_id == dono, PartidaLocalJogo.estado == "em_curso")
                    .values(estado="terminada", moedas_ganhas=0, terminada_em=agora, pergunta_atual_id=None)
                )
                row = PartidaLocalJogo(utilizador_id=dono, numero_jogadores=numero_jogadores)
                self._sessao.add(row)
                self._sessao.commit()
            except IntegrityError:
                # Outro pedido abriu uma partida ao mesmo tempo (índice único
                # parcial) -- tenta outra vez, agora a abandonar essa.
                self._sessao.rollback()
                if tentativa == 1:
                    raise
                continue
            self._sessao.refresh(row)
            return _para_registo(row)
        raise RuntimeError("inalcançável")  # pragma: no cover

    def obter(self, partida_id: str, utilizador_id: str) -> PartidaLocalRegisto | None:
        id_ = _uuid(partida_id)
        if id_ is None:
            return None
        row = self._sessao.scalars(
            select(PartidaLocalJogo).where(
                PartidaLocalJogo.id == id_, PartidaLocalJogo.utilizador_id == uuid.UUID(utilizador_id)
            )
        ).first()
        return _para_registo(row) if row is not None else None

    def _atualizar(self, partida_id: str, condicoes: list, valores: dict) -> PartidaLocalRegisto | None:
        id_ = _uuid(partida_id)
        if id_ is None:
            return None
        row = self._sessao.scalars(
            update(PartidaLocalJogo)
            .where(PartidaLocalJogo.id == id_, PartidaLocalJogo.estado == "em_curso", *condicoes)
            .values(**valores)
            .returning(PartidaLocalJogo)
        ).first()
        if row is None:
            self._sessao.rollback()
            return None
        registo = _para_registo(row)
        self._sessao.commit()
        return registo

    def definir_pergunta(self, partida_id: str, pergunta_id: str) -> PartidaLocalRegisto | None:
        """Entrega uma pergunta -- só se não houver outra por responder."""
        pergunta = uuid.UUID(pergunta_id)
        return self._atualizar(
            partida_id,
            [PartidaLocalJogo.pergunta_atual_id.is_(None)],
            {
                "pergunta_atual_id": pergunta,
                "perguntas_entregues": func.array_append(PartidaLocalJogo.perguntas_entregues, pergunta),
            },
        )

    def registar_resposta(self, partida_id: str, pergunta_id: str, certa: bool) -> PartidaLocalRegisto | None:
        """Conta a resposta -- só se `pergunta_id` ainda for a pergunta por
        responder (a mesma resposta nunca conta duas vezes)."""
        pergunta = _uuid(pergunta_id)
        if pergunta is None:
            return None
        return self._atualizar(
            partida_id,
            [PartidaLocalJogo.pergunta_atual_id == pergunta],
            {
                "pergunta_atual_id": None,
                "perguntas_respondidas": PartidaLocalJogo.perguntas_respondidas + 1,
                "acertos": PartidaLocalJogo.acertos + (1 if certa else 0),
            },
        )

    def terminar(
        self,
        partida_id: str,
        utilizador_id: str,
        *,
        moedas_por_acerto: int,
        maximo_por_partida: int,
        minimo_respostas: int,
        limite_diario: int,
        agora: datetime,
    ) -> PartidaLocalTerminadaRegisto | None:
        id_ = _uuid(partida_id)
        if id_ is None:
            return None
        dono = uuid.UUID(utilizador_id)
        try:
            # Bloqueia o perfil primeiro: duas partidas a terminar ao mesmo
            # tempo fazem fila aqui, e a segunda já vê as moedas da primeira.
            perfil = self._sessao.scalars(
                select(PerfilJogador).where(PerfilJogador.utilizador_id == dono).with_for_update()
            ).first()
            if perfil is None:
                self._sessao.rollback()
                raise RuntimeError(f"perfil de jogo inexistente para {utilizador_id}")

            partida = self._sessao.scalars(
                update(PartidaLocalJogo)
                .where(
                    PartidaLocalJogo.id == id_,
                    PartidaLocalJogo.utilizador_id == dono,
                    PartidaLocalJogo.estado == "em_curso",
                )
                .values(estado="terminada", terminada_em=agora, pergunta_atual_id=None)
                .returning(PartidaLocalJogo)
            ).first()
            if partida is None:
                # Inexistente, de outra conta ou já terminada -- não se paga.
                self._sessao.rollback()
                return None

            premio = 0
            if partida.perguntas_respondidas >= minimo_respostas:
                premio = min(partida.acertos * moedas_por_acerto, maximo_por_partida)
            inicio_do_dia = agora.replace(hour=0, minute=0, second=0, microsecond=0)
            ja_ganhas_hoje = self._sessao.scalar(
                select(func.coalesce(func.sum(PartidaLocalJogo.moedas_ganhas), 0)).where(
                    PartidaLocalJogo.utilizador_id == dono,
                    PartidaLocalJogo.terminada_em >= inicio_do_dia,
                    PartidaLocalJogo.id != id_,
                )
            )
            creditadas = max(0, min(premio, limite_diario - int(ja_ganhas_hoje or 0)))
            partida.moedas_ganhas = creditadas
            if creditadas:
                perfil.moedas += creditadas
                perfil.moedas_ganhas_total += creditadas
                perfil.updated_at = agora
            self._sessao.flush()
            resultado = PartidaLocalTerminadaRegisto(
                partida=_para_registo(partida), perfil=para_registo(perfil), premio_sem_limite=premio
            )
            self._sessao.commit()
        except Exception:
            self._sessao.rollback()
            raise
        return resultado
