"""Relatório dos exercícios para o médico, por link temporário (Fase B).

Decisão do dono do projecto (2026-09-29, docs/ANALISE_EXERCICIOS.md): o pai
gera um link só de leitura e envia-o ele próprio ao médico -- nada sai da
plataforma sem essa acção, e não há envio automático a clínicas.

Regras (e porquê):
- token de 256 bits (`secrets.token_urlsafe(32)`), guardado só como hash
  SHA-256: quem lê a base de dados não consegue abrir relatórios;
- válido 30 dias, revogável a qualquer momento, e no máximo 5 links activos
  por conta (evita links esquecidos a circular);
- o link mostra o primeiro nome, o olho mais fraco, o uso de óculos e os
  resultados dos exercícios dos últimos 90 dias -- nunca email, telefone,
  data de nascimento nem a conta toda;
- link inválido, expirado, revogado ou de conta anonimizada: sempre o mesmo
  erro, para não revelar qual dos casos é.
"""

import hashlib
import secrets
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol

from app.repositories.partilha_relatorio_repository import (
    PartilhaRegisto,
    PartilhaRelatorioRepository,
)
from app.repositories.sessoes_exercicio_repository import SessaoExercicioRegisto

VALIDADE_DIAS = 30
MAX_PARTILHAS_ACTIVAS = 5
JANELA_SESSOES_DIAS = 90
LIMITE_SESSOES = 1000
TAMANHO_MAXIMO_TOKEN = 128


class LimiteDePartilhasError(Exception):
    pass


class PartilhaNaoEncontradaError(Exception):
    pass


class LinkInvalidoError(Exception):
    """Inválido, expirado, revogado ou de conta anonimizada -- sempre este erro."""


class SessoesLeitura(Protocol):
    def listar_do_utilizador(
        self, user_id: str, versao: int, desde: datetime | None, limite: int
    ) -> list[SessaoExercicioRegisto]: ...


@dataclass(frozen=True)
class PartilhaCriada:
    partilha: PartilhaRegisto
    token: str


@dataclass(frozen=True)
class RelatorioPartilhado:
    nome: str | None
    olho_mais_fraco: str | None
    usa_oculos: bool | None
    expira_em: datetime
    gerado_em: datetime
    sessoes: list[SessaoExercicioRegisto]


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def partilha_activa(p: PartilhaRegisto, agora: datetime) -> bool:
    return p.revogado_em is None and p.expira_em > agora


class PartilhaRelatorioService:
    def __init__(
        self,
        repositorio: PartilhaRelatorioRepository,
        sessoes: SessoesLeitura,
        relogio: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._repo = repositorio
        self._sessoes = sessoes
        self._relogio = relogio

    def criar(self, utilizador_id: str) -> PartilhaCriada:
        agora = self._relogio()
        if self._repo.contar_activas(utilizador_id, agora) >= MAX_PARTILHAS_ACTIVAS:
            raise LimiteDePartilhasError(utilizador_id)
        token = secrets.token_urlsafe(32)
        partilha = self._repo.criar(utilizador_id, hash_token(token), agora + timedelta(days=VALIDADE_DIAS))
        return PartilhaCriada(partilha=partilha, token=token)

    def listar(self, utilizador_id: str) -> list[PartilhaRegisto]:
        return self._repo.listar_do_utilizador(utilizador_id)

    def revogar(self, utilizador_id: str, partilha_id: str) -> None:
        if not self._repo.revogar(partilha_id, utilizador_id, self._relogio()):
            raise PartilhaNaoEncontradaError(partilha_id)

    def ler(self, token: str) -> RelatorioPartilhado:
        agora = self._relogio()
        if not token or len(token) > TAMANHO_MAXIMO_TOKEN:
            raise LinkInvalidoError()
        partilha = self._repo.obter_por_hash(hash_token(token))
        if partilha is None or not partilha_activa(partilha, agora):
            raise LinkInvalidoError()
        dono = self._repo.obter_dono(partilha.utilizador_id)
        if dono is None:
            raise LinkInvalidoError()
        sessoes = self._sessoes.listar_do_utilizador(
            partilha.utilizador_id, versao=2, desde=agora - timedelta(days=JANELA_SESSOES_DIAS), limite=LIMITE_SESSOES
        )
        primeiro_nome = dono.nome.split()[0] if dono.nome and dono.nome.strip() else None
        return RelatorioPartilhado(
            nome=primeiro_nome,
            olho_mais_fraco=dono.olho_mais_fraco,
            usa_oculos=dono.usa_oculos,
            expira_em=partilha.expira_em,
            gerado_em=agora,
            sessoes=sessoes,
        )
