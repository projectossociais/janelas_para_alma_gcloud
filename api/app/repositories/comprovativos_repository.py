"""Leitura das referências aos comprovativos de pagamento, nas três tabelas
que os guardam (`premium_requests`, `doacoes`, `pedidos_loja_jogo`), e a
gravação da migração dos comprovativos antigos para o bucket privado.

Uma linha tem `comprovativo_chave` (bucket privado, desde 2026-10-14) ou,
se for anterior e ainda por migrar, `comprovativo_url` (URL público).
Quem decide o que fazer com isso são `ComprovativoLeituraService` e
`MigracaoComprovativosService`."""

import uuid
from dataclasses import dataclass
from typing import Literal

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.repositories.orm_models import Doacao, PedidoLojaJogo, PremiumRequest

OrigemComprovativo = Literal["premium", "doacao", "loja"]

_MODELO_POR_ORIGEM = {
    "premium": PremiumRequest,
    "doacao": Doacao,
    "loja": PedidoLojaJogo,
}


@dataclass(frozen=True)
class ReferenciaComprovativo:
    chave: str | None
    url_legado: str | None


@dataclass(frozen=True)
class ComprovativoLegado:
    origem: OrigemComprovativo
    registo_id: str
    url: str


class SQLAlchemyComprovativosRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def obter_referencia(self, origem: OrigemComprovativo, registo_id: str) -> ReferenciaComprovativo | None:
        try:
            id_ = uuid.UUID(registo_id)
        except ValueError:
            return None
        modelo = _MODELO_POR_ORIGEM[origem]
        linha = self._sessao.execute(
            select(modelo.comprovativo_chave, modelo.comprovativo_url).where(modelo.id == id_)
        ).one_or_none()
        if linha is None:
            return None
        return ReferenciaComprovativo(chave=linha.comprovativo_chave, url_legado=linha.comprovativo_url)

    def listar_legados(self) -> list[ComprovativoLegado]:
        legados: list[ComprovativoLegado] = []
        for origem, modelo in _MODELO_POR_ORIGEM.items():
            linhas = self._sessao.execute(
                select(modelo.id, modelo.comprovativo_url)
                .where(modelo.comprovativo_url.is_not(None), modelo.comprovativo_chave.is_(None))
                .order_by(modelo.created_at)
            ).all()
            legados += [
                ComprovativoLegado(origem=origem, registo_id=str(linha.id), url=linha.comprovativo_url)  # type: ignore[arg-type]
                for linha in linhas
            ]
        return legados

    def marcar_migrado(self, origem: OrigemComprovativo, registo_id: str, chave: str) -> None:
        """Passa a apontar para a cópia privada e esquece o URL público, numa
        só instrução e só se a linha ainda estiver por migrar."""
        modelo = _MODELO_POR_ORIGEM[origem]
        self._sessao.execute(
            update(modelo)
            .where(modelo.id == uuid.UUID(registo_id), modelo.comprovativo_chave.is_(None))
            .values(comprovativo_chave=chave, comprovativo_url=None)
        )
        self._sessao.commit()
