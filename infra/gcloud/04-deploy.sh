#!/usr/bin/env bash
# Build das imagens (Cloud Build) e deploy dos dois serviços no Cloud Run.
# NÃO corre migrações Alembic — ver 05-migrate.sh.
#
# Ordem: API primeiro (para lhe apanhar o URL), depois o frontend com
# API_URL a apontar para a API. O NGINX do frontend faz proxy de /api/*
# para lá em run-time (envsubst sobre infra/nginx/default.conf.template).
set -euo pipefail
cd "$(dirname "$0")"
source ./00-config.sh

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
TAG="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
API_IMAGE="${IMAGE_BASE}/api:${TAG}"
FRONTEND_IMAGE="${IMAGE_BASE}/frontend:${TAG}"

echo "==> Build das imagens (tag ${TAG}) via Cloud Build"
gcloud builds submit "$REPO_ROOT" --config=- <<EOF
steps:
  - name: gcr.io/cloud-builders/docker
    args: ["build", "-f", "infra/docker/api.Dockerfile", "-t", "${API_IMAGE}", "."]
  - name: gcr.io/cloud-builders/docker
    args: ["build", "-f", "infra/docker/frontend.Dockerfile", "-t", "${FRONTEND_IMAGE}", "."]
images:
  - "${API_IMAGE}"
  - "${FRONTEND_IMAGE}"
EOF

# --- Env vars e secrets da API -------------------------------------------
API_ENV="AMBIENTE=producao"
API_SECRETS="DATABASE_URL=jpa-database-url:latest,JWT_SECRET_KEY=jpa-jwt-secret-key:latest"
if gcloud secrets describe jpa-r2-access-key-id >/dev/null 2>&1; then
  API_SECRETS="${API_SECRETS},R2_ACCESS_KEY_ID=jpa-r2-access-key-id:latest,R2_SECRET_ACCESS_KEY=jpa-r2-secret-access-key:latest"
fi
if [ -n "${R2_ENDPOINT_URL:-}" ]; then
  API_ENV="${API_ENV},R2_ENDPOINT_URL=${R2_ENDPOINT_URL},R2_BUCKET=${R2_BUCKET}"
  [ -n "${R2_PUBLIC_BASE_URL:-}" ] && API_ENV="${API_ENV},R2_PUBLIC_BASE_URL=${R2_PUBLIC_BASE_URL}"
fi

echo "==> Deploy da API ('${API_SERVICE}')"
gcloud run deploy "$API_SERVICE" \
  --image="$API_IMAGE" \
  --region="$REGION" \
  --port=8000 \
  --allow-unauthenticated \
  --add-cloudsql-instances="$SQL_CONNECTION_NAME" \
  --set-env-vars="$API_ENV" \
  --set-secrets="$API_SECRETS"

API_URL="$(gcloud run services describe "$API_SERVICE" --region="$REGION" --format='value(status.url)')"
echo "    API_URL = ${API_URL}"

echo "==> Deploy do frontend ('${FRONTEND_SERVICE}')"
gcloud run deploy "$FRONTEND_SERVICE" \
  --image="$FRONTEND_IMAGE" \
  --region="$REGION" \
  --port=80 \
  --allow-unauthenticated \
  --set-env-vars="API_URL=${API_URL}"

FRONTEND_URL="$(gcloud run services describe "$FRONTEND_SERVICE" --region="$REGION" --format='value(status.url)')"

echo
echo "==> Deploy feito."
echo "    Frontend: ${FRONTEND_URL}"
echo "    API:      ${API_URL}  (o browser fala com ela por ${FRONTEND_URL}/api/*)"
echo
echo "    Se a base de dados ainda não tem esquema, corre agora (com confirmação): ./05-migrate.sh"
