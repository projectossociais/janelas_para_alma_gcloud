"""W-03 contra Postgres real: a anonimização limpa os dados pessoais em
todas as tabelas que os copiam -- e não rebenta (bug real, 2026-09-29)."""

from datetime import UTC, datetime

from app.repositories.eliminacao_conta_repository import SQLAlchemyEliminacaoContaRepository
from app.repositories.orm_models import (
    AgendamentoClinico,
    ClinicaParceira,
    ContactMessage,
    PremiumRequest,
    Utilizador,
)


def test_anonimizar_limpa_utilizador_premium_agendamentos_e_mensagens(sessao_pg) -> None:
    s = sessao_pg
    ana = Utilizador(email="Ana@Example.com", password_hash="x", nome_completo="Ana Silva", telefone="+244900")
    outro = Utilizador(email="outro@example.com", password_hash="x")
    clinica = ClinicaParceira(nome="Clínica", email_contacto="c@ex.com", telefone_contacto="+244")
    s.add_all([ana, outro, clinica])
    s.flush()
    s.add_all(
        [
            PremiumRequest(user_id=ana.id, nome="Ana Silva", email="Ana@Example.com", telefone="+244900"),
            AgendamentoClinico(
                clinica_id=clinica.id, utilizador_id=ana.id, nome="Ana Silva",
                email="Ana@Example.com", telefone="+244900", modalidade="presencial",
            ),
            # O formulário de contacto não liga a mensagem à conta: casa-se pelo email.
            ContactMessage(nome="Ana", email="ana@example.com", mensagem="Olá"),
            ContactMessage(nome="Outro", email="outro@example.com", mensagem="Bom dia"),
        ]
    )
    s.commit()

    SQLAlchemyEliminacaoContaRepository(s).anonimizar(
        str(ana.id), datetime.now(UTC), "anon@anonimo.test", "hash-invalido", "Conta eliminada"
    )
    s.expire_all()

    u = s.get(Utilizador, ana.id)
    assert (u.email, u.nome_completo, u.telefone) == ("anon@anonimo.test", None, None)
    assert u.anonimizado_em is not None
    pr = s.query(PremiumRequest).one()
    assert (pr.nome, pr.email, pr.telefone) == ("Conta eliminada", "anon@anonimo.test", None)
    ag = s.query(AgendamentoClinico).one()
    assert (ag.nome, ag.email, ag.telefone) == ("Conta eliminada", "anon@anonimo.test", "+000000000")
    mensagens = {m.mensagem: m for m in s.query(ContactMessage).all()}
    assert (mensagens["Olá"].nome, mensagens["Olá"].email) == ("Conta eliminada", "anon@anonimo.test")
    assert (mensagens["Bom dia"].nome, mensagens["Bom dia"].email) == ("Outro", "outro@example.com")
    assert s.get(Utilizador, outro.id).email == "outro@example.com"


def test_anonimizar_duas_vezes_nao_reprocessa(sessao_pg) -> None:
    s = sessao_pg
    u = Utilizador(email="b@example.com", password_hash="x")
    s.add(u)
    s.commit()
    repo = SQLAlchemyEliminacaoContaRepository(s)
    repo.anonimizar(str(u.id), datetime.now(UTC), "anon1@x", "h1", "Conta eliminada")
    repo.anonimizar(str(u.id), datetime.now(UTC), "anon2@x", "h2", "Conta eliminada")
    s.expire_all()
    assert s.get(Utilizador, u.id).email == "anon1@x"
