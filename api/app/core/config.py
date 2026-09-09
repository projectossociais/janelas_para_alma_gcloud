"""Configuração da API — lida de variáveis de ambiente.

Nunca colocar segredos aqui como valor por omissão em produção; os defaults
abaixo servem só para desenvolvimento local com docker-compose. Ver
infra/docker/api.Dockerfile e docker-compose.yml para como isto é injectado.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ambiente: str = "desenvolvimento"

    # Postgres
    database_url: str = "postgresql+psycopg://jpa:jpa@localhost:5432/jpa"

    # JWT — segredo tem de ser trocado em produção via variável de ambiente.
    jwt_secret_key: str = "trocar-em-producao-nunca-usar-este-valor"
    jwt_algorithm: str = "HS256"
    access_token_expira_minutos: int = 15
    refresh_token_expira_dias: int = 30

    # Cloudflare R2 (compatível com S3) — storage de ficheiros (avatares, etc.)
    r2_endpoint_url: str = ""
    r2_bucket: str = "janelasparaalma"
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""


@lru_cache
def obter_settings() -> Settings:
    return Settings()
