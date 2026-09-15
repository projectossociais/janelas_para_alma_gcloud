#!/usr/bin/env bash
# Corre `alembic upgrade head` contra o Cloud SQL, usando a MESMA imagem da
# API como um Cloud Run Job (mesma ligação ao Cloud SQL, mesmo DATABASE_URL
# do Secret Manager). Builda a imagem primeiro se ainda não existir para
# este commit (ver _build-imagem.sh) -- corre sempre ANTES do 04-deploy.sh,
# nunca depois: o código novo só deve começar a servir pedidos depois do
# esquema já estar pronto para ele.
#
# Decisão do dono do projecto (2026-09-15, ver CLAUDE.md secção 10): correr
# automaticamente no CI/CD, sem pausa manual -- ao contrário do que este
# ficheiro dizia antes. A rede de segurança que fica no lugar da pausa:
#   1. `ci.yml` já corre `alembic upgrade head` contra um Postgres real a
#      cada PR -- se a migração não aplicar limpo, falha ali, nunca chega
#      aqui.
#   2. Este script tira sempre um backup do Cloud SQL antes de migrar (ver
#      abaixo) -- ponto de restauro a menos de um minuto de distância.
#   3. Corrido à mão (fora do CI, `$CI` não definido), continua a pedir
#      confirmação explícita -- só o caminho automático deixou de parar.
set -euo pipefail
cd "$(dirname "$0")"
[ -f ./00-config.sh ] && source ./00-config.sh

source ./_build-imagem.sh
JOB_NAME="jpa-migrate"

echo "==> Backup do Cloud SQL antes de migrar (instância ${SQL_INSTANCE})"
gcloud sql backups create --instance="$SQL_INSTANCE" --async
echo "    Pedido — não bloqueia a migração, mas fica um ponto de restauro"
echo "    recente. Ver 'gcloud sql backups list --instance=${SQL_INSTANCE}'."

if [ -z "${CI:-}" ]; then
  echo
  echo "Vai correr 'alembic upgrade head' contra:"
  echo "  instância : ${SQL_CONNECTION_NAME}"
  echo "  base dados: ${SQL_DB}"
  echo "  imagem    : ${API_IMAGE}"
  echo
  read -r -p "Confirmas? Escreve 'sim' para continuar: " resposta
  [ "$resposta" = "sim" ] || { echo "Cancelado."; exit 1; }
else
  echo "==> CI detectado (\$CI definido) -- a migrar sem pausa manual,"
  echo "    conforme decisão registada em CLAUDE.md secção 10."
fi

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
