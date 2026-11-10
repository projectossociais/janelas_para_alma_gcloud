"""Apoio mensal (Kamba Mensal). O que mais importa: o valor é decidido e
limitado na API, uma conta tem no máximo um apoio activo, um comprovativo
nunca é "recebido" sem ficar gravado (nem sem a confirmação por email), e o
lembrete é suave -- um por ciclo, só a quem tem o mês em falta."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from app.core.config import obter_settings
from app.core.email import EmailEnvioFalhouError
from app.repositories.apoios_mensais_repository import (
    ApoioMensalJaActivoError,
    ApoioMensalRegisto,
    DestinatarioLembreteApoio,
)
from app.services.apoio_mensal_service import (
    DIAS_POR_CICLO,
    ApoioMensalJaExisteError,
    ApoioMensalNaoEncontradoError,
    ApoioMensalService,
    ValorMensalInvalidoError,
)
from app.services.comprovativo_upload_service import ChaveDeComprovativoInvalidaError

AGORA = datetime(2026, 10, 26, 12, 0, tzinfo=UTC)


@pytest.fixture(autouse=True)
def _sem_bucket_privado(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(obter_settings(), "r2_public_base_url", "https://cdn.exemplo.test")
    monkeypatch.setattr(obter_settings(), "r2_bucket_comprovativos", "")


class RepositorioApoiosFalso:
    def __init__(self, falhar_ao_gravar: bool = False) -> None:
        self.apoios: dict[str, ApoioMensalRegisto] = {}
        self.doacoes: list[dict] = []
        self.lembretes_marcados: list[str] = []
        self.destinatarios: list[DestinatarioLembreteApoio] = []
        self.limite_pedido: datetime | None = None
        self.corrida_na_criacao = False
        self._falhar = falhar_ao_gravar

    def obter_activo(self, utilizador_id: str) -> ApoioMensalRegisto | None:
        return next(
            (a for a in self.apoios.values() if a.utilizador_id == utilizador_id and a.estado == "ativo"), None
        )

    def criar(self, utilizador_id: str, valor_mensal_kz: int) -> ApoioMensalRegisto:
        if self.corrida_na_criacao:
            raise ApoioMensalJaActivoError(utilizador_id)
        apoio = ApoioMensalRegisto(
            id=f"apoio-{len(self.apoios) + 1}",
            utilizador_id=utilizador_id,
            valor_mensal_kz=valor_mensal_kz,
            estado="ativo",
            criado_em=AGORA,
            ultimo_comprovativo_em=None,
            ultimo_lembrete_em=None,
            meses_com_comprovativo=0,
        )
        self.apoios[apoio.id] = apoio
        return apoio

    def registar_comprovativo(self, apoio_id, recibo_id, email, detalhes, comprovativo_url, momento):
        if self._falhar:
            raise RuntimeError("falha ao gravar na base de dados")
        self.doacoes.append({"apoio_id": apoio_id, "recibo_id": recibo_id, "email": email, "url": comprovativo_url})
        actual = self.apoios[apoio_id]
        novo = replace(
            actual, ultimo_comprovativo_em=momento, meses_com_comprovativo=actual.meses_com_comprovativo + 1
        )
        self.apoios[apoio_id] = novo
        return novo

    def cancelar(self, apoio_id: str, momento: datetime) -> None:
        self.apoios[apoio_id] = replace(self.apoios[apoio_id], estado="cancelado")

    def listar_para_lembrete(self, limite: datetime) -> list[DestinatarioLembreteApoio]:
        self.limite_pedido = limite
        return self.destinatarios

    def marcar_lembrete(self, apoio_id: str, momento: datetime) -> None:
        self.lembretes_marcados.append(apoio_id)


class EmailSenderFalso:
    def __init__(self, falhar_para: set[str] | None = None) -> None:
        self.enviados: list[dict] = []
        self._falhar_para = falhar_para or set()

    def enviar(self, destinatario: str, assunto: str, corpo_html: str) -> None:
        if destinatario in self._falhar_para or "*" in self._falhar_para:
            raise EmailEnvioFalhouError("falha simulada")
        self.enviados.append({"destinatario": destinatario, "assunto": assunto, "corpo_html": corpo_html})


def _servico(repo=None, email=None, agora: datetime = AGORA):
    return ApoioMensalService(repo or RepositorioApoiosFalso(), email or EmailSenderFalso(), relogio=lambda: agora)


class TestAderir:
    def test_adere_com_um_valor_valido(self) -> None:
        estado = _servico().aderir("u1", 15_000)
        assert estado.valor_mensal_kz == 15_000
        assert estado.estado == "ativo"
        assert estado.meses_com_comprovativo == 0
        assert estado.renovacao_em_falta is False

    @pytest.mark.parametrize("valor", [0, 999, 10_000_001])
    def test_recusa_valores_fora_dos_limites(self, valor: int) -> None:
        with pytest.raises(ValorMensalInvalidoError):
            _servico().aderir("u1", valor)

    def test_uma_conta_so_tem_um_apoio_activo(self) -> None:
        repo = RepositorioApoiosFalso()
        svc = _servico(repo)
        svc.aderir("u1", 5_000)
        with pytest.raises(ApoioMensalJaExisteError):
            svc.aderir("u1", 30_000)

    def test_pedido_em_simultaneo_recusado_pela_base_de_dados_vira_erro_de_dominio(self) -> None:
        repo = RepositorioApoiosFalso()
        repo.corrida_na_criacao = True
        with pytest.raises(ApoioMensalJaExisteError):
            _servico(repo).aderir("u1", 5_000)

    def test_depois_de_cancelar_pode_voltar_a_aderir(self) -> None:
        repo = RepositorioApoiosFalso()
        svc = _servico(repo)
        svc.aderir("u1", 5_000)
        svc.cancelar("u1")
        assert svc.obter("u1") is None
        assert svc.aderir("u1", 15_000).valor_mensal_kz == 15_000


class TestComprovativo:
    def test_regista_a_doacao_do_mes_e_conta_o_mes(self) -> None:
        repo = RepositorioApoiosFalso()
        email = EmailSenderFalso()
        svc = _servico(repo, email)
        svc.aderir("u1", 15_000)

        estado = svc.registar_comprovativo("u1", "ana@example.com", "comprovativos/abc.pdf")

        assert estado.meses_com_comprovativo == 1
        assert estado.ultimo_comprovativo_em == AGORA
        assert repo.doacoes[0]["recibo_id"].startswith("MEN-")
        assert repo.doacoes[0]["email"] == "ana@example.com"
        assert email.enviados[0]["destinatario"] == "ana@example.com"

    def test_sem_apoio_activo_recusa(self) -> None:
        with pytest.raises(ApoioMensalNaoEncontradoError):
            _servico().registar_comprovativo("u1", "ana@example.com", "comprovativos/abc.pdf")

    def test_recusa_chave_fora_do_prefixo_dos_comprovativos(self) -> None:
        svc = _servico()
        svc.aderir("u1", 15_000)
        with pytest.raises(ChaveDeComprovativoInvalidaError):
            svc.registar_comprovativo("u1", "ana@example.com", "avatares/outro/foto.png")

    def test_nunca_engole_uma_falha_de_gravacao(self) -> None:
        repo = RepositorioApoiosFalso(falhar_ao_gravar=True)
        email = EmailSenderFalso()
        svc = _servico(repo, email)
        svc.aderir("u1", 15_000)
        with pytest.raises(RuntimeError):
            svc.registar_comprovativo("u1", "ana@example.com", "comprovativos/abc.pdf")
        assert email.enviados == []

    def test_nunca_engole_uma_falha_de_envio_da_confirmacao(self) -> None:
        svc = _servico(email=EmailSenderFalso(falhar_para={"*"}))
        svc.aderir("u1", 15_000)
        with pytest.raises(EmailEnvioFalhouError):
            svc.registar_comprovativo("u1", "ana@example.com", "comprovativos/abc.pdf")


class TestRenovacaoEmFalta:
    def test_em_falta_um_ciclo_depois_da_adesao_sem_comprovativo(self) -> None:
        repo = RepositorioApoiosFalso()
        _servico(repo).aderir("u1", 5_000)
        depois = _servico(repo, agora=AGORA + timedelta(days=DIAS_POR_CICLO))
        assert depois.obter("u1").renovacao_em_falta is True

    def test_um_comprovativo_recente_poe_o_mes_em_dia(self) -> None:
        repo = RepositorioApoiosFalso()
        _servico(repo).aderir("u1", 5_000)
        mais_tarde = AGORA + timedelta(days=40)
        _servico(repo, agora=mais_tarde).registar_comprovativo("u1", "a@example.com", "comprovativos/x.pdf")
        assert _servico(repo, agora=mais_tarde + timedelta(days=10)).obter("u1").renovacao_em_falta is False


class TestLembretes:
    def test_pede_ao_repositorio_quem_esta_um_ciclo_sem_comprovativo(self) -> None:
        repo = RepositorioApoiosFalso()
        _servico(repo).enviar_lembretes()
        assert repo.limite_pedido == AGORA - timedelta(days=DIAS_POR_CICLO)

    def test_envia_e_marca_so_quem_recebeu(self) -> None:
        repo = RepositorioApoiosFalso()
        repo.destinatarios = [
            DestinatarioLembreteApoio("a1", "a@example.com", "Ana Maria", 15_000),
            DestinatarioLembreteApoio("a2", "b@example.com", None, 5_000),
        ]
        email = EmailSenderFalso(falhar_para={"b@example.com"})

        r = _servico(repo, email).enviar_lembretes()

        assert (r.enviados, r.falhados) == (1, 1)
        assert repo.lembretes_marcados == ["a1"]
        assert "Olá, Ana!" in email.enviados[0]["corpo_html"]
        assert "15.000 Kz" in email.enviados[0]["corpo_html"]

    def test_o_nome_e_escapado_no_email(self) -> None:
        repo = RepositorioApoiosFalso()
        repo.destinatarios = [DestinatarioLembreteApoio("a1", "a@example.com", "<script>x</script>", 5_000)]
        email = EmailSenderFalso()
        _servico(repo, email).enviar_lembretes()
        assert "<script>" not in email.enviados[0]["corpo_html"]
