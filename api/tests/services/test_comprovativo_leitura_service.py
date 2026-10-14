"""Testes do `ComprovativoLeituraService` — como um admin abre um
comprovativo de pagamento.

Comprovativos novos vivem num bucket privado e só se lêem por um URL
assinado de vida curta. Comprovativos antigos (anteriores à migração, ainda
com `comprovativo_url` público) continuam legíveis até o script
`scripts/migrar_comprovativos_privados.py` os copiar para o bucket privado.
A autorização (só admin) é do router — ver
`tests/routers/test_comprovativos_admin_router.py`."""

import pytest

from app.services.comprovativo_leitura_service import (
    ArmazenamentoPrivadoIndisponivelError,
    ComprovativoLeituraService,
    ComprovativoNaoEncontradoError,
    ReferenciaComprovativo,
)

EXPIRA = 300


class RepositorioFalso:
    def __init__(self, referencias: dict[tuple[str, str], ReferenciaComprovativo]) -> None:
        self._referencias = referencias

    def obter_referencia(self, origem: str, registo_id: str) -> ReferenciaComprovativo | None:
        return self._referencias.get((origem, registo_id))


class LeitorFalso:
    def __init__(self) -> None:
        self.chamadas: list[str] = []

    def url_de_leitura(self, chave: str) -> str:
        self.chamadas.append(chave)
        return f"https://privado.r2.test/{chave}?assinatura=xyz"


def _servico(referencias, leitor=None) -> ComprovativoLeituraService:
    return ComprovativoLeituraService(RepositorioFalso(referencias), leitor, EXPIRA)


def test_comprovativo_privado_devolve_url_assinado_de_vida_curta() -> None:
    leitor = LeitorFalso()
    servico = _servico(
        {("premium", "p1"): ReferenciaComprovativo(chave="comprovativos/a.pdf", url_legado=None)}, leitor
    )

    resultado = servico.url_para_admin("premium", "p1")

    assert resultado.url == "https://privado.r2.test/comprovativos/a.pdf?assinatura=xyz"
    assert resultado.expira_em_segundos == EXPIRA
    assert leitor.chamadas == ["comprovativos/a.pdf"]


def test_chave_tem_prioridade_sobre_um_url_legado_que_tenha_ficado() -> None:
    leitor = LeitorFalso()
    servico = _servico(
        {
            ("loja", "l1"): ReferenciaComprovativo(
                chave="comprovativos/b.png", url_legado="https://pub.r2.dev/comprovativos/b.png"
            )
        },
        leitor,
    )

    assert servico.url_para_admin("loja", "l1").url.startswith("https://privado.r2.test/")


def test_comprovativo_antigo_por_migrar_continua_legivel_pelo_url_publico() -> None:
    servico = _servico(
        {("doacao", "d1"): ReferenciaComprovativo(chave=None, url_legado="https://pub.r2.dev/comprovativos/c.pdf")},
        LeitorFalso(),
    )

    resultado = servico.url_para_admin("doacao", "d1")

    assert resultado.url == "https://pub.r2.dev/comprovativos/c.pdf"
    assert resultado.expira_em_segundos is None


def test_comprovativo_antigo_continua_legivel_mesmo_sem_bucket_privado() -> None:
    servico = _servico(
        {("doacao", "d1"): ReferenciaComprovativo(chave=None, url_legado="https://pub.r2.dev/comprovativos/c.pdf")},
        None,
    )

    assert servico.url_para_admin("doacao", "d1").url == "https://pub.r2.dev/comprovativos/c.pdf"


def test_registo_inexistente_e_nao_encontrado() -> None:
    with pytest.raises(ComprovativoNaoEncontradoError):
        _servico({}, LeitorFalso()).url_para_admin("premium", "nao-existe")


def test_registo_sem_comprovativo_e_nao_encontrado() -> None:
    servico = _servico({("doacao", "d2"): ReferenciaComprovativo(chave=None, url_legado=None)}, LeitorFalso())

    with pytest.raises(ComprovativoNaoEncontradoError):
        servico.url_para_admin("doacao", "d2")


def test_chave_privada_sem_bucket_configurado_e_indisponivel() -> None:
    servico = _servico({("premium", "p1"): ReferenciaComprovativo(chave="comprovativos/a.pdf", url_legado=None)})

    with pytest.raises(ArmazenamentoPrivadoIndisponivelError):
        servico.url_para_admin("premium", "p1")


def test_nunca_assina_uma_chave_fora_do_prefixo_dos_comprovativos() -> None:
    """Defesa em profundidade: mesmo que uma linha tenha uma chave estranha,
    o endpoint de admin nunca vira um assinador de leitura para qualquer
    objecto do bucket."""
    leitor = LeitorFalso()
    servico = _servico(
        {("premium", "p1"): ReferenciaComprovativo(chave="outra-coisa/x.pdf", url_legado=None)}, leitor
    )

    with pytest.raises(ComprovativoNaoEncontradoError):
        servico.url_para_admin("premium", "p1")
    assert leitor.chamadas == []
