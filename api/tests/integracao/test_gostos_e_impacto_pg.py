"""Gostos, visualizações e números de impacto contra Postgres real: a chave
composta do gosto e os contadores atómicos -- o que um repositório falso
não apanha."""

from app.repositories.impacto_repository import SQLAlchemyImpactoRepository
from app.repositories.orm_models import Publicacao, Screening, Utilizador
from app.repositories.publicacoes_repository import SQLAlchemyPublicacoesRepository


def _utilizador(s, nome: str, **kw) -> Utilizador:
    base = {"email": f"{nome}@ex.com", "password_hash": "x", "nome_completo": nome, "email_confirmado": True}
    base.update(kw)
    u = Utilizador(**base)
    s.add(u)
    s.flush()
    return u


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
