#!/usr/bin/env bash
# Cria/actualiza os segredos no Secret Manager e dá acesso ao service
# account de runtime do Cloud Run. Idempotente.
#
# Segredos geridos aqui:
#   jpa-database-url          URL completo do Postgres (com password), via socket do Cloud SQL
#   jpa-jwt-secret-key        segredo de assinatura dos JWT (gerado se não for fornecido)
#   jpa-r2-access-key-id      Cloudflare R2 (só se R2_ACCESS_KEY_ID estiver definida)
#   jpa-r2-secret-access-key  Cloudflare R2 (idem)
#   jpa-resend-api-key        Resend (só se RESEND_API_KEY estiver definida)
set -euo pipefail
cd "$(dirname "$0")"
source ./00-config.sh

[ -n "${SQL_PASSWORD:-}" ] || { echo "ERRO: define SQL_PASSWORD." >&2; exit 1; }

upsert_secret() {
  local name="$1" value="$2"
  if gcloud secrets describe "$name" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- >/dev/null
    echo "    ${name}: nova versão"
  else
    printf '%s' "$value" | gcloud secrets create "$name" --data-file=- --replication-policy=automatic >/dev/null
    echo "    ${name}: criado"
  fi
}

# Conexão à DB por unix socket do Cloud SQL (psycopg3: host=/cloudsql/<conn>)
DB_URL="postgresql+psycopg://${SQL_USER}:${SQL_PASSWORD}@/${SQL_DB}?host=/cloudsql/${SQL_CONNECTION_NAME}"
upsert_secret jpa-database-url "$DB_URL"

JWT_SECRET_KEY="${JWT_SECRET_KEY:-$(python -c 'import secrets; print(secrets.token_urlsafe(64))')}"
upsert_secret jpa-jwt-secret-key "$JWT_SECRET_KEY"

if [ -n "${R2_ACCESS_KEY_ID:-}" ] && [ -n "${R2_SECRET_ACCESS_KEY:-}" ]; then
  upsert_secret jpa-r2-access-key-id "$R2_ACCESS_KEY_ID"
  upsert_secret jpa-r2-secret-access-key "$R2_SECRET_ACCESS_KEY"
else
  echo "    R2 sem credenciais — a saltar (storage fica por configurar)."
fi

if [ -n "${RESEND_API_KEY:-}" ]; then
  upsert_secret jpa-resend-api-key "$RESEND_API_KEY"
else
  echo "    Resend sem chave — a saltar (recuperação de password fica por activar)."
fi

echo "==> Acesso do service account de runtime aos segredos"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
for s in jpa-database-url jpa-jwt-secret-key jpa-r2-access-key-id jpa-r2-secret-access-key jpa-resend-api-key; do
  gcloud secrets describe "$s" >/dev/null 2>&1 || continue
  gcloud secrets add-iam-policy-binding "$s" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" >/dev/null
  echo "    ${s} -> ${RUNTIME_SA}"
done

echo "==> Feito. A seguir: 04-deploy.sh"
