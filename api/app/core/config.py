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

    # CORS — origens do frontend com permissão para pedidos com cookies.
    # Em dev sem Docker, frontend (npm run dev, porta 8080) e API (porta
    # 8000) são origens diferentes; com docker-compose, o NGINX já faz
    # proxy de /api/* e isto nem chega a ser exercitado.
    frontend_origins: list[str] = ["http://localhost:8080"]

    @property
    def cookie_seguro(self) -> bool:
        """Cookies com `Secure` fora de desenvolvimento — exige HTTPS, que só
        existe a partir de staging/produção. Nunca `True` sobre HTTP simples:
        o browser simplesmente descarta o cookie sem avisar."""
        return self.ambiente != "desenvolvimento"


@lru_cache
def obter_settings() -> Settings:
    return Settings()
