"""O bug mais grave que este projecto já teve: a versão antiga mostrava
"Doação registada!" mesmo quando o insert falhava. O teste central deste
ficheiro (`test_nunca_engole_uma_falha_de_gravacao`) reproduz exactamente
essa classe de bug — ver CLAUDE.md, "Nunca mostrar sucesso antes de
verificar error/excepção" e a tabela unitário-vs-integração da secção 8.
"""

from datetime import UTC, datetime

import pytest

from app.repositories.doacoes_repository import DoacaoRegisto
from app.services.doacao_service import DoacaoService, MateriaisNaoSelecionadosError


class RepositorioFalso:
    def __init__(self) -> None:
        self.chamadas: list[dict] = []

    def criar(self, recibo_id, tipo, email, status, materiais=None, detalhes=None) -> DoacaoRegisto:
        self.chamadas.append(
            {"recibo_id": recibo_id, "tipo": tipo, "email": email, "status": status, "materiais": materiais}
        )
        return DoacaoRegisto(
            id="doacao-1",
            recibo_id=recibo_id,
            tipo=tipo,
            email=email,
            materiais=materiais,
            detalhes=detalhes,
            status=status,
            created_at=datetime.now(UTC),
        )


class RepositorioQueFalha:
    """Simula uma gravação que falha de verdade (ligação perdida,
    constraint, o que for) -- não um {data, error} apanhado e escondido."""

    def criar(self, **_kwargs) -> DoacaoRegisto:
        raise RuntimeError("falha ao gravar na base de dados")


class TestRegistarDoacaoMateriais:
    def test_regista_com_um_recibo_gerado_pelo_servidor(self) -> None:
        service = DoacaoService(RepositorioFalso())

        doacao = service.registar_doacao_materiais("ana@example.com", ["livros", "brinquedos"])

        assert doacao.recibo_id.startswith("JPA-")
        assert doacao.status == "pendente"
        assert doacao.materiais == ["livros", "brinquedos"]

    def test_rejeita_sem_materiais_selecionados(self) -> None:
        service = DoacaoService(RepositorioFalso())

        with pytest.raises(MateriaisNaoSelecionadosError):
            service.registar_doacao_materiais("ana@example.com", [])

    def test_nunca_engole_uma_falha_de_gravacao(self) -> None:
        # A regra que mais importa neste ficheiro inteiro: se a gravação
        # falhar, a excepção tem de propagar. Nunca um "sucesso" fabricado.
        service = DoacaoService(RepositorioQueFalha())

        with pytest.raises(RuntimeError):
            service.registar_doacao_materiais("ana@example.com", ["livros"])

    def test_cada_doacao_recebe_um_recibo_diferente(self) -> None:
        repo = RepositorioFalso()
        service = DoacaoService(repo)

        d1 = service.registar_doacao_materiais("ana@example.com", ["livros"])
        d2 = service.registar_doacao_materiais("ana@example.com", ["livros"])

        assert d1.recibo_id != d2.recibo_id
