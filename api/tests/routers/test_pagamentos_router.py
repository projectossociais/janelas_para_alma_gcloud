"""Router dos comprovativos de pagamento -- tradução para HTTP e fronteira de
autorização (401/403), com o service ligado a falsos."""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import obter_auth_service
from app.core.security import criar_access_token, hash_password
from app.main import app
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.routers import pagamentos as pagamentos_router
from app.services.auth_service import AuthService
from app.services.validacao_comprovativo_service import ValidacaoComprovativoService
from tests.services.pdf_falso import criar_pdf, linhas_bai
from tests.services.test_auth_service import RepositorioFalso as RepositorioAuthFalso
from tests.services.test_validacao_comprovativo_service import (
    AGORA,
    CONFIG,
    NotificadorFalso,
    RepositorioFalso,
    StorageFalso,
)


def _seed(repo_auth: RepositorioAuthFalso, id_: str, papel: str) -> str:
    repo_auth._utilizadores[f"{id_}@example.com"] = UtilizadorRegisto(
        id=id_,
        email=f"{id_}@example.com",
        password_hash=hash_password("password-forte-123"),
        papel=papel,
        nome_completo=None,
        provincia=None,
        genero=None,
        criado_em=datetime.now(UTC),
    )
    return criar_access_token(id_)


@pytest.fixture
def ambiente():
    repo_auth = RepositorioAuthFalso()
    repo, storage = RepositorioFalso(), StorageFalso()
    token_admin = _seed(repo_auth, "id-admin", "admin")
    token_comum = _seed(repo_auth, "id-comum", "comum")
    servico = ValidacaoComprovativoService(repo, storage, CONFIG, NotificadorFalso(), relogio=lambda: AGORA)
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    app.dependency_overrides[pagamentos_router.obter_validacao_service] = lambda: servico
    app.dependency_overrides[pagamentos_router.obter_comprovativos_repository] = lambda: repo
    with TestClient(app) as c:
        yield c, repo, storage, token_admin, token_comum
    app.dependency_overrides.clear()


def _enviar(storage, conteudo, nome="a", utilizador="id-comum") -> str:
    chave = f"comprovativos-pagamento/{utilizador}/{nome}.pdf"
    storage.ficheiros[chave] = conteudo
    return chave


def _validar(c, token, chave):
    c.cookies.set("access_token", token)
    return c.post("/pagamentos/comprovativos/validar", json={"chave": chave})


def test_upload_exige_sessao(ambiente) -> None:
    c, *_ = ambiente
    assert c.post("/pagamentos/comprovativos/upload", json={"content_type": "application/pdf"}).status_code == 401


def test_upload_aceita_capturas_de_ecra_e_recusa_outros_tipos(ambiente) -> None:
    c, _, _, _, token = ambiente
    c.cookies.set("access_token", token)
    r = c.post("/pagamentos/comprovativos/upload", json={"content_type": "image/jpeg"})
    assert r.status_code == 200 and r.json()["chave"].endswith(".jpg")
    assert c.post("/pagamentos/comprovativos/upload", json={"content_type": "application/zip"}).status_code == 422
    assert c.post("/pagamentos/comprovativos/upload", json={}).status_code == 422


def test_upload_devolve_chave_do_proprio(ambiente) -> None:
    c, _, _, _, token = ambiente
    c.cookies.set("access_token", token)
    r = c.post("/pagamentos/comprovativos/upload", json={"content_type": "application/pdf"})
    assert r.status_code == 200
    assert r.json()["chave"].startswith("comprovativos-pagamento/id-comum/")


def test_validar_exige_sessao(ambiente) -> None:
    c, *_ = ambiente
    r = c.post("/pagamentos/comprovativos/validar", json={"chave": "comprovativos-pagamento/x/a.pdf"})
    assert r.status_code == 401


def test_aprovado_devolve_200_com_a_nova_validade(ambiente) -> None:
    c, _repo, storage, _, token = ambiente
    r = _validar(c, token, _enviar(storage, criar_pdf(linhas_bai())))
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["estado"] == "aprovado"
    assert corpo["referencia_transacao"] == "202610140001234"
    assert corpo["premium_expira_em"].startswith("2026-11-13")
    # Nunca o texto extraído nem os metadados para o utilizador.
    assert "texto_extraido" not in corpo and "metadados_ficheiro" not in corpo


def test_revisao_manual_devolve_202(ambiente) -> None:
    c, _, storage, _, token = ambiente
    sem_referencia = [linha for linha in linhas_bai() if "Operação:" not in linha]
    r = _validar(c, token, _enviar(storage, criar_pdf(sem_referencia)))
    assert r.status_code == 202
    assert r.json()["estado"] == "revisao_manual"


def test_rejeitado_devolve_422_com_mensagem_e_codigo(ambiente) -> None:
    c, _, storage, _, token = ambiente
    r = _validar(c, token, _enviar(storage, criar_pdf(linhas_bai(montante="5.000,00 Kz"))))
    assert r.status_code == 422
    assert r.json()["codigo"] == "valor_insuficiente"
    assert "5.000,00 Kz" in r.json()["detail"]


def test_comprovativo_repetido_devolve_409(ambiente) -> None:
    c, _, storage, _, token = ambiente
    conteudo = criar_pdf(linhas_bai())
    _validar(c, token, _enviar(storage, conteudo, nome="a"))
    r = _validar(c, token, _enviar(storage, conteudo, nome="b"))
    assert r.status_code == 409
    assert r.json() == {
        "detail": "Este comprovativo já foi utilizado anteriormente.",
        "codigo": "comprovativo_ja_utilizado",
        "comprovativo_id": r.json()["comprovativo_id"],
    }


def test_chave_de_outra_conta_devolve_403(ambiente) -> None:
    c, _, storage, _, token = ambiente
    chave = _enviar(storage, criar_pdf(linhas_bai()), utilizador="id-admin")
    assert _validar(c, token, chave).status_code == 403


def test_ficheiro_que_nao_chegou_devolve_404(ambiente) -> None:
    c, _, _, _, token = ambiente
    assert _validar(c, token, "comprovativos-pagamento/id-comum/nada.pdf").status_code == 404


def test_sem_bucket_configurado_responde_503(monkeypatch) -> None:
    from app.core import config

    config.obter_settings.cache_clear()
    monkeypatch.setenv("R2_BUCKET_COMPROVATIVOS", "")
    repo_auth = RepositorioAuthFalso()
    token = _seed(repo_auth, "id-comum", "comum")
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    try:
        with TestClient(app) as c:
            c.cookies.set("access_token", token)
            assert c.post("/pagamentos/comprovativos/upload", json={"content_type": "application/pdf"}).status_code == 503
    finally:
        app.dependency_overrides.clear()
        config.obter_settings.cache_clear()


# --- admin ---------------------------------------------------------------------


@pytest.mark.parametrize(
    ("metodo", "caminho"),
    [
        ("get", "/admin/comprovativos-pagamento"),
        ("get", "/admin/comprovativos-pagamento/c-1"),
        ("get", "/admin/comprovativos-pagamento/c-1/ficheiro"),
        ("post", "/admin/comprovativos-pagamento/c-1/aprovar"),
    ],
)
def test_rotas_de_admin_recusam_quem_nao_e_admin(ambiente, metodo, caminho) -> None:
    c, _, _, _, token_comum = ambiente
    assert getattr(c, metodo)(caminho).status_code == 401
    c.cookies.set("access_token", token_comum)
    assert getattr(c, metodo)(caminho).status_code == 403


def test_admin_lista_filtra_e_ve_o_detalhe(ambiente) -> None:
    c, _, storage, token_admin, token = ambiente
    _validar(c, token, _enviar(storage, criar_pdf(linhas_bai()), nome="a"))
    _validar(c, token, _enviar(storage, criar_pdf(linhas_bai(montante="5.000,00 Kz")), nome="b"))
    c.cookies.set("access_token", token_admin)

    todos = c.get("/admin/comprovativos-pagamento").json()
    assert {t["estado"] for t in todos} == {"aprovado", "rejeitado"}
    assert "texto_extraido" not in todos[0]
    rejeitados = c.get("/admin/comprovativos-pagamento?estado=rejeitado").json()
    assert [r["motivo_codigo"] for r in rejeitados] == ["valor_insuficiente"]
    assert c.get("/admin/comprovativos-pagamento?estado=inventado").status_code == 422

    detalhe = c.get(f"/admin/comprovativos-pagamento/{todos[0]['id']}").json()
    assert "Montante" in detalhe["texto_extraido"]
    assert detalhe["metadados_ficheiro"]["Producer"] == "BAI Directo"
    assert c.get("/admin/comprovativos-pagamento/nao-existe").status_code == 404

    url = c.get(f"/admin/comprovativos-pagamento/{todos[0]['id']}/ficheiro").json()["url"]
    assert url.startswith("https://r2.example/get/comprovativos-pagamento/id-comum/")


def test_admin_aprova_rejeita_e_revoga(ambiente) -> None:
    c, repo, storage, token_admin, token = ambiente
    sem_referencia = [linha for linha in linhas_bai() if "Operação:" not in linha]
    revisao = _validar(c, token, _enviar(storage, criar_pdf(sem_referencia), nome="a")).json()
    c.cookies.set("access_token", token_admin)

    r = c.post(f"/admin/comprovativos-pagamento/{revisao['id']}/aprovar")
    assert r.status_code == 200 and r.json()["estado"] == "aprovado"
    assert r.json()["decidido_por"] == "id-admin"
    assert c.post(f"/admin/comprovativos-pagamento/{revisao['id']}/aprovar").status_code == 409

    assert c.post(f"/admin/comprovativos-pagamento/{revisao['id']}/revogar", json={"motivo": "x"}).status_code == 422
    r = c.post(f"/admin/comprovativos-pagamento/{revisao['id']}/revogar", json={"motivo": "fraude"})
    assert r.status_code == 200 and r.json()["estado"] == "revogado"
    assert repo.premium["id-comum"] is None
    assert c.post("/admin/comprovativos-pagamento/nao-existe/aprovar").status_code == 404
