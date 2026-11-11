"""Acesso a dados dos registos de parceiros (`candidaturas_parceria`): uma
empresa — clínica, óptica, organização — que pede para se juntar à rede.

Só grava. As regras (que documentos se aceitam, quantos) vivem no
`CandidaturaParceriaService`, testado sem base de dados através do
`Protocol` abaixo."""

import secrets
from dataclasses import dataclass
from typing import Protocol

from sqlalchemy.orm import Session

from app.repositories.orm_models import CandidaturaParceria


@dataclass(frozen=True)
class DocumentoParceria:
    # Chave no bucket privado (`parcerias/<uuid>.<ext>`), nome original do
    # ficheiro (só para mostrar e para o anexo do email) e tipo.
    chave: str
    nome: str
    content_type: str


@dataclass(frozen=True)
class DadosCandidaturaParceria:
    denominacao: str
    nif: str
    tipo: str
    provincia: str
    morada: str | None
    website: str | None
    representante_nome: str
    representante_cargo: str
    email: str
    telefone: str
    mensagem: str | None
    documentos: tuple[DocumentoParceria, ...] = ()


@dataclass(frozen=True)
class CandidaturaParceriaRegisto:
    id: str
    # Curta e legível (PAR-XXXXXX): vai nos emails, para a empresa e a
    # equipa falarem do mesmo pedido.
    referencia: str
    dados: DadosCandidaturaParceria


class CandidaturaParceriaRepository(Protocol):
    def criar(self, dados: DadosCandidaturaParceria) -> CandidaturaParceriaRegisto: ...


def _gerar_referencia() -> str:
    return f"PAR-{secrets.token_hex(3).upper()}"


class SQLAlchemyCandidaturaParceriaRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def criar(self, dados: DadosCandidaturaParceria) -> CandidaturaParceriaRegisto:
        row = CandidaturaParceria(
            referencia=_gerar_referencia(),
            denominacao=dados.denominacao,
            nif=dados.nif,
            tipo=dados.tipo,
            provincia=dados.provincia,
            morada=dados.morada,
            website=dados.website,
            representante_nome=dados.representante_nome,
            representante_cargo=dados.representante_cargo,
            email=dados.email,
            telefone=dados.telefone,
            mensagem=dados.mensagem,
            documentos=[
                {"chave": d.chave, "nome": d.nome, "content_type": d.content_type} for d in dados.documentos
            ],
        )
        self._sessao.add(row)
        # Sem try/except: se a gravação falhar, a excepção propaga -- nunca
        # um "registo enviado" fabricado (CLAUDE.md §6).
        self._sessao.commit()
        self._sessao.refresh(row)
        return CandidaturaParceriaRegisto(id=str(row.id), referencia=row.referencia, dados=dados)
