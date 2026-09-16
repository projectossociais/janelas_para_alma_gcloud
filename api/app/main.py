from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import obter_settings
from app.routers import (
    admin,
    auth,
    banners,
    conta,
    contact_messages,
    doacoes,
    feedback,
    notificacoes,
    perfil,
    premium,
    sessoes_exercicio,
    uploads,
    voluntariado,
)

app = FastAPI(title="Janelas Para a Alma — API")

# O caminho normal é mesma-origem: o browser chama `/api/*`, servido pelo proxy
# do Vite em dev e pelo NGINX nos containers — aí o CORS nem é exercitado. Este
# middleware é a rede de segurança para pedidos cross-origin legítimos (dev a
# apontar `VITE_API_URL` a uma API remota, ferramentas de teste): origem tem de
# estar em `frontend_origins` (lista fechada, nunca "*"), e `allow_credentials`
# obriga a origem explícita para os cookies de sessão passarem. Métodos e
# cabeçalhos limitados ao que o cliente (`apiClient.ts`) usa de facto.
app.add_middleware(
    CORSMiddleware,
    allow_origins=obter_settings().frontend_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)

app.include_router(auth.router)
app.include_router(perfil.router)
app.include_router(conta.router)
app.include_router(banners.router)
app.include_router(doacoes.router)
app.include_router(feedback.router)
app.include_router(uploads.router)
app.include_router(sessoes_exercicio.router)
app.include_router(contact_messages.router)
app.include_router(premium.router)
app.include_router(admin.router)
app.include_router(voluntariado.router)
app.include_router(notificacoes.router)


@app.get("/saude")
def saude() -> dict[str, str]:
    """Healthcheck — usado pelo Cloud Run e pelo docker-compose."""
    return {"estado": "ok"}
