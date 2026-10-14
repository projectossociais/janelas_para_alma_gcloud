#!/usr/bin/env bash
# Migração ÚNICA dos comprovativos de pagamento antigos do bucket R2 público
# para o privado (R2_BUCKET_COMPROVATIVOS) -- ver
# api/scripts/migrar_comprovativos_privados.py. Corre a imagem da API como
# um Cloud Run Job (mesmo Cloud SQL, mesmo DATABASE_URL e chaves do R2 do
# Secret Manager), como o 05-migrate.sh. Nunca corre no CI: é à mão.
#
#   ./08-migrar-comprovativos.sh                               # ensaio, não mexe em nada
#   ./08-migrar-comprovativos.sh --executar                    # copia e grava a chave
#   ./08-migrar-comprovativos.sh --executar --apagar-publicos  # e apaga os originais públicos
#
# Pode correr-se várias vezes: só trata linhas ainda por migrar. Pré-requisitos:
# a migração Alembic b8e4f2a6c9d1 já aplicada (deploy normal) e o bucket
# privado criado, com R2_BUCKET_COMPROVATIVOS em 00-config.sh.
set -euo pipefail
cd "$(dirname "$0")"
[ -f ./00-config.sh ] && source ./00-config.sh
source ./_build-imagem.sh

[ -n "${R2_ENDPOINT_URL:-}" ] || { echo "ERRO: define R2_ENDPOINT_URL." >&2; exit 1; }
[ -n "${R2_PUBLIC_BASE_URL:-}" ] || { echo "ERRO: define R2_PUBLIC_BASE_URL." >&2; exit 1; }
[ -n "${R2_BUCKET_COMPROVATIVOS:-}" ] || { echo "ERRO: define R2_BUCKET_COMPROVATIVOS." >&2; exit 1; }

JOB_NAME="jpa-migrar-comprovativos"
ARGS="-m,scripts.migrar_comprovativos_privados"
for a in "$@"; do ARGS="${ARGS},${a}"; done

if [[ " $* " == *" --executar "* ]]; then
  echo "==> Backup do Cloud SQL antes de migrar (instância ${SQL_INSTANCE})"
  gcloud sql backups create --instance="$SQL_INSTANCE" --async
  echo "Vai copiar os comprovativos de ${R2_BUCKET} para ${R2_BUCKET_COMPROVATIVOS} e gravar as chaves (args: $*)."
  read -r -p "Confirmas? Escreve 'sim' para continuar: " resposta
  [ "$resposta" = "sim" ] || { echo "Cancelado."; exit 1; }
fi

COMUM=(
  --image="$API_IMAGE"
  --region="$REGION"
  --set-cloudsql-instances="$SQL_CONNECTION_NAME"
  --set-secrets="DATABASE_URL=jpa-database-url:latest,R2_ACCESS_KEY_ID=jpa-r2-access-key-id:latest,R2_SECRET_ACCESS_KEY=jpa-r2-secret-access-key:latest"
  --set-env-vars="^;^R2_ENDPOINT_URL=${R2_ENDPOINT_URL};R2_BUCKET=${R2_BUCKET};R2_PUBLIC_BASE_URL=${R2_PUBLIC_BASE_URL};R2_BUCKET_COMPROVATIVOS=${R2_BUCKET_COMPROVATIVOS}"
  --max-retries=0
  --command="python"
  --args="$ARGS"
)
if gcloud run jobs describe "$JOB_NAME" --region="$REGION" >/dev/null 2>&1; then
  gcloud run jobs update "$JOB_NAME" "${COMUM[@]}"
else
  gcloud run jobs create "$JOB_NAME" "${COMUM[@]}"
fi

echo "==> A executar o Job..."
gcloud run jobs execute "$JOB_NAME" --region="$REGION" --wait
echo "==> Feito. O relatório (migrados / ignorados / falhados) está nos logs:"
echo "    gcloud run jobs executions list --job=${JOB_NAME} --region=${REGION}"
