"""Quem recebe o lembrete diário de treino, contra Postgres real (#123)."""

from datetime import UTC, datetime, timedelta

from app.repositories.lembrete_exercicios_repository import SQLAlchemyLembreteExerciciosRepository
from app.repositories.orm_models import AppRole, SessaoExercicio, Utilizador
from app.services.lembrete_exercicios_service import (
    IDS_TREINOS,
    JANELA_HABITO_DIAS,
    inicio_do_dia_em_luanda,
)

AGORA = datetime(2026, 9, 29, 17, 0, tzinfo=UTC)


def test_so_recebe_quem_tem_acesso_treinou_recentemente_e_ainda_nao_hoje(sessao_pg) -> None:
    s = sessao_pg
    inicio_hoje = inicio_do_dia_em_luanda(AGORA)
    ontem = inicio_hoje - timedelta(hours=5)

    def u(nome, **kw):
        base = {
            "email": f"{nome}@ex.com", "password_hash": "x", "nome_completo": nome, "notificacoes_lembretes": True,
            "email_confirmado": True, "premium_ativo": True, "premium_expira_em": AGORA + timedelta(days=10),
        }
        base.update(kw)
        return Utilizador(**base)

    casos = {
        "deve_receber": (u("deve_receber"), [("ambliopia", ontem)]),
        "trial_activo": (
            u("trial_activo", premium_ativo=False, premium_expira_em=None,
              trial_iniciado_em=AGORA - timedelta(days=2), trial_termina_em=AGORA + timedelta(days=5)),
            [("convergence", ontem)],
        ),
        "so_fez_teste_hoje": (u("so_fez_teste_hoje"), [("ambliopia", ontem), ("figure8", inicio_hoje + timedelta(hours=2))]),
        "ja_treinou_hoje": (u("ja_treinou_hoje"), [("ambliopia", ontem), ("ambliopia", inicio_hoje + timedelta(hours=1))]),
        "lembretes_desligados": (u("lembretes_desligados", notificacoes_lembretes=False), [("ambliopia", ontem)]),
        "email_por_confirmar": (u("email_por_confirmar", email_confirmado=False), [("ambliopia", ontem)]),
        "anonimizado": (u("anonimizado", anonimizado_em=AGORA - timedelta(days=1)), [("ambliopia", ontem)]),
        "admin": (u("admin", papel=AppRole.admin), [("ambliopia", ontem)]),
        "premium_expirado": (u("premium_expirado", premium_expira_em=AGORA - timedelta(days=1)), [("ambliopia", ontem)]),
        "parou_ha_muito": (u("parou_ha_muito"), [("ambliopia", inicio_hoje - timedelta(days=JANELA_HABITO_DIAS + 1))]),
        "nunca_treinou": (u("nunca_treinou"), [("figure8", ontem)]),
    }
    for util, sessoes in casos.values():
        s.add(util)
        s.flush()
        for ex, quando in sessoes:
            s.add(SessaoExercicio(user_id=util.id, exercicio_id=ex, duracao_segundos=60, created_at=quando, versao=2))
    s.commit()

    destinatarios = SQLAlchemyLembreteExerciciosRepository(s).listar_destinatarios(
        AGORA, inicio_hoje, inicio_hoje - timedelta(days=JANELA_HABITO_DIAS), IDS_TREINOS
    )
    assert sorted(d.nome for d in destinatarios) == ["deve_receber", "so_fez_teste_hoje", "trial_activo"]
