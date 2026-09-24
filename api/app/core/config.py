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
    # Base pública por onde os ficheiros do bucket são servidos (domínio
    # ligado ao bucket, ou o `https://pub-xxxx.r2.dev` do R2). O URL final
    # de um objecto é `{r2_public_base_url}/{chave}`. Vazio até haver bucket.
    r2_public_base_url: str = ""
    # Segundos de validade do URL de upload assinado — curto de propósito:
    # é entregue ao browser mesmo antes de ele escolher o ficheiro.
    r2_upload_url_expira_segundos: int = 300
    # Vídeos dos exercícios (pagos): bucket **privado** à parte, sem domínio
    # público ligado — o `r2_bucket` acima é servido publicamente por
    # `r2_public_base_url`, por isso um vídeo lá dentro ficaria acessível a
    # quem adivinhasse o URL. Só se lê por URL assinado, emitido por
    # `GET /exercicios/{id}/video` depois de verificar o acesso. Vazio até
    # os vídeos existirem — o endpoint responde 503 nesse caso.
    r2_bucket_videos: str = ""
    r2_video_url_expira_segundos: int = 900

    # CORS — origens do frontend com permissão para pedidos com cookies.
    # Em dev sem Docker, frontend (npm run dev, porta 8080) e API (porta
    # 8000) são origens diferentes; em produção, o rewrite de
    # frontend/vercel.json já resolve isto por mesma-origem, e isto nem
    # chega a ser exercitado.
    frontend_origins: list[str] = ["http://localhost:8080"]

    # URL base do frontend — usado só para montar o link de recuperação de
    # password que vai por email (nunca para navegação nem CORS, isso é
    # `frontend_origins`). Em produção é "https://janelasparaalma.com".
    frontend_base_url: str = "http://localhost:8080"

    # Resend (email transacional) — ver api/app/core/email.py. Vazio em dev:
    # o EmailSender real não é construído sem chave (ver dependencies.py),
    # os testes usam sempre um EmailSender falso.
    resend_api_key: str = ""
    # Remetente das mensagens. Em produção tem de ser um domínio verificado
    # no Resend (ver docs/BACKLOG.md); "onboarding@resend.dev" é o remetente
    # de testes do Resend, só entrega à própria conta.
    email_remetente: str = "onboarding@resend.dev"

    # Login com Google (Sign In With Google) — ver core/google_auth.py. O
    # Client ID não é secreto (corre no browser, dentro do próprio token que
    # o Google Identity Services emite) — mesmo assim vem de variável de
    # ambiente, nunca hardcoded, para poder mudar sem alterar código.
    google_client_id: str = ""

    # Loja de diamantes do jogo -- enquanto não houver integração real de
    # pagamento, `POST /jogo/loja/compras` só credita diamantes com isto
    # ligado. Ligado em docker-compose (desenvolvimento); **nunca** em
    # produção, onde seriam diamantes grátis. Ver services/loja_jogo_service.py.
    jogo_pagamentos_simulados: bool = False

    @property
    def cookie_seguro(self) -> bool:
        """Cookies com `Secure` fora de desenvolvimento — exige HTTPS, que só
        existe a partir de staging/produção. Nunca `True` sobre HTTP simples:
        o browser simplesmente descarta o cookie sem avisar."""
        return self.ambiente != "desenvolvimento"


@lru_cache
def obter_settings() -> Settings:
    return Settings()
