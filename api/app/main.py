import math

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import obter_settings
from app.routers import (
    admin,
    agendamentos,
    auth,
    banner_homepage,
    banners,
    clinicas,
    consentimento,
    conta,
    contact_messages,
    doacoes,
    exercicios,
    feedback,
    interno,
    jogo,
    notificacoes,
    perfil,
    premium,
    publicacoes,
    rastreio_completo,
    relatorios,
    screenings,
    sessoes_exercicio,
    uploads,
    voluntariado,
)

app = FastAPI(title="Janelas Para a Alma — API")


@app.exception_handler(RequestValidationError)
async def _erro_de_validacao(pedido: Request, exc: RequestValidationError):
    """422 normal, com uma excepção: um corpo com ``NaN``/``Infinity`` (o ``json`` do
    Python aceita-os) fazia a própria mensagem de erro repetir o valor, que não cabe
    em JSON, e o pedido acabava em 500. Nesse caso retira-se só o valor repetido."""
    erros = exc.errors()
    if not any(isinstance(e.get("input"), float) and not math.isfinite(e["input"]) for e in erros):
        return await request_validation_exception_handler(pedido, exc)
    limpos = [
        {k: v for k, v in e.items() if k != "input"}
        if isinstance(e.get("input"), float) and not math.isfinite(e["input"])
        else e
        for e in erros
    ]
    return JSONResponse(status_code=422, content={"detail": jsonable_encoder(limpos)})

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
app.include_router(banner_homepage.router)
app.include_router(doacoes.router)
app.include_router(feedback.router)
app.include_router(uploads.router)
app.include_router(sessoes_exercicio.router)
app.include_router(exercicios.router)
app.include_router(contact_messages.router)
app.include_router(premium.router)
app.include_router(admin.router)
app.include_router(voluntariado.router)
app.include_router(publicacoes.router)
app.include_router(notificacoes.router)
app.include_router(rastreio_completo.router)
app.include_router(screenings.router)
app.include_router(jogo.router)
app.include_router(agendamentos.router)
app.include_router(clinicas.router)
app.include_router(interno.router)
app.include_router(relatorios.router)
app.include_router(consentimento.router)


@app.get("/saude")
def saude() -> dict[str, str]:
    """Healthcheck — usado pelo Cloud Run e pelo docker-compose."""
    return {"estado": "ok"}
