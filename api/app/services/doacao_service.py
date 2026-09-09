"""Regras de negócio de doações.

Este é o serviço com o histórico mais grave do projecto: a versão antiga do
fluxo mostrava "Doação registada!" mesmo quando a gravação falhava (ver
CLAUDE.md, "Nunca mostrar sucesso antes de verificar `error`/excepção"). A
regra aqui é estrutural, não um cuidado a lembrar: `criar` do repository
nunca é chamado dentro de um `try` que engula a excepção — se a gravação
falhar, a excepção propaga até ao router (que devolve 5xx), e o frontend
nunca vê um ecrã de sucesso para uma doação que não foi gravada.
"""

import uuid

from app.repositories.doacoes_repository import DoacaoRegisto, DoacoesRepository


class MateriaisNaoSelecionadosError(Exception):
    pass


def _gerar_recibo_id(prefixo: str) -> str:
    # Gerado no servidor, não confiado ao cliente -- um recibo_id previsível
    # ou reutilizável do lado do browser seria fácil de falsificar.
    return f"{prefixo}-{uuid.uuid4().hex[:10].upper()}"


class DoacaoService:
    def __init__(self, repositorio: DoacoesRepository) -> None:
        self._repo = repositorio

    def registar_doacao_materiais(
        self, email: str, materiais: list[str], detalhes: str | None = None
    ) -> DoacaoRegisto:
        if not materiais:
            raise MateriaisNaoSelecionadosError("selecione pelo menos um tipo de material")

        return self._repo.criar(
            recibo_id=_gerar_recibo_id("JPA"),
            tipo="materiais",
            email=email,
            status="pendente",
            materiais=materiais,
            detalhes=detalhes,
        )
