from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import obter_auth_service
from app.core.security import criar_access_token, hash_password
from app.main import app
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.routers import jogo_online as rota
from app.services.auth_service import AuthService
from app.services.sala_jogo_service import (
    BONUS_VITORIA,
    MOEDAS_POR_ACERTO,
    RONDAS,
    TEMPO_DE_REVELACAO,
    SalaJogoService,
)
from tests.services.test_auth_service import RepositorioFalso as RepositorioAuthFalso
from tests.services.test_sala_jogo_service import (
    NotificadorFalso,
    Relogio,
    RepositorioPerguntasFalso,
    RepositorioSalasFalso,
)


@dataclass
class PerfilFalso:
    data_nascimento: date | None
    faixa_etaria: str | None = None


class RepositorioPerfisFalso:
    def __init__(self) -> None:
        self.perfis: dict[str, PerfilFalso] = {}

    def obter(self, utilizador_id: str):
        return self.perfis.get(utilizador_id)


class Ambiente:
    def __init__(self) -> None:
        self.auth = RepositorioAuthFalso()
        self.perfis = RepositorioPerfisFalso()
        self.salas = RepositorioSalasFalso()
        self.notificador = NotificadorFalso()
        self.relogio = Relogio()
        codigos = iter(f"SALA{i:02d}" for i in range(1, 99))
        self.servico = SalaJogoService(
            self.salas, RepositorioPerguntasFalso(), self.notificador, self.relogio, lambda: next(codigos)
        )
        self.tokens: dict[str, str] = {}
        self.conta("ana", "Ana Maria Santos", date(1990, 1, 1))
        self.conta("rui", "Rui Costa", date(1985, 6, 1))
        self.conta("ze", "Zé", date(1980, 1, 1))
        self.conta("miudo", "Kiala Neto", date(2014, 3, 3))
        self.conta("sem-data", None, None)
        self.cliente: TestClient | None = None

    def conta(self, id_: str, nome: str | None, nascimento: date | None, faixa: str | None = None) -> None:
        self.auth._utilizadores[f"{id_}@example.com"] = UtilizadorRegisto(
            id=id_,
            email=f"{id_}@example.com",
            password_hash=hash_password("password-forte-123"),
            papel="comum",
            nome_completo=nome,
            provincia=None,
            genero=None,
            criado_em=datetime.now(UTC),
        )
        self.perfis.perfis[id_] = PerfilFalso(nascimento, faixa)
        self.tokens[id_] = criar_access_token(id_)

    def como(self, id_: str) -> TestClient:
        assert self.cliente is not None
        self.cliente.cookies.set("access_token", self.tokens[id_])
        return self.cliente

    def sala_a_dois(self, a: str = "ana", b: str = "rui") -> str:
        codigo = self.como(a).post("/jogo/salas").json()["codigo"]
        assert self.como(b).post(f"/jogo/salas/{codigo}/entrar").status_code == 200
        return codigo

    def em_jogo(self, a: str = "ana", b: str = "rui") -> str:
        codigo = self.sala_a_dois(a, b)
        assert self.como(a).post(f"/jogo/salas/{codigo}/comecar").status_code == 200
        return codigo


@pytest.fixture
def amb():
    ambiente = Ambiente()
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(ambiente.auth)
    app.dependency_overrides[rota.obter_sala_jogo_service] = lambda: ambiente.servico
    app.dependency_overrides[rota.obter_perfil_repository] = lambda: ambiente.perfis
    with TestClient(app) as cliente:
        ambiente.cliente = cliente
        yield ambiente
    app.dependency_overrides.clear()


@pytest.mark.parametrize(
    ("metodo", "caminho"),
    [
        ("post", "/jogo/salas"),
        ("post", "/jogo/salas/SALA01/entrar"),
        ("post", "/jogo/salas/SALA01/comecar"),
        ("get", "/jogo/salas/SALA01"),
        ("post", "/jogo/salas/SALA01/responder"),
        ("post", "/jogo/salas/SALA01/sair"),
        ("post", "/jogo/salas/SALA01/mensagens"),
        ("post", "/jogo/salas/SALA01/denunciar"),
    ],
)
def test_tudo_exige_sessao(amb, metodo, caminho) -> None:
    assert getattr(amb.cliente, metodo)(caminho).status_code == 401


def test_criar_devolve_o_codigo_e_so_o_primeiro_nome(amb) -> None:
    resposta = amb.como("ana").post("/jogo/salas")

    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["codigo"] == "SALA01"
    assert corpo["estado"] == "a_aguardar"
    assert corpo["sou_anfitriao"] is True
    assert [(j["nome"], j["eu"], j["anfitriao"]) for j in corpo["jogadores"]] == [("Ana", True, True)]
    assert "Santos" not in resposta.text and "example.com" not in resposta.text


def test_entrar_sala_cheia_inexistente_e_ja_comecada(amb) -> None:
    codigo = amb.sala_a_dois()

    cheia = amb.como("ze").post(f"/jogo/salas/{codigo}/entrar")
    assert (cheia.status_code, cheia.json()["detail"]) == (409, "sala_cheia")
    assert amb.como("ze").post("/jogo/salas/NAOHA1/entrar").status_code == 404

    amb.como("ana").post(f"/jogo/salas/{codigo}/comecar")
    comecada = amb.como("ze").post(f"/jogo/salas/{codigo}/entrar")
    assert (comecada.status_code, comecada.json()["detail"]) == (409, "sala_ja_comecou")


def test_so_o_anfitriao_comeca_e_so_com_dois(amb) -> None:
    codigo = amb.como("ana").post("/jogo/salas").json()["codigo"]
    assert amb.como("ana").post(f"/jogo/salas/{codigo}/comecar").status_code == 409
    amb.como("rui").post(f"/jogo/salas/{codigo}/entrar")
    assert amb.como("rui").post(f"/jogo/salas/{codigo}/comecar").status_code == 403


def test_quem_nao_esta_na_sala_recebe_404_em_tudo(amb) -> None:
    codigo = amb.em_jogo()
    ze = amb.como("ze")

    assert ze.get(f"/jogo/salas/{codigo}").status_code == 404
    assert ze.post(f"/jogo/salas/{codigo}/comecar").status_code == 404
    assert ze.post(f"/jogo/salas/{codigo}/responder", json={"pergunta_id": "p1-0", "resposta": "B"}).status_code == 404
    assert ze.post(f"/jogo/salas/{codigo}/mensagens", json={"texto": "olá"}).status_code == 404
    assert ze.post(f"/jogo/salas/{codigo}/denunciar").status_code == 404
    # Sair de uma sala onde não se está não faz nada (nem derruba a partida).
    assert ze.post(f"/jogo/salas/{codigo}/sair").status_code == 204
    assert amb.como("ana").get(f"/jogo/salas/{codigo}").json()["estado"] == "em_curso"


def test_durante_a_pergunta_nao_sai_a_resposta_certa_nem_a_do_adversario(amb) -> None:
    codigo = amb.em_jogo()
    estado = amb.como("ana").get(f"/jogo/salas/{codigo}")
    assert estado.headers["cache-control"] == "no-store"
    pergunta = estado.json()["pergunta"]
    assert set(pergunta) == {"id", "texto_pergunta", "opcao_a", "opcao_b", "opcao_c", "opcao_d"}
    assert estado.json()["segundos_restantes"] == 30

    amb.como("rui").post(f"/jogo/salas/{codigo}/responder", json={"pergunta_id": pergunta["id"], "resposta": "B"})
    visto_pela_ana = amb.como("ana").get(f"/jogo/salas/{codigo}").json()

    rui = next(j for j in visto_pela_ana["jogadores"] if not j["eu"])
    assert rui["respondeu"] is True
    assert (rui["resposta"], rui["certa"], rui["pontos_ronda"]) == (None, None, None)
    assert rui["pontos"] == 0
    assert visto_pela_ana["revelacao"] is None
    assert visto_pela_ana["minha_resposta"] is None
    assert "resposta_correta" not in str(visto_pela_ana["pergunta"])


def test_com_as_duas_respostas_a_ronda_revela_se_aos_dois(amb) -> None:
    codigo = amb.em_jogo()
    pergunta = amb.como("ana").get(f"/jogo/salas/{codigo}").json()["pergunta"]["id"]
    amb.como("rui").post(f"/jogo/salas/{codigo}/responder", json={"pergunta_id": pergunta, "resposta": "C"})

    corpo = amb.como("ana").post(
        f"/jogo/salas/{codigo}/responder", json={"pergunta_id": pergunta, "resposta": "B"}
    ).json()

    assert corpo["fase"] == "revelacao"
    assert corpo["revelacao"] == {"resposta_correta": "B", "explicacao": "porque sim"}
    eu, rui = corpo["jogadores"]
    assert (eu["resposta"], eu["certa"]) == ("B", True)
    assert (rui["resposta"], rui["certa"], rui["pontos_ronda"]) == ("C", False, 0)
    assert corpo["segundos_restantes"] is None
    assert corpo["segundos_ate_proxima"] == 6


def test_responder_duas_vezes_ou_com_opcao_invalida(amb) -> None:
    codigo = amb.em_jogo()
    pergunta = amb.como("ana").get(f"/jogo/salas/{codigo}").json()["pergunta"]["id"]
    corpo = {"pergunta_id": pergunta, "resposta": "A"}

    assert amb.como("ana").post(f"/jogo/salas/{codigo}/responder", json=corpo).status_code == 200
    repetida = amb.como("ana").post(f"/jogo/salas/{codigo}/responder", json=corpo)
    assert (repetida.status_code, repetida.json()["detail"]) == (409, "ronda_fechada")
    invalida = amb.como("rui").post(
        f"/jogo/salas/{codigo}/responder", json={"pergunta_id": pergunta, "resposta": "E"}
    )
    assert invalida.status_code == 422


def test_partida_completa_cada_um_ve_o_seu_premio(amb) -> None:
    codigo = amb.em_jogo()
    for _ in range(RONDAS):
        pergunta = amb.como("ana").get(f"/jogo/salas/{codigo}").json()["pergunta"]["id"]
        amb.como("ana").post(f"/jogo/salas/{codigo}/responder", json={"pergunta_id": pergunta, "resposta": "B"})
        amb.como("rui").post(f"/jogo/salas/{codigo}/responder", json={"pergunta_id": pergunta, "resposta": "A"})
        amb.relogio.agora += TEMPO_DE_REVELACAO + timedelta(seconds=1)
        amb.como("ana").get(f"/jogo/salas/{codigo}")

    ana = amb.como("ana").get(f"/jogo/salas/{codigo}").json()
    rui = amb.como("rui").get(f"/jogo/salas/{codigo}").json()

    assert (ana["estado"], ana["motivo_fim"]) == ("terminada", "completa")
    assert ana["premio"] == {
        "moedas_ganhas": RONDAS * MOEDAS_POR_ACERTO + BONUS_VITORIA,
        "limite_diario_atingido": False,
    }
    assert rui["premio"] == {"moedas_ganhas": 0, "limite_diario_atingido": False}
    assert [j["vencedor"] for j in rui["jogadores"]] == [True, False]
    assert ana["pergunta"] is None


def test_sair_a_meio_da_a_vitoria_ao_outro(amb) -> None:
    codigo = amb.em_jogo()

    assert amb.como("rui").post(f"/jogo/salas/{codigo}/sair").status_code == 204

    corpo = amb.como("ana").get(f"/jogo/salas/{codigo}").json()
    assert (corpo["estado"], corpo["motivo_fim"]) == ("terminada", "desistencia")
    assert next(j for j in corpo["jogadores"] if j["eu"])["vencedor"] is True


# --- Chat: só entre adultos ----------------------------------------------------


def test_chat_entre_dois_adultos(amb) -> None:
    codigo = amb.sala_a_dois()

    enviada = amb.como("ana").post(f"/jogo/salas/{codigo}/mensagens", json={"texto": "Boa sorte!"})
    visto_pelo_rui = amb.como("rui").get(f"/jogo/salas/{codigo}").json()["chat"]

    assert enviada.status_code == 200
    assert visto_pelo_rui["disponivel"] is True
    assert visto_pelo_rui["mensagens"] == [{"id": "m1", "minha": False, "nome": "Ana", "texto": "Boa sorte!"}]


@pytest.mark.parametrize("outro", ["miudo", "sem-data"])
def test_sem_os_dois_adultos_nao_ha_chat_para_ninguem(amb, outro) -> None:
    codigo = amb.sala_a_dois("ana", outro)

    chat_da_ana = amb.como("ana").get(f"/jogo/salas/{codigo}").json()["chat"]
    chat_do_outro = amb.como(outro).get(f"/jogo/salas/{codigo}").json()["chat"]
    assert (chat_da_ana["disponivel"], chat_da_ana["motivo"], chat_da_ana["eu_adulto"]) == (False, "so_adultos", True)
    assert (chat_do_outro["disponivel"], chat_do_outro["eu_adulto"]) == (False, False)

    for quem in ("ana", outro):
        recusada = amb.como(quem).post(f"/jogo/salas/{codigo}/mensagens", json={"texto": "olá"})
        assert (recusada.status_code, recusada.json()["detail"]) == (403, "chat_indisponivel:so_adultos")


def test_conta_de_adulto_usada_por_uma_crianca_nao_tem_chat(amb) -> None:
    amb.conta("mae", "Marta", date(1988, 1, 1), faixa="6_12")
    codigo = amb.sala_a_dois("ana", "mae")

    assert amb.como("mae").get(f"/jogo/salas/{codigo}").json()["chat"]["eu_adulto"] is False
    assert amb.como("ana").post(f"/jogo/salas/{codigo}/mensagens", json={"texto": "olá"}).status_code == 403


@pytest.mark.parametrize(
    ("texto", "motivo"),
    [("vai-te foder", "linguagem"), ("liga 923 456 789", "contacto"), ("em que escola andas?", "dados_pessoais")],
)
def test_o_filtro_recusa_com_o_motivo(amb, texto, motivo) -> None:
    codigo = amb.sala_a_dois()

    recusada = amb.como("ana").post(f"/jogo/salas/{codigo}/mensagens", json={"texto": texto})

    assert (recusada.status_code, recusada.json()["detail"]) == (422, f"mensagem_recusada:{motivo}")
    assert amb.como("rui").get(f"/jogo/salas/{codigo}").json()["chat"]["mensagens"] == []


def test_mensagens_seguidas_depressa_demais_devolvem_429(amb) -> None:
    codigo = amb.sala_a_dois()
    amb.como("ana").post(f"/jogo/salas/{codigo}/mensagens", json={"texto": "olá"})
    assert amb.como("ana").post(f"/jogo/salas/{codigo}/mensagens", json={"texto": "olá?"}).status_code == 429


def test_denuncia_fecha_o_chat_e_avisa_os_admins(amb) -> None:
    codigo = amb.sala_a_dois()
    amb.como("rui").post(f"/jogo/salas/{codigo}/mensagens", json={"texto": "olá"})

    denunciada = amb.como("ana").post(f"/jogo/salas/{codigo}/denunciar")

    assert denunciada.status_code == 200
    assert denunciada.json()["chat"] == {
        "disponivel": False,
        "motivo": "denunciado",
        "eu_adulto": True,
        "mensagens": [],
    }
    assert amb.como("rui").post(f"/jogo/salas/{codigo}/mensagens", json={"texto": "então?"}).status_code == 403
    assert len(amb.notificador.avisos) == 1
