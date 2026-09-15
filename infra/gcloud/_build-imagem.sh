#!/usr/bin/env bash
# Não corre sozinho -- ver 04-deploy.sh e 05-migrate.sh, que fazem
# `source ./_build-imagem.sh`. Builda a imagem da API (Cloud Build) só se
# ainda não existir para este commit, e deixa o resultado em $API_IMAGE.
#
# Partilhado entre os dois scripts (e entre o deploy manual e o automático
# do CI/CD, ver .github/workflows/ci.yml) de propósito: sem isto, o 04 e o
# 05 tinham cada um a sua cópia da lógica de build, e cedo ou tarde ficavam
# a fazer coisas ligeiramente diferentes.
REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
TAG="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
API_IMAGE="${IMAGE_BASE}/api:${TAG}"

if gcloud artifacts docker images describe "$API_IMAGE" >/dev/null 2>&1; then
  echo "==> Imagem ${API_IMAGE} já existe -- a saltar o build."
else
  echo "==> Build da imagem da API (tag ${TAG}) via Cloud Build"
  # `--config=-` não lê de stdin no gcloud actual -- tenta abrir um ficheiro
  # chamado "-" e falha. O config tem de ser um ficheiro real.
  _CLOUDBUILD_TMP="$(mktemp)"
  cat > "$_CLOUDBUILD_TMP" <<EOF
steps:
  - name: gcr.io/cloud-builders/docker
    args: ["build", "-f", "infra/docker/api.Dockerfile", "-t", "${API_IMAGE}", "."]
images:
  - "${API_IMAGE}"
EOF
  gcloud builds submit "$REPO_ROOT" --config="$_CLOUDBUILD_TMP"
  rm -f "$_CLOUDBUILD_TMP"
fi
