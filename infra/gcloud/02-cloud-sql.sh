#!/usr/bin/env bash
# Cria a instância Cloud SQL (Postgres), a base de dados e o utilizador.
# Idempotente. NÃO corre migrações — isso é o 05-migrate.sh, e só com
# confirmação humana (CLAUDE.md secção 10).
set -euo pipefail
cd "$(dirname "$0")"
[ -f ./00-config.sh ] && source ./00-config.sh

if [ -z "${SQL_PASSWORD:-}" ]; then
  echo "ERRO: SQL_PASSWORD não está definida." >&2
  echo "  export SQL_PASSWORD='...'   e volta a correr." >&2
  exit 1
fi

echo "==> Instância Cloud SQL '${SQL_INSTANCE}' (${REGION})"
if ! gcloud sql instances describe "$SQL_INSTANCE" >/dev/null 2>&1; then
  gcloud sql instances create "$SQL_INSTANCE" \
    --database-version=POSTGRES_16 \
    --tier="$SQL_TIER" \
    --region="$REGION" \
    --storage-auto-increase \
    --availability-type=zonal \
    --edition=ENTERPRISE
else
  echo "    já existe."
fi

echo "==> Base de dados '${SQL_DB}'"
gcloud sql databases describe "$SQL_DB" --instance="$SQL_INSTANCE" >/dev/null 2>&1 \
  || gcloud sql databases create "$SQL_DB" --instance="$SQL_INSTANCE"

echo "==> Utilizador '${SQL_USER}'"
if gcloud sql users list --instance="$SQL_INSTANCE" --format='value(name)' | grep -qx "$SQL_USER"; then
  gcloud sql users set-password "$SQL_USER" --instance="$SQL_INSTANCE" --password="$SQL_PASSWORD"
  echo "    password actualizada."
else
  gcloud sql users create "$SQL_USER" --instance="$SQL_INSTANCE" --password="$SQL_PASSWORD"
fi

echo "==> Connection name: ${SQL_CONNECTION_NAME}"
echo "==> Feito. A seguir: 03-secrets.sh"
