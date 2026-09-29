"""Testes contra um Postgres real, num schema descartável.

No CI (`.github/workflows/ci.yml`) o job `api` já tem um Postgres e
`DATABASE_URL`; cada teste cria um schema próprio com `create_all` e apaga-o
no fim, para nunca tocar no `public` onde o `alembic upgrade head` corre a
seguir. Sem Postgres acessível (ex.: localmente sem Docker), estes testes
saltam -- os unitários com repositórios falsos continuam a correr.

Porquê: os repositórios são testados com falsos (CLAUDE.md §7), e um falso não
apanha um erro de SQL/ORM. Foi assim que a anonimização do W-03 chegou a
produção a rebentar em `ContactMessage.user_id` (coluna que não existe).
"""

import os
import uuid

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

import app.repositories.orm_models  # noqa: F401 -- regista os modelos no metadata
from app.db import Base


@pytest.fixture
def sessao_pg():
    url = os.environ.get("DATABASE_URL", "")
    if not url.startswith("postgresql"):
        pytest.skip("sem DATABASE_URL de Postgres")
    admin = create_engine(url)
    try:
        with admin.connect() as c:
            c.execute(text("select 1"))
    except OperationalError:
        admin.dispose()
        pytest.skip("Postgres indisponível")
    schema = f"teste_{uuid.uuid4().hex[:12]}"
    with admin.begin() as c:
        c.execute(text(f'CREATE SCHEMA "{schema}"'))
    motor = create_engine(url, connect_args={"options": f"-csearch_path={schema}"})
    try:
        Base.metadata.create_all(motor)
        with Session(motor) as s:
            yield s
    finally:
        motor.dispose()
        with admin.begin() as c:
            c.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()
