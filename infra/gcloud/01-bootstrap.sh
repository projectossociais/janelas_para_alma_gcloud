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
