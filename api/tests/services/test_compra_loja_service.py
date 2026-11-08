from datetime import UTC, datetime, timedelta

from app.repositories.compras_loja_repository import NovaCompraLoja
from app.services.compra_loja_service import (
    PREMIUM_MAXIMO_POR_TRANSACAO,
    CompraLojaService,
    EventoLoja,
    produto_do_catalogo,
)
from app.services.loja_jogo_service import PACOTES_DIAMANTES, PACOTES_MOEDAS

AGORA = datetime(2026, 10, 30, 12, 0, tzinfo=UTC)
CONTA = "7f1e9d2a-4b6c-4c1d-9e8f-0a1b2c3d4e5f"


class RepoFalso:
    """Imita o repositório: guarda as compras por (loja, transacção), aplica
    o ajuste do Premium a uma validade em memória e recusa repetidas."""

    def __init__(self, contas: set[str] | None = None, premium: datetime | None = None) -> None:
        self.contas = {CONTA} if contas is None else contas
        self.premium = premium
        self.compras: dict[tuple[str, str], NovaCompraLoja] = {}
        self.reembolsadas: set[tuple[str, str]] = set()

    def conta_activa(self, utilizador_id: str) -> bool:
        return utilizador_id in self.contas

    def registar(self, compra, somar_premium=None) -> bool:
        chave = (compra.loja, compra.transacao_id)
        if chave in self.compras:
            return False
        self.compras[chave] = compra
        if somar_premium is not None:
            self.premium = somar_premium(self.premium)
        return True

    def reembolsar(self, loja, transacao_id, quando, retirar_premium) -> bool:
        chave = (loja, transacao_id)
        compra = self.compras.get(chave)
        if compra is None or chave in self.reembolsadas:
            return False
        self.reembolsadas.add(chave)
        if compra.tipo == "premium":
            self.premium = retirar_premium(self.premium, compra.premium_segundos)
        return True


def _evento(**kw) -> EventoLoja:
    base = {
        "tipo": "INITIAL_PURCHASE",
        "utilizador_id": CONTA,
        "loja": "APP_STORE",
        "ambiente": "PRODUCTION",
        "produto_id": "jpa_premium_mensal",
        "transacao_id": "t-1",
        "transacao_original_id": "t-1",
        "comprado_em": AGORA,
        "expira_em": AGORA + timedelta(days=30),
        "motivo_cancelamento": None,
    }
    base.update(kw)
    return EventoLoja(**base)


def _servico(repo: RepoFalso, **kw) -> CompraLojaService:
    return CompraLojaService(repo, relogio=lambda: AGORA, **kw)


def test_catalogo_mapeia_premium_diamantes_e_moedas() -> None:
    assert produto_do_catalogo("jpa_premium_mensal").tipo == "premium"
    # Google Play: subscricao:plano_base
    assert produto_do_catalogo("jpa_premium_mensal:mensal").tipo == "premium"
    grande = next(p for p in PACOTES_DIAMANTES if p.id == "grande")
    assert produto_do_catalogo("jpa_diamantes_grande").quantidade == grande.total_diamantes
    bau = next(p for p in PACOTES_MOEDAS if p.id == "bau")
    assert produto_do_catalogo("jpa_moedas_bau").quantidade == bau.total_moedas
    assert produto_do_catalogo("jpa_diamantes_gigante") is None
    assert produto_do_catalogo("outra_coisa") is None


def test_compra_do_premium_soma_o_periodo_a_partir_de_agora() -> None:
    repo = RepoFalso()
    assert _servico(repo).processar(_evento()) == "aplicada"
    assert repo.premium == AGORA + timedelta(days=30)


def test_renovacao_soma_a_validade_que_ainda_resta() -> None:
    repo = RepoFalso(premium=AGORA + timedelta(days=10))
    assert _servico(repo).processar(_evento(tipo="RENEWAL", transacao_id="t-2")) == "aplicada"
    assert repo.premium == AGORA + timedelta(days=40)


def test_o_mesmo_evento_repetido_nunca_aplica_duas_vezes() -> None:
    repo = RepoFalso()
    servico = _servico(repo)
    assert servico.processar(_evento()) == "aplicada"
    assert servico.processar(_evento()) == "repetida"
    assert repo.premium == AGORA + timedelta(days=30)


def test_periodo_maior_que_o_tecto_nunca_da_mais_de_35_dias() -> None:
    repo = RepoFalso()
    _servico(repo).processar(_evento(expira_em=AGORA + timedelta(days=365)))
    assert repo.premium == AGORA + PREMIUM_MAXIMO_POR_TRANSACAO


def test_sem_datas_da_os_30_dias_do_premium() -> None:
    repo = RepoFalso()
    _servico(repo).processar(_evento(comprado_em=None, expira_em=None))
    assert repo.premium == AGORA + timedelta(days=30)


def test_diamantes_vem_do_catalogo_e_nao_tocam_no_premium() -> None:
    repo = RepoFalso()
    resultado = _servico(repo).processar(
        _evento(tipo="NON_RENEWING_PURCHASE", produto_id="jpa_diamantes_medio", expira_em=None)
    )
    assert resultado == "aplicada"
    compra = repo.compras[("app_store", "t-1")]
    assert (compra.tipo, compra.quantidade, compra.premium_segundos) == ("diamantes", 165, None)
    assert repo.premium is None


def test_play_store_e_sandbox_ficam_registados() -> None:
    repo = RepoFalso()
    _servico(repo).processar(_evento(loja="PLAY_STORE", ambiente="SANDBOX", produto_id="jpa_moedas_pilha"))
    compra = repo.compras[("play_store", "t-1")]
    assert (compra.loja, compra.ambiente, compra.tipo) == ("play_store", "sandbox", "moedas")


def test_sandbox_recusado_quando_desligado() -> None:
    repo = RepoFalso()
    assert _servico(repo, aceitar_sandbox=False).processar(_evento(ambiente="SANDBOX")) == "ignorada"
    assert repo.compras == {}


def test_produto_desconhecido_conta_inexistente_e_eventos_sem_interesse_ignoram_se() -> None:
    repo = RepoFalso()
    servico = _servico(repo)
    assert servico.processar(_evento(produto_id="jpa_premium_anual")) == "ignorada"
    assert servico.processar(_evento(utilizador_id="$RCAnonymousID:abc")) == "ignorada"
    assert servico.processar(_evento(tipo="EXPIRATION")) == "ignorada"
    assert servico.processar(_evento(tipo="TEST")) == "ignorada"
    assert servico.processar(_evento(loja="STRIPE")) == "ignorada"
    assert servico.processar(_evento(transacao_id=None)) == "ignorada"
    assert repo.compras == {} and repo.premium is None


def test_cancelar_a_renovacao_nao_tira_nada() -> None:
    repo = RepoFalso()
    servico = _servico(repo)
    servico.processar(_evento())
    assert servico.processar(_evento(tipo="CANCELLATION", motivo_cancelamento="UNSUBSCRIBE")) == "ignorada"
    assert repo.premium == AGORA + timedelta(days=30)


def test_reembolso_tira_so_o_periodo_dessa_transaccao() -> None:
    repo = RepoFalso(premium=AGORA + timedelta(days=10))
    servico = _servico(repo)
    servico.processar(_evento())
    assert repo.premium == AGORA + timedelta(days=40)

    reembolso = _evento(tipo="CANCELLATION", motivo_cancelamento="CUSTOMER_SUPPORT")
    assert servico.processar(reembolso) == "reembolsada"
    assert repo.premium == AGORA + timedelta(days=10)
    # Repetido, não tira outra vez.
    assert servico.processar(reembolso) == "ignorada"
    assert repo.premium == AGORA + timedelta(days=10)


def test_reembolso_que_esgota_a_validade_desliga_o_premium() -> None:
    repo = RepoFalso()
    servico = _servico(repo)
    servico.processar(_evento())
    servico.processar(_evento(tipo="CANCELLATION", motivo_cancelamento="CUSTOMER_SUPPORT"))
    assert repo.premium is None
