"""Regras das publicações (ADMIN-03).

O slug é gerado aqui, nunca aceite do cliente — é o identificador público
(`/publicacoes/{slug}`), e um slug escolhido livremente podia colidir ou
ser usado para enumerar/adivinhar publicações ainda em rascunho. Gerado a
partir do título, com um sufixo numérico se já existir."""

import re
import unicodedata
from datetime import date

from app.repositories.publicacoes_repository import PublicacaoRegisto, PublicacoesRepository


class PublicacaoNaoEncontradaError(Exception):
    pass


def _gerar_slug_base(titulo: str) -> str:
    texto = unicodedata.normalize("NFKD", titulo).encode("ascii", "ignore").decode("ascii")
    texto = re.sub(r"[^a-zA-Z0-9]+", "-", texto).strip("-").lower()
    return texto or "publicacao"


class PublicacoesService:
    def __init__(self, repositorio: PublicacoesRepository) -> None:
        self._repo = repositorio

    def _slug_unico(self, titulo: str) -> str:
        base = _gerar_slug_base(titulo)
        slug = base
        contador = 2
        while self._repo.existe_slug(slug):
            slug = f"{base}-{contador}"
            contador += 1
        return slug

    def criar(
        self,
        titulo: str,
        resumo: str,
        corpo: str,
        local: str | None,
        data_evento: date | None,
        criado_por: str | None,
    ) -> PublicacaoRegisto:
        # Nasce sempre em rascunho -- publicar é sempre um passo à parte e
        # explícito (ver publicar()), nunca automático ao criar.
        slug = self._slug_unico(titulo)
        return self._repo.criar(slug, titulo, resumo, corpo, local, data_evento, criado_por)

    def _obter_ou_falhar(self, publicacao_id: str) -> PublicacaoRegisto:
        atual = self._repo.obter_por_id(publicacao_id)
        if atual is None:
            raise PublicacaoNaoEncontradaError(publicacao_id)
        return atual

    def atualizar(
        self,
        publicacao_id: str,
        titulo: str | None = None,
        resumo: str | None = None,
        corpo: str | None = None,
        local: str | None = None,
        data_evento: date | None = None,
    ) -> PublicacaoRegisto:
        # O slug nunca muda depois de criado, mesmo que o título mude --
        # evita partir um link já partilhado publicamente.
        self._obter_ou_falhar(publicacao_id)
        resultado = self._repo.atualizar(
            publicacao_id,
            titulo=titulo,
            resumo=resumo,
            corpo=corpo,
            local=local,
            data_evento=data_evento,
        )
        assert resultado is not None  # já confirmámos que existe acima
        return resultado

    def publicar(self, publicacao_id: str) -> PublicacaoRegisto:
        self._obter_ou_falhar(publicacao_id)
        resultado = self._repo.definir_estado(publicacao_id, "publicada")
        assert resultado is not None
        return resultado

    def despublicar(self, publicacao_id: str) -> PublicacaoRegisto:
        self._obter_ou_falhar(publicacao_id)
        resultado = self._repo.definir_estado(publicacao_id, "rascunho")
        assert resultado is not None
        return resultado

    def apagar(self, publicacao_id: str) -> None:
        self._obter_ou_falhar(publicacao_id)
        self._repo.apagar(publicacao_id)
