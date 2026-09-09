"""Engine e sessão do SQLAlchemy — Postgres próprio (Cloud SQL em produção,
container em desenvolvimento). Ver infra/docker/api.Dockerfile e
docker-compose.yml.
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import obter_settings


class Base(DeclarativeBase):
    pass


_settings = obter_settings()
engine = create_engine(_settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def obter_sessao() -> Generator[Session, None, None]:
    """Dependency do FastAPI: uma sessão por pedido, sempre fechada no fim."""
    sessao = SessionLocal()
    try:
        yield sessao
    finally:
        sessao.close()
