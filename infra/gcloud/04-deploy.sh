#!/usr/bin/env bash
# Build da imagem (Cloud Build, se ainda não existir para este commit -- ver
# _build-imagem.sh) e deploy do serviço da API no Cloud Run. NÃO corre
# migrações Alembic — isso é o 05-migrate.sh, sempre ANTES deste (uma
# migração tem de aplicar-se contra o esquema antigo antes do código novo
# começar a servir pedidos com ele).
#
# Corre-se tanto à mão (Wilson) como automaticamente a cada push/merge em
# `main` (ver .github/workflows/ci.yml, job `deploy-api`, e a nota sobre
# migrações automáticas em CLAUDE.md secção 10) -- por isso `00-config.sh`
# é opcional aqui: localmente vem de lá, no CI vem de variáveis já definidas
# pelo workflow (secrets/vars do GitHub, nunca hardcoded).
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
[ -f ./00-config.sh ] && source ./00-config.sh

source ./_build-imagem.sh

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
# FRONTEND_BASE_URL é só para montar o link de recuperação de password que
# vai por email (ver core/email.py) — nada a ver com CORS. Normalmente vazio
# no primeiro deploy (o URL do frontend só existe depois dele); preencher em
# 00-config.sh e voltar a correr este script quando já o souberes.
[ -n "${FRONTEND_BASE_URL:-}" ] && API_ENV="${API_ENV},FRONTEND_BASE_URL=${FRONTEND_BASE_URL}"
if gcloud secrets describe jpa-resend-api-key >/dev/null 2>&1; then
  API_SECRETS="${API_SECRETS},RESEND_API_KEY=jpa-resend-api-key:latest"
  API_ENV="${API_ENV},EMAIL_REMETENTE=${EMAIL_REMETENTE:-onboarding@resend.dev}"
else
  echo "    Resend sem chave (03-secrets.sh) — recuperação de password fica por activar."
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
if [ -z "${FRONTEND_BASE_URL:-}" ]; then
  echo "    FRONTEND_BASE_URL ainda vazio: define-o em 00-config.sh como https://${FRONTEND_DOMAIN}"
  echo "    e volta a correr este script para os emails de recuperação/confirmação"
  echo "    apontarem para o sítio certo."
fi
echo "    Se estás a correr isto à mão, faltou o ./05-migrate.sh ANTES deste script"
echo "    se houver migrações novas por aplicar -- no CI/CD isso já corre sozinho."
