# API — FastAPI, servida por uvicorn. A mesma imagem serve dev
# (docker-compose, com --reload sobre o código montado por bind mount) e
# produção (Cloud Run, sem --reload) — o comando é decidido por quem sobe o
# container, não por esta imagem.
#
# Nota deliberada: instala só as dependências de runtime (sem pytest/ruff) —
# a imagem que corre em produção não precisa das ferramentas de
# desenvolvimento. Os testes correm via `api/pyproject.toml` (extra [dev]),
# tipicamente fora desta imagem — ver .github/workflows/ci.yml.
FROM python:3.12-slim

WORKDIR /app

COPY api/ ./
RUN pip install --no-cache-dir .

EXPOSE 8000

# `-m uvicorn`, não o script `uvicorn` directamente: garante que o
# directório de trabalho (onde vive `app/`) entra no sys.path, sem depender
# de instalação editável nem de truques de PYTHONPATH.
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
