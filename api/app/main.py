from fastapi import FastAPI

from app.routers import auth

app = FastAPI(title="Janelas Para a Alma — API")

app.include_router(auth.router)


@app.get("/saude")
def saude() -> dict[str, str]:
    """Healthcheck — usado pelo Cloud Run e pelo docker-compose."""
    return {"estado": "ok"}
