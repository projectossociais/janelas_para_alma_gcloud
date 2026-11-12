"""Acesso a dados das salas do Multijogador Online do "Inclusivamente".

As regras vivem em `services/sala_jogo_service.py`, como funções puras que
recebem o estado da sala e devolvem o novo. Aqui garante-se a atomicidade:
`atualizar` bloqueia a linha da sala (`FOR UPDATE`), entrega o estado
actual à função do service, grava o resultado e -- se a partida terminou --
credita os prémios na mesma transacção, com os perfis bloqueados e o tecto
diário aplicado. Dois pedidos em simultâneo (as duas respostas da ronda, o
mesmo "terminar" visto pelos dois aparelhos) fazem fila na linha da sala e
nunca contam nem pagam duas vezes.
"""

import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Protocol

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.repositories.orm_models import (
    DenunciaChatJogo,
    JogadorSalaJogo,
    MensagemSalaJogo,
    PerfilJogador,
    SalaJogo,
)


@dataclass(frozen=True)
class JogadorSalaRegisto:
    utilizador_id: str
    ordem: int
    nome: str
    adulto: bool
    visto_em: datetime
    pontos: int = 0
    acertos: int = 0
    resposta_ronda: str | None = None
    respondeu_em: datetime | None = None
    certa_ronda: bool | None = None
    pontos_ronda: int = 0
    moedas_sem_limite: int | None = None
    moedas_ganhas: int | None = None


@dataclass(frozen=True)
class SalaRegisto:
    id: str
    codigo: str
    anfitriao_id: str
    estado: str
    criada_em: datetime
    atualizada_em: datetime
    fase: str | None = None
    ronda: int = 0
    desempate: int = 0
    pergunta_atual_id: str | None = None
    perguntas_entregues: tuple[str, ...] = ()
    prazo_resposta: datetime | None = None
    revelacao_ate: datetime | None = None
    chat_bloqueado: bool = False
    vencedores: tuple[str, ...] = ()
    motivo_fim: str | None = None
    terminada_em: datetime | None = None
    jogadores: tuple[JogadorSalaRegisto, ...] = ()


@dataclass(frozen=True)
class Alteracao:
    """O que a função do service quer gravar. `premios`: moedas a creditar a
    cada jogador (antes do tecto diário), só quando a partida termina."""

    sala: SalaRegisto
    premios: tuple[tuple[str, int], ...] = field(default=())
    limite_diario: int = 0


@dataclass(frozen=True)
class MensagemSalaRegisto:
    id: str
    utilizador_id: str
    texto: str
    criada_em: datetime


class SalaJogoRepository(Protocol):
    def criar(self, codigo: str, anfitriao: JogadorSalaRegisto, agora: datetime) -> SalaRegisto | None: ...
    def obter(self, codigo: str) -> SalaRegisto | None: ...
    def atualizar(
        self, codigo: str, funcao: Callable[[SalaRegisto], Alteracao | None]
    ) -> SalaRegisto | None: ...
    def codigos_abertos_de(self, utilizador_id: str) -> list[str]: ...
    def adicionar_mensagem(
        self, sala_id: str, utilizador_id: str, texto: str, agora: datetime
    ) -> MensagemSalaRegisto: ...
    def listar_mensagens(self, sala_id: str, limite: int) -> list[MensagemSalaRegisto]: ...
    def mensagens_de(self, sala_id: str, utilizador_id: str) -> list[datetime]: ...
    def registar_denuncia(self, sala_id: str, denunciante_id: str, agora: datetime) -> None: ...


def _jogador(row: JogadorSalaJogo) -> JogadorSalaRegisto:
    return JogadorSalaRegisto(
        utilizador_id=str(row.utilizador_id),
        ordem=row.ordem,
        nome=row.nome,
        adulto=row.adulto,
        visto_em=row.visto_em,
        pontos=row.pontos,
        acertos=row.acertos,
        resposta_ronda=row.resposta_ronda,
        respondeu_em=row.respondeu_em,
        certa_ronda=row.certa_ronda,
        pontos_ronda=row.pontos_ronda,
        moedas_sem_limite=row.moedas_sem_limite,
        moedas_ganhas=row.moedas_ganhas,
    )


def _sala(row: SalaJogo, jogadores: list[JogadorSalaJogo]) -> SalaRegisto:
    return SalaRegisto(
        id=str(row.id),
        codigo=row.codigo,
        anfitriao_id=str(row.anfitriao_id),
        estado=row.estado,
        criada_em=row.created_at,
        atualizada_em=row.updated_at,
        fase=row.fase,
        ronda=row.ronda,
        desempate=row.desempate,
        pergunta_atual_id=str(row.pergunta_atual_id) if row.pergunta_atual_id else None,
        perguntas_entregues=tuple(str(p) for p in (row.perguntas_entregues or [])),
        prazo_resposta=row.prazo_resposta,
        revelacao_ate=row.revelacao_ate,
        chat_bloqueado=row.chat_bloqueado,
        vencedores=tuple(str(v) for v in (row.vencedores or [])),
        motivo_fim=row.motivo_fim,
        terminada_em=row.terminada_em,
        jogadores=tuple(_jogador(j) for j in sorted(jogadores, key=lambda j: j.ordem)),
    )


_CAMPOS_JOGADOR = (
    "ordem",
    "nome",
    "adulto",
    "visto_em",
    "pontos",
    "acertos",
    "resposta_ronda",
    "respondeu_em",
    "certa_ronda",
    "pontos_ronda",
    "moedas_sem_limite",
    "moedas_ganhas",
)


class SQLAlchemySalaJogoRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def _jogadores(self, sala_id: uuid.UUID) -> list[JogadorSalaJogo]:
        return list(self._sessao.scalars(select(JogadorSalaJogo).where(JogadorSalaJogo.sala_id == sala_id)))

    def criar(self, codigo: str, anfitriao: JogadorSalaRegisto, agora: datetime) -> SalaRegisto | None:
        """`None` se o código já existir -- o service sorteia outro."""
        sala = SalaJogo(
            codigo=codigo, anfitriao_id=uuid.UUID(anfitriao.utilizador_id), created_at=agora, updated_at=agora
        )
        self._sessao.add(sala)
        try:
            self._sessao.flush()
        except IntegrityError:
            self._sessao.rollback()
            return None
        jogador = JogadorSalaJogo(
            sala_id=sala.id,
            utilizador_id=uuid.UUID(anfitriao.utilizador_id),
            **{campo: getattr(anfitriao, campo) for campo in _CAMPOS_JOGADOR},
        )
        self._sessao.add(jogador)
        self._sessao.commit()
        return _sala(sala, [jogador])

    def obter(self, codigo: str) -> SalaRegisto | None:
        # Leitura fresca: outra sessão pode ter gravado desde a última vez.
        self._sessao.expire_all()
        sala = self._sessao.scalars(select(SalaJogo).where(SalaJogo.codigo == codigo)).first()
        if sala is None:
            return None
        registo = _sala(sala, self._jogadores(sala.id))
        self._sessao.rollback()
        return registo

    def atualizar(
        self, codigo: str, funcao: Callable[[SalaRegisto], Alteracao | None]
    ) -> SalaRegisto | None:
        try:
            self._sessao.expire_all()
            sala = self._sessao.scalars(
                select(SalaJogo).where(SalaJogo.codigo == codigo).with_for_update()
            ).first()
            if sala is None:
                self._sessao.rollback()
                return None
            linhas = {str(j.utilizador_id): j for j in self._jogadores(sala.id)}
            atual = _sala(sala, list(linhas.values()))
            alteracao = funcao(atual)
            if alteracao is None:
                self._sessao.rollback()
                return atual
            nova = alteracao.sala

            sala.estado = nova.estado
            sala.fase = nova.fase
            sala.ronda = nova.ronda
            sala.desempate = nova.desempate
            sala.pergunta_atual_id = uuid.UUID(nova.pergunta_atual_id) if nova.pergunta_atual_id else None
            sala.perguntas_entregues = [uuid.UUID(p) for p in nova.perguntas_entregues]
            sala.prazo_resposta = nova.prazo_resposta
            sala.revelacao_ate = nova.revelacao_ate
            sala.chat_bloqueado = nova.chat_bloqueado
            sala.vencedores = [uuid.UUID(v) for v in nova.vencedores]
            sala.motivo_fim = nova.motivo_fim
            sala.terminada_em = nova.terminada_em
            sala.updated_at = nova.atualizada_em

            presentes = {j.utilizador_id for j in nova.jogadores}
            for utilizador_id, linha in list(linhas.items()):
                if utilizador_id not in presentes:
                    self._sessao.delete(linha)
                    del linhas[utilizador_id]
            for jogador in nova.jogadores:
                linha = linhas.get(jogador.utilizador_id)
                if linha is None:
                    linha = JogadorSalaJogo(sala_id=sala.id, utilizador_id=uuid.UUID(jogador.utilizador_id))
                    self._sessao.add(linha)
                    linhas[jogador.utilizador_id] = linha
                for campo in _CAMPOS_JOGADOR:
                    setattr(linha, campo, getattr(jogador, campo))

            if alteracao.premios:
                self._creditar(sala, linhas, alteracao, nova.terminada_em or nova.atualizada_em)

            self._sessao.flush()
            registo = _sala(sala, list(linhas.values()))
            self._sessao.commit()
        except Exception:
            self._sessao.rollback()
            raise
        return registo

    def _creditar(
        self, sala: SalaJogo, linhas: dict[str, JogadorSalaJogo], alteracao: Alteracao, agora: datetime
    ) -> None:
        """Credita os prémios com o tecto diário (dia UTC). Os perfis
        bloqueiam-se sempre pela mesma ordem, para dois fins de partida em
        simultâneo nunca se bloquearem um ao outro."""
        inicio_do_dia = agora.replace(hour=0, minute=0, second=0, microsecond=0)
        for utilizador_id, premio in sorted(alteracao.premios):
            dono = uuid.UUID(utilizador_id)
            perfil = self._sessao.scalars(
                select(PerfilJogador).where(PerfilJogador.utilizador_id == dono).with_for_update()
            ).first()
            if perfil is None:
                perfil = PerfilJogador(
                    utilizador_id=dono, moedas=0, diamantes=0, partidas_jogadas=0, patamar_maximo_alcancado=0
                )
                self._sessao.add(perfil)
                self._sessao.flush()
            ja_ganhas_hoje = self._sessao.scalar(
                select(func.coalesce(func.sum(JogadorSalaJogo.moedas_ganhas), 0))
                .join(SalaJogo, SalaJogo.id == JogadorSalaJogo.sala_id)
                .where(
                    JogadorSalaJogo.utilizador_id == dono,
                    SalaJogo.terminada_em >= inicio_do_dia,
                    SalaJogo.id != sala.id,
                )
            )
            creditadas = max(0, min(premio, alteracao.limite_diario - int(ja_ganhas_hoje or 0)))
            linha = linhas[utilizador_id]
            linha.moedas_sem_limite = premio
            linha.moedas_ganhas = creditadas
            if creditadas:
                perfil.moedas += creditadas
                perfil.moedas_ganhas_total += creditadas
                perfil.updated_at = agora

    def codigos_abertos_de(self, utilizador_id: str) -> list[str]:
        codigos = self._sessao.scalars(
            select(SalaJogo.codigo)
            .join(JogadorSalaJogo, JogadorSalaJogo.sala_id == SalaJogo.id)
            .where(
                JogadorSalaJogo.utilizador_id == uuid.UUID(utilizador_id),
                SalaJogo.estado.in_(("a_aguardar", "em_curso")),
            )
        ).all()
        self._sessao.rollback()
        return list(codigos)

    def adicionar_mensagem(
        self, sala_id: str, utilizador_id: str, texto: str, agora: datetime
    ) -> MensagemSalaRegisto:
        row = MensagemSalaJogo(
            sala_id=uuid.UUID(sala_id), utilizador_id=uuid.UUID(utilizador_id), texto=texto, created_at=agora
        )
        self._sessao.add(row)
        self._sessao.commit()
        return MensagemSalaRegisto(id=str(row.id), utilizador_id=utilizador_id, texto=texto, criada_em=agora)

    def listar_mensagens(self, sala_id: str, limite: int) -> list[MensagemSalaRegisto]:
        rows = self._sessao.scalars(
            select(MensagemSalaJogo)
            .where(MensagemSalaJogo.sala_id == uuid.UUID(sala_id))
            .order_by(MensagemSalaJogo.created_at.desc(), MensagemSalaJogo.id)
            .limit(limite)
        ).all()
        mensagens = [
            MensagemSalaRegisto(
                id=str(r.id), utilizador_id=str(r.utilizador_id), texto=r.texto, criada_em=r.created_at
            )
            for r in reversed(rows)
        ]
        self._sessao.rollback()
        return mensagens

    def mensagens_de(self, sala_id: str, utilizador_id: str) -> list[datetime]:
        """Quando o jogador escreveu cada mensagem nesta sala (para os limites)."""
        momentos = self._sessao.scalars(
            select(MensagemSalaJogo.created_at).where(
                MensagemSalaJogo.sala_id == uuid.UUID(sala_id),
                MensagemSalaJogo.utilizador_id == uuid.UUID(utilizador_id),
            )
        ).all()
        self._sessao.rollback()
        return list(momentos)

    def registar_denuncia(self, sala_id: str, denunciante_id: str, agora: datetime) -> None:
        self._sessao.add(
            DenunciaChatJogo(sala_id=uuid.UUID(sala_id), denunciante_id=uuid.UUID(denunciante_id), created_at=agora)
        )
        self._sessao.commit()


def apagar_mensagens_de(sessao: Session, utilizador_id: uuid.UUID, nome_anonimo: str) -> None:
    """Anonimização de conta (W-03): o que a pessoa escreveu no chat apaga-se
    e o primeiro nome copiado para as salas deixa de a identificar. Não faz
    commit -- corre dentro da transacção da anonimização."""
    sessao.execute(delete(MensagemSalaJogo).where(MensagemSalaJogo.utilizador_id == utilizador_id))
    for linha in sessao.scalars(select(JogadorSalaJogo).where(JogadorSalaJogo.utilizador_id == utilizador_id)):
        linha.nome = nome_anonimo
