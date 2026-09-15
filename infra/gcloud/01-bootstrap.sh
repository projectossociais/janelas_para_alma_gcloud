#!/usr/bin/env bash
# Activa as APIs GCP necessárias e cria o repositório de imagens.
# Idempotente — pode correr-se as vezes que forem precisas.
set -euo pipefail
cd "$(dirname "$0")"
[ -f ./00-config.sh ] && source ./00-config.sh

gcloud config set project "$PROJECT_ID"

echo "==> A activar as APIs necessárias..."
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com

echo "==> Permissões do service account por omissão do Compute Engine"
# Projectos GCP criados recentemente já não recebem `Editor` automático no SA
# do Compute Engine (endurecimento de segurança da Google) -- sem isto:
# - `gcloud builds submit` do 04/05 falha a meio com "storage.objects.get
#   denied" ao tentar ler a fonte que ele próprio acabou de enviar
#   (roles/cloudbuild.builds.builder cobre leitura da fonte, logs, e push
#   para o Artifact Registry);
# - o Job de migração e o serviço da API falham a ligar ao Cloud SQL com
#   "403 NOT_AUTHORIZED ... cloudsql.instances.get" (roles/cloudsql.client
#   é o mínimo para o Cloud SQL Auth Proxy embutido no Cloud Run funcionar).
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
for ROLE in roles/cloudbuild.builds.builder roles/cloudsql.client; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="$ROLE" \
    --condition=None >/dev/null
done

echo "==> Artifact Registry: repositório '${AR_REPO}' em '${REGION}'"
if ! gcloud artifacts repositories describe "$AR_REPO" --location="$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$AR_REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Imagens do Janelas Para a Alma"
else
  echo "    já existe, nada a fazer."
fi

echo "==> Feito."
