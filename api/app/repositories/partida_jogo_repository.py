"""Acesso a dados das partidas do jogo "Inclusivamente".

As regras (quando avança, quanto custa uma vida extra, quanto vale uma
partida) vivem em `services/jogo_service.py`. Aqui garante-se que as
transições de estado são **condicionais e atómicas**: cada `UPDATE` só
acontece se a partida ainda estiver no estado esperado, e as operações que
mexem em dinheiro virtual (vida extra, terminar) gravam a partida e o saldo
na mesma transacção. Dois pedidos simultâneos nunca pagam duas vezes a mesma
partida nem usam a mesma vida extra duas vezes.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Literal, Protocol

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.repositories.orm_models import EstatisticaCategoriaJogador, PartidaJogo, PerfilJogador
from app.repositories.perfil_jogador_repository import PerfilJogadorRegisto, para_registo

EstadoPartida = Literal["em_curso", "a_aguardar_decisao", "terminada"]
AjudaPartida = Literal["cinquenta_cinquenta", "opiniao_publico", "trocar_pergunta"]


@dataclass(frozen=True)
class PartidaRegisto:
    id: str
    utilizador_id: str
    estado: EstadoPartida
    patamar_superado: int
    vidas_extra_usadas: int
    cinquenta_cinquenta_usada: bool
    opiniao_publico_usada: bool
    trocar_pergunta_usada: bool
    pergunta_atual_id: str | None
    opcao_falhada: str | None
    sequencia_acertos: int
    diamantes_sequencia: int
    moedas_ganhas: int | None
    diamantes_ganhos: int | None


@dataclass(frozen=True)
class AcertoRegisto:
    partida: PartidaRegisto
    perfil: PerfilJogadorRegisto
    # O que entrou mesmo na conta -- pode ser menos do que o bónus pedido se
    # o limite diário de diamantes de sequências já estiver (quase) gasto.
    diamantes_creditados: int = 0


@dataclass(frozen=True)
class ResultadoVidaExtra:
    estado: Literal["ok", "indisponivel", "saldo_insuficiente"]
    partida: PartidaRegisto | None = None
    perfil: PerfilJogadorRegisto | None = None


@dataclass(frozen=True)
class PartidaTerminadaRegisto:
    partida: PartidaRegisto
    perfil: PerfilJogadorRegisto


class PartidaJogoRepository(Protocol):
    def obter_ativa(self, utilizador_id: str) -> PartidaRegisto | None: ...
    def criar(self, utilizador_id: str) -> PartidaRegisto: ...
    def definir_pergunta(self, partida_id: str, pergunta_id: str, troca: bool) -> PartidaRegisto | None: ...
    def registar_acerto(
        self,
        partida_id: str,
        utilizador_id: str,
        pergunta_id: str,
        patamar_superado: int,
        sequencia_acertos: int,
        diamantes_bonus: int,
        hoje: date,
        limite_diario: int,
        categoria: str,
    ) -> AcertoRegisto | None: ...
    def registar_falha(
        self, partida_id: str, utilizador_id: str, pergunta_id: str, opcao_falhada: str | None, categoria: str
    ) -> PartidaRegisto | None: ...
    def marcar_ajuda(self, partida_id: str, ajuda: AjudaPartida) -> bool: ...
    def usar_vida_extra(
        self, partida_id: str, utilizador_id: str, custo: int, maximo: int
    ) -> ResultadoVidaExtra: ...
    def terminar(
        self, partida_id: str, utilizador_id: str, moedas: int, diamantes: int
    ) -> PartidaTerminadaRegisto | None: ...


def _para_registo(row: PartidaJogo) -> PartidaRegisto:
    return PartidaRegisto(
        id=str(row.id),
        utilizador_id=str(row.utilizador_id),
        estado=row.estado,  # type: ignore[arg-type]
        patamar_superado=row.patamar_superado,
        vidas_extra_usadas=row.vidas_extra_usadas,
        cinquenta_cinquenta_usada=row.cinquenta_cinquenta_usada,
        opiniao_publico_usada=row.opiniao_publico_usada,
        trocar_pergunta_usada=row.trocar_pergunta_usada,
        pergunta_atual_id=str(row.pergunta_atual_id) if row.pergunta_atual_id else None,
        opcao_falhada=row.opcao_falhada,
        sequencia_acertos=row.sequencia_acertos,
        diamantes_sequencia=row.diamantes_sequencia,
        moedas_ganhas=row.moedas_ganhas,
        diamantes_ganhos=row.diamantes_ganhos,
    )


class SQLAlchemyPartidaJogoRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def obter_ativa(self, utilizador_id: str) -> PartidaRegisto | None:
        row = self._sessao.scalars(
            select(PartidaJogo).where(
                PartidaJogo.utilizador_id == uuid.UUID(utilizador_id), PartidaJogo.estado != "terminada"
            )
        ).first()
        return _para_registo(row) if row is not None else None

    def criar(self, utilizador_id: str) -> PartidaRegisto:
        row = PartidaJogo(utilizador_id=uuid.UUID(utilizador_id))
        self._sessao.add(row)
        try:
            self._sessao.commit()
        except IntegrityError:
            # Outro pedido criou uma partida ao mesmo tempo (índice único
            # parcial) -- fica essa, em vez de rebentar.
            self._sessao.rollback()
            ativa = self.obter_ativa(utilizador_id)
            if ativa is None:
                raise
            return ativa
        self._sessao.refresh(row)
        return _para_registo(row)

    def _atualizar(self, partida_id: str, condicoes: list, valores: dict) -> PartidaRegisto | None:
        valores = {**valores, "updated_at": datetime.now(UTC)}
        row = self._sessao.scalars(
            update(PartidaJogo)
            .where(PartidaJogo.id == uuid.UUID(partida_id), *condicoes)
            .values(**valores)
            .returning(PartidaJogo)
        ).first()
        if row is None:
            self._sessao.rollback()
            return None
        registo = _para_registo(row)
        self._sessao.commit()
        return registo

    def definir_pergunta(self, partida_id: str, pergunta_id: str, troca: bool) -> PartidaRegisto | None:
        condicoes = [PartidaJogo.estado == "em_curso"]
        valores: dict = {"pergunta_atual_id": uuid.UUID(pergunta_id), "opcao_falhada": None}
        if troca:
            # Trocar a pergunta sem a responder gasta a ajuda "trocar pergunta",
            # na mesma instrução -- dois pedidos simultâneos não trocam duas vezes.
            condicoes.append(PartidaJogo.trocar_pergunta_usada.is_(False))
            valores["trocar_pergunta_usada"] = True
        return self._atualizar(partida_id, condicoes, valores)

    def registar_acerto(
        self,
        partida_id: str,
        utilizador_id: str,
        pergunta_id: str,
        patamar_superado: int,
        sequencia_acertos: int,
        diamantes_bonus: int,
        hoje: date,
        limite_diario: int,
        categoria: str,
    ) -> AcertoRegisto | None:
        """Avança a partida e credita o bónus de sequência na mesma
        transacção -- e só se a pergunta ainda for a actual: responder duas
        vezes à mesma pergunta (ex.: dois pedidos simultâneos) conta uma vez.

        O bónus respeita o limite diário (`limite_diario`, dia `hoje` em UTC):
        credita-se só o que ainda cabe. A linha do perfil fica bloqueada
        (`FOR UPDATE`) entre ler o que já se ganhou hoje e somar, para dois
        acertos simultâneos (ex.: dois separadores) não passarem o limite."""
        agora = datetime.now(UTC)
        uid = uuid.UUID(utilizador_id)
        try:
            partida = self._sessao.scalars(
                update(PartidaJogo)
                .where(
                    PartidaJogo.id == uuid.UUID(partida_id),
                    PartidaJogo.estado == "em_curso",
                    PartidaJogo.pergunta_atual_id == uuid.UUID(pergunta_id),
                )
                .values(
                    patamar_superado=patamar_superado,
                    sequencia_acertos=sequencia_acertos,
                    pergunta_atual_id=None,
                    opcao_falhada=None,
                    updated_at=agora,
                )
                .returning(PartidaJogo.id)
            ).first()
            if partida is None:
                self._sessao.rollback()
                return None

            perfil = self._sessao.scalars(
                select(PerfilJogador).where(PerfilJogador.utilizador_id == uid).with_for_update()
            ).first()
            if perfil is None:
                self._sessao.rollback()
                raise RuntimeError(f"perfil de jogo inexistente para {utilizador_id}")
            ganho_hoje = perfil.diamantes_sequencia_hoje if perfil.diamantes_sequencia_dia == hoje else 0
            creditados = max(0, min(diamantes_bonus, limite_diario - ganho_hoje))
            perfil.diamantes += creditados
            perfil.diamantes_sequencia_hoje = ganho_hoje + creditados
            perfil.diamantes_sequencia_dia = hoje
            perfil.melhor_sequencia = max(perfil.melhor_sequencia, sequencia_acertos)
            perfil.updated_at = agora

            linha_partida = self._sessao.scalars(
                update(PartidaJogo)
                .where(PartidaJogo.id == uuid.UUID(partida_id))
                .values(diamantes_sequencia=PartidaJogo.diamantes_sequencia + creditados)
                .returning(PartidaJogo)
            ).one()
            registo_partida = _para_registo(linha_partida)
            self._contar_resposta(uid, categoria, certa=True)
            self._sessao.flush()
            registo_perfil = para_registo(perfil)
            self._sessao.commit()
        except Exception:
            self._sessao.rollback()
            raise
        return AcertoRegisto(partida=registo_partida, perfil=registo_perfil, diamantes_creditados=creditados)

    def registar_falha(
        self, partida_id: str, utilizador_id: str, pergunta_id: str, opcao_falhada: str | None, categoria: str
    ) -> PartidaRegisto | None:
        """Só a pergunta actual pode falhar; a sequência de acertos volta a 0
        e a resposta errada conta nas estatísticas da categoria -- tudo na
        mesma transacção."""
        try:
            linha = self._sessao.scalars(
                update(PartidaJogo)
                .where(
                    PartidaJogo.id == uuid.UUID(partida_id),
                    PartidaJogo.estado == "em_curso",
                    PartidaJogo.pergunta_atual_id == uuid.UUID(pergunta_id),
                )
                .values(
                    estado="a_aguardar_decisao",
                    opcao_falhada=opcao_falhada,
                    sequencia_acertos=0,
                    updated_at=datetime.now(UTC),
                )
                .returning(PartidaJogo)
            ).first()
            if linha is None:
                self._sessao.rollback()
                return None
            registo = _para_registo(linha)
            self._contar_resposta(uuid.UUID(utilizador_id), categoria, certa=False)
            self._sessao.commit()
        except Exception:
            self._sessao.rollback()
            raise
        return registo

    def _contar_resposta(self, utilizador_id: uuid.UUID, categoria: str, certa: bool) -> None:
        """+1 resposta (e +1 acerto se certa) na categoria -- upsert atómico,
        dentro da transacção de quem chama (não faz commit)."""
        tabela = EstatisticaCategoriaJogador.__table__
        acerto = 1 if certa else 0
        self._sessao.execute(
            insert(tabela)
            .values(utilizador_id=utilizador_id, categoria=categoria, respostas=1, acertos=acerto)
            .on_conflict_do_update(
                constraint="uq_estatisticas_categoria_jogador",
                set_={
                    "respostas": tabela.c.respostas + 1,
                    "acertos": tabela.c.acertos + acerto,
                    "updated_at": datetime.now(UTC),
                },
            )
        )

    def marcar_ajuda(self, partida_id: str, ajuda: AjudaPartida) -> bool:
        coluna = getattr(PartidaJogo, f"{ajuda}_usada")
        return (
            self._atualizar(
                partida_id, [PartidaJogo.estado == "em_curso", coluna.is_(False)], {f"{ajuda}_usada": True}
            )
            is not None
        )

    def usar_vida_extra(
        self, partida_id: str, utilizador_id: str, custo: int, maximo: int
    ) -> ResultadoVidaExtra:
        try:
            partida = self._sessao.scalars(
                update(PartidaJogo)
                .where(
                    PartidaJogo.id == uuid.UUID(partida_id),
                    PartidaJogo.estado == "a_aguardar_decisao",
                    PartidaJogo.vidas_extra_usadas < maximo,
                )
                .values(
                    estado="em_curso",
                    vidas_extra_usadas=PartidaJogo.vidas_extra_usadas + 1,
                    updated_at=datetime.now(UTC),
                )
                .returning(PartidaJogo)
            ).first()
            if partida is None:
                self._sessao.rollback()
                return ResultadoVidaExtra(estado="indisponivel")
            registo_partida = _para_registo(partida)

            perfil = self._sessao.scalars(
                update(PerfilJogador)
                .where(PerfilJogador.utilizador_id == uuid.UUID(utilizador_id), PerfilJogador.diamantes >= custo)
                .values(diamantes=PerfilJogador.diamantes - custo, updated_at=datetime.now(UTC))
                .returning(PerfilJogador)
            ).first()
            if perfil is None:
                # Desfaz também a mudança de estado da partida.
                self._sessao.rollback()
                return ResultadoVidaExtra(estado="saldo_insuficiente")
            registo_perfil = para_registo(perfil)
            self._sessao.commit()
        except Exception:
            self._sessao.rollback()
            raise
        return ResultadoVidaExtra(estado="ok", partida=registo_partida, perfil=registo_perfil)

    def terminar(
        self, partida_id: str, utilizador_id: str, moedas: int, diamantes: int
    ) -> PartidaTerminadaRegisto | None:
        agora = datetime.now(UTC)
        try:
            partida = self._sessao.scalars(
                update(PartidaJogo)
                .where(PartidaJogo.id == uuid.UUID(partida_id), PartidaJogo.estado != "terminada")
                .values(
                    estado="terminada",
                    moedas_ganhas=moedas,
                    diamantes_ganhos=diamantes,
                    terminada_em=agora,
                    updated_at=agora,
                )
                .returning(PartidaJogo)
            ).first()
            if partida is None:
                # Já terminada por outro pedido -- não se paga outra vez.
                self._sessao.rollback()
                return None
            registo_partida = _para_registo(partida)

            perfil = self._sessao.scalars(
                update(PerfilJogador)
                .where(PerfilJogador.utilizador_id == uuid.UUID(utilizador_id))
                .values(
                    moedas=PerfilJogador.moedas + moedas,
                    moedas_ganhas_total=PerfilJogador.moedas_ganhas_total + moedas,
                    patamares_superados_total=PerfilJogador.patamares_superados_total
                    + registo_partida.patamar_superado,
                    diamantes=PerfilJogador.diamantes + diamantes,
                    partidas_jogadas=PerfilJogador.partidas_jogadas + 1,
                    patamar_maximo_alcancado=func.greatest(
                        PerfilJogador.patamar_maximo_alcancado, registo_partida.patamar_superado
                    ),
                    updated_at=agora,
                )
                .returning(PerfilJogador)
            ).first()
            if perfil is None:
                # O service cria sempre o perfil antes de terminar; se não
                # existir, não se perde a partida a meio -- desfaz tudo.
                self._sessao.rollback()
                raise RuntimeError(f"perfil de jogo inexistente para {utilizador_id}")
            registo_perfil = para_registo(perfil)
            self._sessao.commit()
        except Exception:
            self._sessao.rollback()
            raise
        return PartidaTerminadaRegisto(partida=registo_partida, perfil=registo_perfil)

