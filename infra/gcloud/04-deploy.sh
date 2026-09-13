#!/usr/bin/env bash
# Build da imagem (Cloud Build) e deploy do serviço da API no Cloud Run.
# NÃO corre migrações Alembic — ver 05-migrate.sh.
#
# O frontend não faz parte deste script: é servido pelo Vercel (conta e
# CI/CD próprios, domínio janelasparaalma.com), com deploy automático a cada
# push/merge em `main` — ver CLAUDE.md §0/§2. O browser continua a falar
# sempre com /api/* na mesma origem: quem faz esse proxy agora é o `rewrite`
# em frontend/vercel.json, não o NGINX (removido). Depois de correr este
# script, se o URL da API mudar (primeiro deploy, ou serviço recriado),
# actualizar esse rewrite em frontend/vercel.json e voltar a fazer deploy do
# frontend no Vercel.
set -euo pipefail
cd "$(dirname "$0")"
source ./00-config.sh

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
TAG="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
API_IMAGE="${IMAGE_BASE}/api:${TAG}"

echo "==> Build da imagem da API (tag ${TAG}) via Cloud Build"
gcloud builds submit "$REPO_ROOT" --config=- <<EOF
steps:
  - name: gcr.io/cloud-builders/docker
    args: ["build", "-f", "infra/docker/api.Dockerfile", "-t", "${API_IMAGE}", "."]
images:
  - "${API_IMAGE}"
EOF

# --- Env vars e secrets da API -------------------------------------------
# FRONTEND_ORIGINS é só a rede de segurança do CORS (ver api/app/main.py) —
# o caminho normal é mesma-origem, via rewrite do Vercel, e nem a exercita.
API_ENV="AMBIENTE=producao,FRONTEND_ORIGINS=[\"https://${FRONTEND_DOMAIN}\"]"
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

echo
echo "==> Deploy da API feito."
echo "    API_URL = ${API_URL}"
echo
echo "    Confirmar que frontend/vercel.json tem este URL no rewrite de /api/*"
echo "    (o browser em janelasparaalma.com fala com a API só através dele)."
echo "    Se a base de dados ainda não tem esquema, corre agora (com confirmação): ./05-migrate.sh"
