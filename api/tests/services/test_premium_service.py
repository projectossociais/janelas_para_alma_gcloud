"""Testes do `PremiumService` — lógica de dinheiro e acesso (W-11).

O caminho do erro pesa tanto como o do sucesso: aprovar um pedido que não
existe, aprovar duas vezes, ou aprovar um pedido sem conta ligada têm de
ser recusados aqui, não na interface.
"""

from datetime import UTC, datetime, timedelta

import pytest

from app.core.config import obter_settings
from app.repositories.premium_repository import PedidoPremiumRegisto
from app.services.comprovativo_upload_service import ChaveDeComprovativoInvalidaError
from app.services.premium_service import (
    PREMIUM_DURACAO_DIAS,
    PedidoJaAprovadoError,
    PedidoNaoEncontradoError,
    PedidoSemContaError,
    PremiumService,
)

BASE_PUBLICA = "https://cdn.exemplo.test"


@pytest.fixture(autouse=True)
def _base_publica(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(obter_settings(), "r2_public_base_url", BASE_PUBLICA)


def _pedido(**over) -> PedidoPremiumRegisto:
    base = {
        "id": "ped-1",
        "user_id": "user-1",
        "nome": "Ana",
        "email": "ana@example.com",
        "telefone": None,
        "plano": "mensal",
        "status": "pendente",
        "comprovativo_url": None,
        "aprovado_por": None,
        "aprovado_em": None,
        "created_at": datetime.now(UTC),
    }
    base.update(over)
    return PedidoPremiumRegisto(**base)


class RepositorioPremiumFalso:
    def __init__(self, pedido: PedidoPremiumRegisto | None) -> None:
        self._pedido = pedido
        self.aprovado: dict | None = None
        self.revogado: dict | None = None
        self.criado: dict | None = None

    def obter(self, pedido_id: str) -> PedidoPremiumRegisto | None:
        return self._pedido if self._pedido and self._pedido.id == pedido_id else None

    def aprovar_pagamento(self, pedido_id, admin_id, quando, expira_em) -> PedidoPremiumRegisto:
        self.aprovado = {
            "pedido_id": pedido_id,
            "admin_id": admin_id,
            "quando": quando,
            "expira_em": expira_em,
        }
        return _pedido(status="aprovado", aprovado_por=admin_id, aprovado_em=quando)

    def revogar(self, pedido_id, admin_id, quando) -> PedidoPremiumRegisto:
        self.revogado = {"pedido_id": pedido_id, "admin_id": admin_id, "quando": quando}
        return _pedido(status="revogado", aprovado_por=admin_id, aprovado_em=quando)

    def criar(self, nome, email, telefone, plano, user_id, comprovativo_url=None):
        self.criado = {
            "nome": nome,
            "email": email,
            "telefone": telefone,
            "plano": plano,
            "user_id": user_id,
            "comprovativo_url": comprovativo_url,
        }
        return _pedido(nome=nome, email=email, comprovativo_url=comprovativo_url)

    def listar(self):  # pragma: no cover
        raise NotImplementedError


class TestCriarPedido:
    def test_cria_com_o_url_publico_do_comprovativo(self) -> None:
        repo = RepositorioPremiumFalso(None)
        chave = "comprovativos/abc.pdf"

        resultado = PremiumService(repo).criar_pedido(
            "Ana", "ana@example.com", None, "mensal", "user-1", chave
        )

        assert resultado.comprovativo_url == f"{BASE_PUBLICA}/{chave}"
        assert repo.criado["comprovativo_url"] == f"{BASE_PUBLICA}/{chave}"

    def test_recusa_chave_fora_do_prefixo_comprovativos(self) -> None:
        repo = RepositorioPremiumFalso(None)

        with pytest.raises(ChaveDeComprovativoInvalidaError):
            PremiumService(repo).criar_pedido(
                "Ana", "ana@example.com", None, "mensal", None, "avatares/outro/foto.png"
            )
        assert repo.criado is None


class TestAprovarPagamento:
    def test_aprova_e_marca_validade_30_dias_a_frente(self) -> None:
        repo = RepositorioPremiumFalso(_pedido())
        antes = datetime.now(UTC)

        resultado = PremiumService(repo).aprovar_pagamento("ped-1", "admin-9")

        assert resultado.status == "aprovado"
        assert repo.aprovado["admin_id"] == "admin-9"
        janela = repo.aprovado["expira_em"] - repo.aprovado["quando"]
        assert janela == timedelta(days=PREMIUM_DURACAO_DIAS)
        assert antes <= repo.aprovado["quando"] <= datetime.now(UTC)

    def test_pedido_inexistente(self) -> None:
        with pytest.raises(PedidoNaoEncontradoError):
            PremiumService(RepositorioPremiumFalso(None)).aprovar_pagamento("ped-1", "admin-9")

    def test_pedido_ja_aprovado_nao_estica_a_validade(self) -> None:
        repo = RepositorioPremiumFalso(_pedido(status="aprovado"))
        with pytest.raises(PedidoJaAprovadoError):
            PremiumService(repo).aprovar_pagamento("ped-1", "admin-9")
        assert repo.aprovado is None

    def test_pedido_sem_conta_ligada(self) -> None:
        repo = RepositorioPremiumFalso(_pedido(user_id=None))
        with pytest.raises(PedidoSemContaError):
            PremiumService(repo).aprovar_pagamento("ped-1", "admin-9")
        assert repo.aprovado is None


class TestRevogar:
    def test_revoga(self) -> None:
        repo = RepositorioPremiumFalso(_pedido(status="aprovado"))
        resultado = PremiumService(repo).revogar("ped-1", "admin-9")
        assert resultado.status == "revogado"
        assert repo.revogado["admin_id"] == "admin-9"

    def test_revogar_pedido_inexistente(self) -> None:
        with pytest.raises(PedidoNaoEncontradoError):
            PremiumService(RepositorioPremiumFalso(None)).revogar("ped-1", "admin-9")
