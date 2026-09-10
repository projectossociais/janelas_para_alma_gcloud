#!/usr/bin/env bash
# Corre `alembic upgrade head` contra o Cloud SQL, usando a MESMA imagem da
# API como um Cloud Run Job (mesma ligação ao Cloud SQL, mesmo DATABASE_URL
# do Secret Manager).
#
# CLAUDE.md secção 10: nenhuma migração corre em produção sem confirmação
# humana explícita. Este script pára e pergunta.
set -euo pipefail
cd "$(dirname "$0")"
source ./00-config.sh

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
TAG="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
API_IMAGE="${IMAGE_BASE}/api:${TAG}"
JOB_NAME="jpa-migrate"

echo "Vai correr 'alembic upgrade head' contra:"
echo "  instância : ${SQL_CONNECTION_NAME}"
echo "  base dados: ${SQL_DB}"
echo "  imagem    : ${API_IMAGE}"
echo
read -r -p "Confirmas? Escreve 'sim' para continuar: " resposta
[ "$resposta" = "sim" ] || { echo "Cancelado."; exit 1; }

# Cria/actualiza o Job
if gcloud run jobs describe "$JOB_NAME" --region="$REGION" >/dev/null 2>&1; then
  gcloud run jobs update "$JOB_NAME" \
    --image="$API_IMAGE" \
    --region="$REGION" \
    --set-cloudsql-instances="$SQL_CONNECTION_NAME" \
    --set-secrets="DATABASE_URL=jpa-database-url:latest" \
    --command="python" \
    --args="-m,alembic,upgrade,head"
else
  gcloud run jobs create "$JOB_NAME" \
    --image="$API_IMAGE" \
    --region="$REGION" \
    --set-cloudsql-instances="$SQL_CONNECTION_NAME" \
    --set-secrets="DATABASE_URL=jpa-database-url:latest" \
    --command="python" \
    --args="-m,alembic,upgrade,head"
fi

echo "==> A executar o Job..."
gcloud run jobs execute "$JOB_NAME" --region="$REGION" --wait

echo "==> Migração terminada. Confere os logs do Job se quiseres o detalhe:"
echo "    gcloud run jobs executions list --job=${JOB_NAME} --region=${REGION}"
