"""Acesso a dados das perguntas do jogo "Você Sabia Que...".

`resposta_correta` e `explicacao` saem daqui em `PerguntaJogoRegisto`, mas
nunca alcançam o cliente antes da validação -- quem garante isso é o router
(`PerguntaPublica` não tem esses campos), não este repositório. Aqui só se
garante que a leitura/escrita na base de dados está correcta.
"""

import uuid
from dataclasses import dataclass
from typing import Protocol

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.repositories.orm_models import CATEGORIA_PERGUNTA_POR_OMISSAO, PerguntaJogo, RespostaOpcao


def nivel_dificuldade_do_patamar(patamar: int) -> int:
    """Mapeia o patamar do jogo (1 a 15) para o nível de dificuldade das
    perguntas em reserva (1 a 3) -- 5 patamares por nível, como nos
    prémios do Milionário (500 Kz-5.000 Kz, 7.500 Kz-50.000 Kz e
    100.000 Kz-1.000.000 Kz). O `patamar` é só do jogo; a pergunta em si
    não sabe a que prémio corresponde, só ao seu nível de dificuldade."""
    if patamar <= 5:
        return 1
    if patamar <= 10:
        return 2
    return 3


@dataclass(frozen=True)
class PerguntaJogoRegisto:
    id: str
    texto_pergunta: str
    opcao_a: str
    opcao_b: str
    opcao_c: str
    opcao_d: str
    resposta_correta: str
    nivel_dificuldade: int
    explicacao: str | None
    categoria: str = CATEGORIA_PERGUNTA_POR_OMISSAO


class PerguntaJogoRepository(Protocol):
    def obter_aleatoria(
        self, nivel_dificuldade: int | None = None, excluir_id: str | None = None
    ) -> PerguntaJogoRegisto | None: ...
    def obter_por_id(self, pergunta_id: str) -> PerguntaJogoRegisto | None: ...
    def criar(
        self,
        texto_pergunta: str,
        opcao_a: str,
        opcao_b: str,
        opcao_c: str,
        opcao_d: str,
        resposta_correta: str,
        nivel_dificuldade: int,
        explicacao: str | None,
        categoria: str = CATEGORIA_PERGUNTA_POR_OMISSAO,
    ) -> PerguntaJogoRegisto: ...


def _para_registo(row: PerguntaJogo) -> PerguntaJogoRegisto:
    return PerguntaJogoRegisto(
        id=str(row.id),
        texto_pergunta=row.texto_pergunta,
        opcao_a=row.opcao_a,
        opcao_b=row.opcao_b,
        opcao_c=row.opcao_c,
        opcao_d=row.opcao_d,
        resposta_correta=row.resposta_correta.value,
        nivel_dificuldade=row.nivel_dificuldade,
        explicacao=row.explicacao,
        categoria=row.categoria,
    )


class SQLAlchemyPerguntaJogoRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def obter_aleatoria(
        self, nivel_dificuldade: int | None = None, excluir_id: str | None = None
    ) -> PerguntaJogoRegisto | None:
        query = select(PerguntaJogo)
        if nivel_dificuldade is not None:
            query = query.where(PerguntaJogo.nivel_dificuldade == nivel_dificuldade)
        if excluir_id is not None:
            # "Trocar pergunta" nunca devolve a mesma.
            query = query.where(PerguntaJogo.id != uuid.UUID(excluir_id))
        # ORDER BY random() -- banco de perguntas de quiz, não um hot path;
        # não vale complicar com TABLESAMPLE por isto.
        row = self._sessao.scalars(query.order_by(func.random()).limit(1)).first()
        return _para_registo(row) if row is not None else None

    def obter_por_id(self, pergunta_id: str) -> PerguntaJogoRegisto | None:
        row = self._sessao.get(PerguntaJogo, uuid.UUID(pergunta_id))
        return _para_registo(row) if row is not None else None

    def criar(
        self,
        texto_pergunta: str,
        opcao_a: str,
        opcao_b: str,
        opcao_c: str,
        opcao_d: str,
        resposta_correta: str,
        nivel_dificuldade: int,
        explicacao: str | None,
        categoria: str = CATEGORIA_PERGUNTA_POR_OMISSAO,
    ) -> PerguntaJogoRegisto:
        row = PerguntaJogo(
            texto_pergunta=texto_pergunta,
            opcao_a=opcao_a,
            opcao_b=opcao_b,
            opcao_c=opcao_c,
            opcao_d=opcao_d,
            resposta_correta=RespostaOpcao(resposta_correta),
            nivel_dificuldade=nivel_dificuldade,
            explicacao=explicacao,
            categoria=categoria,
        )
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row)
