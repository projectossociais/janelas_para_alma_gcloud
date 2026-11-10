"""Apoio mensal, gostos e visualizações contra Postgres real (2026-10-26):
o índice único parcial, a transacção do comprovativo, a consulta dos
lembretes e os contadores atómicos -- o que um repositório falso não apanha."""

from datetime import UTC, datetime, timedelta

import pytest

from app.repositories.apoios_mensais_repository import (
    ApoioMensalJaActivoError,
    SQLAlchemyApoiosMensaisRepository,
)
from app.repositories.impacto_repository import SQLAlchemyImpactoRepository
from app.repositories.orm_models import ApoioMensal, Doacao, Publicacao, Screening, Utilizador
from app.repositories.publicacoes_repository import SQLAlchemyPublicacoesRepository

AGORA = datetime(2026, 10, 26, 12, 0, tzinfo=UTC)


def _utilizador(s, nome: str, **kw) -> Utilizador:
    base = {"email": f"{nome}@ex.com", "password_hash": "x", "nome_completo": nome, "email_confirmado": True}
    base.update(kw)
    u = Utilizador(**base)
    s.add(u)
    s.flush()
    return u


def test_um_so_apoio_activo_e_o_comprovativo_grava_doacao_e_data(sessao_pg) -> None:
    s = sessao_pg
    ana = _utilizador(s, "ana")
    s.commit()
    repo = SQLAlchemyApoiosMensaisRepository(s)

    apoio = repo.criar(str(ana.id), 15_000)
    with pytest.raises(ApoioMensalJaActivoError):
        repo.criar(str(ana.id), 5_000)

    actualizado = repo.registar_comprovativo(
        apoio.id, "MEN-1", "ana@ex.com", "Apoio mensal", "comprovativos/a.pdf", AGORA
    )
    assert actualizado.meses_com_comprovativo == 1
    assert actualizado.ultimo_comprovativo_em == AGORA
    assert s.query(Doacao).filter(Doacao.apoio_mensal_id.isnot(None)).count() == 1

    repo.cancelar(apoio.id, AGORA)
    assert repo.obter_activo(str(ana.id)) is None
    # Cancelado, pode voltar a aderir.
    assert repo.criar(str(ana.id), 5_000).estado == "ativo"


def test_lembrete_so_a_quem_esta_um_ciclo_sem_comprovativo_e_sem_lembrete_recente(sessao_pg) -> None:
    s = sessao_pg
    limite = AGORA - timedelta(days=30)
    casos = {
        "em_falta": {"criado_em": AGORA - timedelta(days=45)},
        "comprovativo_recente": {"criado_em": AGORA - timedelta(days=90), "ultimo_comprovativo_em": AGORA - timedelta(days=3)},
        "aderiu_agora": {"criado_em": AGORA - timedelta(days=2)},
        "ja_lembrado": {"criado_em": AGORA - timedelta(days=45), "ultimo_lembrete_em": AGORA - timedelta(days=5)},
        "lembrado_ha_muito": {"criado_em": AGORA - timedelta(days=90), "ultimo_lembrete_em": AGORA - timedelta(days=40)},
        "cancelado": {"criado_em": AGORA - timedelta(days=45), "estado": "cancelado"},
    }
    for nome, campos in casos.items():
        u = _utilizador(s, nome)
        s.add(ApoioMensal(utilizador_id=u.id, valor_mensal_kz=5_000, **campos))
    anonimo = _utilizador(s, "anonimizado", anonimizado_em=AGORA - timedelta(days=1))
    s.add(ApoioMensal(utilizador_id=anonimo.id, valor_mensal_kz=5_000, criado_em=AGORA - timedelta(days=45)))
    s.commit()

    destinatarios = SQLAlchemyApoiosMensaisRepository(s).listar_para_lembrete(limite)

    assert sorted(d.nome for d in destinatarios) == ["em_falta", "lembrado_ha_muito"]


def test_visualizacoes_e_gostos(sessao_pg) -> None:
    s = sessao_pg
    ana, bruno = _utilizador(s, "ana"), _utilizador(s, "bruno")
    pub = Publicacao(slug="accao", titulo="Acção", resumo="r", corpo="c", estado="publicada")
    s.add(pub)
    s.commit()
    repo = SQLAlchemyPublicacoesRepository(s)
    pid = str(pub.id)

    assert repo.incrementar_visualizacoes(pid) == 1
    assert repo.incrementar_visualizacoes(pid) == 2

    repo.adicionar_gosto(pid, str(ana.id))
    repo.adicionar_gosto(pid, str(ana.id))  # repetido: não conta
    repo.adicionar_gosto(pid, str(bruno.id))
    assert repo.contar_gostos(pid) == 2
    assert repo.gostou(pid, str(ana.id)) is True
    repo.remover_gosto(pid, str(ana.id))
    assert repo.gostou(pid, str(ana.id)) is False

    registo = repo.obter_por_slug("accao")
    assert (registo.visualizacoes, registo.gostos) == (2, 1)


def test_numeros_de_impacto(sessao_pg) -> None:
    s = sessao_pg
    u = _utilizador(s, "ana")
    for diagnostico in ("normal", "requer_avaliacao", "inconclusivo"):
        s.add(
            Screening(
                user_id=u.id,
                estado="concluido",
                rosto_detetado=True,
                requer_avaliacao_humana=False,
                diagnostico=diagnostico,
            )
        )
    s.commit()

    numeros = SQLAlchemyImpactoRepository(s).obter_numeros()

    assert (numeros.rastreios, numeros.sessoes_treino, numeros.encaminhamentos) == (3, 0, 1)
