"""A trava do script de dados de teste: nunca correr fora da base local."""

from scripts.dados_teste_locais import e_base_local


def test_aceita_as_bases_locais() -> None:
    assert e_base_local("postgresql+psycopg://jpa:jpa@db:5432/jpa")
    assert e_base_local("postgresql+psycopg://jpa:jpa@localhost:5432/jpa")


def test_recusa_qualquer_outra_base() -> None:
    assert not e_base_local("postgresql+psycopg://u:p@10.20.30.40:5432/jpa")
    assert not e_base_local("postgresql+psycopg://u:p@/jpa?host=/cloudsql/projecto:europe-west1:jpa")
