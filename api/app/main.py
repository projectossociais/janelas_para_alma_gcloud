from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import obter_settings
from app.routers import auth, banners, conta, doacoes, perfil

app = FastAPI(title="Janelas Para a Alma — API")

# allow_credentials=True é obrigatório para os cookies de sessão chegarem em
# pedidos cross-origin (dev sem Docker: frontend em :8080, API em :8000) —
# e, com allow_credentials=True, o browser exige uma origem explícita em
# allow_origins, nunca "*".
app.add_middleware(
    CORSMiddleware,
    allow_origins=obter_settings().frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(perfil.router)
app.include_router(conta.router)
app.include_router(banners.router)
app.include_router(doacoes.router)


@app.get("/saude")
def saude() -> dict[str, str]:
    """Healthcheck — usado pelo Cloud Run e pelo docker-compose."""
    return {"estado": "ok"}
