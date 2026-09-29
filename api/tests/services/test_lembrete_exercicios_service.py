from datetime import UTC, datetime, timedelta

from app.core.email import EmailEnvioFalhouError
from app.core.fuso import inicio_do_dia_em_luanda
from app.repositories.lembrete_exercicios_repository import DestinatarioLembrete
from app.services.acesso_exercicios_service import IDS_TREINOS
from app.services.lembrete_exercicios_service import (
    JANELA_HABITO_DIAS,
    LembreteExerciciosService,
)


class RepositorioFalso:
    def __init__(self, destinatarios: list[DestinatarioLembrete]) -> None:
        self._destinatarios = destinatarios
        self.chamadas: list[dict] = []

    def listar_destinatarios(self, agora, inicio_hoje, treinou_desde, ids_treinos):
        self.chamadas.append(
            {"agora": agora, "inicio_hoje": inicio_hoje, "treinou_desde": treinou_desde, "ids_treinos": ids_treinos}
        )
        return list(self._destinatarios)


class EmailSenderFalso:
    def __init__(self, falhar_para: set[str] | None = None) -> None:
        self.enviados: list[dict] = []
        self._falhar_para = falhar_para or set()

    def enviar(self, destinatario: str, assunto: str, corpo_html: str) -> None:
        if destinatario in self._falhar_para:
            raise EmailEnvioFalhouError("falha simulada")
        self.enviados.append({"destinatario": destinatario, "assunto": assunto, "corpo_html": corpo_html})


AGORA = datetime(2026, 9, 29, 17, 0, tzinfo=UTC)  # 18:00 em Luanda


def _d(n: int, nome: str | None = "Ana Silva") -> DestinatarioLembrete:
    return DestinatarioLembrete(id=f"u{n}", email=f"u{n}@example.com", nome=nome)


def test_meia_noite_de_luanda_e_23h_utc_do_dia_anterior() -> None:
    assert inicio_do_dia_em_luanda(AGORA) == datetime(2026, 9, 28, 23, 0, tzinfo=UTC)
    # 23:30 UTC já é o dia seguinte em Luanda (00:30)
    assert inicio_do_dia_em_luanda(datetime(2026, 9, 29, 23, 30, tzinfo=UTC)) == datetime(2026, 9, 29, 23, 0, tzinfo=UTC)


def test_pede_ao_repositorio_a_janela_certa_e_so_os_treinos() -> None:
    repo = RepositorioFalso([])
    LembreteExerciciosService(repo, EmailSenderFalso(), relogio=lambda: AGORA).enviar_lembretes()
    chamada = repo.chamadas[0]
    assert chamada["inicio_hoje"] == datetime(2026, 9, 28, 23, 0, tzinfo=UTC)
    assert chamada["treinou_desde"] == chamada["inicio_hoje"] - timedelta(days=JANELA_HABITO_DIAS)
    assert set(chamada["ids_treinos"]) == set(IDS_TREINOS)
    # testes de triagem não contam como treino de hoje
    assert "figure8" not in chamada["ids_treinos"]


def test_envia_a_cada_destinatario_com_link_para_treinar_e_para_desligar() -> None:
    sender = EmailSenderFalso()
    r = LembreteExerciciosService(RepositorioFalso([_d(1), _d(2)]), sender, relogio=lambda: AGORA).enviar_lembretes()
    assert (r.enviados, r.falhados) == (2, 0)
    assert [e["destinatario"] for e in sender.enviados] == ["u1@example.com", "u2@example.com"]
    corpo = sender.enviados[0]["corpo_html"]
    assert "Olá, Ana!" in corpo
    assert "/exercicios" in corpo and "/configuracoes" in corpo
    assert "não o substituem" in corpo


def test_escapa_o_nome_escrito_pelo_utilizador() -> None:
    sender = EmailSenderFalso()
    malicioso = _d(1, nome='<img src=x onerror="alert(1)"> Silva')
    LembreteExerciciosService(RepositorioFalso([malicioso]), sender, relogio=lambda: AGORA).enviar_lembretes()
    corpo = sender.enviados[0]["corpo_html"]
    assert "<img" not in corpo
    assert "&lt;img" in corpo


def test_sem_nome_usa_uma_saudacao_neutra() -> None:
    sender = EmailSenderFalso()
    LembreteExerciciosService(RepositorioFalso([_d(1, nome=None), _d(2, nome="   ")]), sender, relogio=lambda: AGORA).enviar_lembretes()
    assert all("<p>Olá!</p>" in e["corpo_html"] for e in sender.enviados)


def test_uma_falha_de_envio_nao_impede_os_outros_e_e_contada() -> None:
    sender = EmailSenderFalso(falhar_para={"u2@example.com"})
    r = LembreteExerciciosService(RepositorioFalso([_d(1), _d(2), _d(3)]), sender, relogio=lambda: AGORA).enviar_lembretes()
    assert (r.enviados, r.falhados) == (2, 1)
    assert [e["destinatario"] for e in sender.enviados] == ["u1@example.com", "u3@example.com"]
