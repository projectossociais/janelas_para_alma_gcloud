from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from app.repositories.partilha_relatorio_repository import DonoDoRelatorio, PartilhaRegisto
from app.repositories.sessoes_exercicio_repository import SessaoExercicioRegisto
from app.services.partilha_relatorio_service import (
    JANELA_SESSOES_DIAS,
    MAX_PARTILHAS_ACTIVAS,
    VALIDADE_DIAS,
    LimiteDePartilhasError,
    LinkInvalidoError,
    PartilhaNaoEncontradaError,
    PartilhaRelatorioService,
    hash_token,
)

AGORA = datetime(2026, 9, 29, 12, 0, tzinfo=UTC)


class RepositorioPartilhasFalso:
    def __init__(self) -> None:
        self.partilhas: dict[str, tuple[PartilhaRegisto, str]] = {}
        self.donos: dict[str, DonoDoRelatorio] = {
            "u1": DonoDoRelatorio("u1", "Ana Maria Silva", "esquerdo", True),
            "u2": DonoDoRelatorio("u2", None, None, None),
        }

    def criar(self, utilizador_id, token_hash, expira_em):
        p = PartilhaRegisto(f"p{len(self.partilhas) + 1}", utilizador_id, AGORA, expira_em, None)
        self.partilhas[p.id] = (p, token_hash)
        return p

    def contar_activas(self, utilizador_id, agora):
        return sum(
            1 for p, _ in self.partilhas.values() if p.utilizador_id == utilizador_id and p.revogado_em is None and p.expira_em > agora
        )

    def listar_do_utilizador(self, utilizador_id):
        return [p for p, _ in self.partilhas.values() if p.utilizador_id == utilizador_id]

    def revogar(self, partilha_id, utilizador_id, agora):
        if partilha_id not in self.partilhas:
            return False
        p, h = self.partilhas[partilha_id]
        if p.utilizador_id != utilizador_id:
            return False
        if p.revogado_em is None:
            self.partilhas[partilha_id] = (replace(p, revogado_em=agora), h)
        return True

    def obter_por_hash(self, token_hash):
        return next((p for p, h in self.partilhas.values() if h == token_hash), None)

    def obter_dono(self, utilizador_id):
        return self.donos.get(utilizador_id)

    def expirar(self, partilha_id):
        p, h = self.partilhas[partilha_id]
        self.partilhas[partilha_id] = (replace(p, expira_em=AGORA - timedelta(seconds=1)), h)


class SessoesFalsas:
    def __init__(self) -> None:
        self.pedidos: list[dict] = []

    def listar_do_utilizador(self, user_id, versao, desde, limite):
        self.pedidos.append({"user_id": user_id, "versao": versao, "desde": desde, "limite": limite})
        return [
            SessaoExercicioRegisto(
                id="s1", user_id=user_id, exercicio_id="figure8", duracao_segundos=60, pontuacao=0,
                precisao_percentual=0, detalhes=None, created_at=AGORA,
            )
        ]


def _servico():
    repo, sessoes = RepositorioPartilhasFalso(), SessoesFalsas()
    return PartilhaRelatorioService(repo, sessoes, relogio=lambda: AGORA), repo, sessoes


def test_criar_devolve_um_token_forte_e_guarda_so_o_hash() -> None:
    s, repo, _ = _servico()
    c = s.criar("u1")
    assert len(c.token) >= 43  # 32 bytes em base64 url-safe
    _, guardado = repo.partilhas[c.partilha.id]
    assert guardado == hash_token(c.token) and guardado != c.token
    assert c.partilha.expira_em == AGORA + timedelta(days=VALIDADE_DIAS)


def test_cada_link_tem_um_token_diferente() -> None:
    s, _, _ = _servico()
    assert s.criar("u1").token != s.criar("u1").token


def test_no_maximo_5_links_activos_por_conta() -> None:
    s, _, _ = _servico()
    for _ in range(MAX_PARTILHAS_ACTIVAS):
        s.criar("u1")
    with pytest.raises(LimiteDePartilhasError):
        s.criar("u1")
    s.criar("u2")  # o limite é por conta


def test_revogar_um_link_liberta_o_lugar() -> None:
    s, _, _ = _servico()
    criados = [s.criar("u1") for _ in range(MAX_PARTILHAS_ACTIVAS)]
    s.revogar("u1", criados[0].partilha.id)
    s.criar("u1")


def test_ler_devolve_so_o_minimo_para_o_medico() -> None:
    s, _, sessoes = _servico()
    token = s.criar("u1").token
    r = s.ler(token)
    assert r.nome == "Ana"  # só o primeiro nome
    assert (r.olho_mais_fraco, r.usa_oculos) == ("esquerdo", True)
    assert len(r.sessoes) == 1
    assert sessoes.pedidos[0] == {
        "user_id": "u1", "versao": 2, "desde": AGORA - timedelta(days=JANELA_SESSOES_DIAS), "limite": 1000,
    }
    assert not hasattr(r, "email")


def test_sem_nome_nao_inventa_um() -> None:
    s, _, _ = _servico()
    assert s.ler(s.criar("u2").token).nome is None


@pytest.mark.parametrize("token", ["", "x" * 129, "um-token-que-nao-existe"])
def test_token_invalido_da_sempre_o_mesmo_erro(token: str) -> None:
    s, _, _ = _servico()
    s.criar("u1")
    with pytest.raises(LinkInvalidoError):
        s.ler(token)


def test_link_revogado_deixa_de_abrir() -> None:
    s, _, _ = _servico()
    c = s.criar("u1")
    s.revogar("u1", c.partilha.id)
    with pytest.raises(LinkInvalidoError):
        s.ler(c.token)


def test_link_expirado_deixa_de_abrir() -> None:
    s, repo, _ = _servico()
    c = s.criar("u1")
    repo.expirar(c.partilha.id)
    with pytest.raises(LinkInvalidoError):
        s.ler(c.token)


def test_conta_anonimizada_deixa_de_abrir() -> None:
    s, repo, _ = _servico()
    c = s.criar("u1")
    del repo.donos["u1"]
    with pytest.raises(LinkInvalidoError):
        s.ler(c.token)


def test_ninguem_revoga_o_link_de_outra_pessoa() -> None:
    s, repo, _ = _servico()
    c = s.criar("u1")
    with pytest.raises(PartilhaNaoEncontradaError):
        s.revogar("u2", c.partilha.id)
    assert repo.partilhas[c.partilha.id][0].revogado_em is None
