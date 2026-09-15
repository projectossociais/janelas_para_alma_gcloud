#!/usr/bin/env bash
# Liga o GitHub Actions ao GCP para o deploy automático da API (job
# `deploy-api` em .github/workflows/ci.yml) e escreve a configuração
# resultante directamente no repositório GitHub (`gh variable set`) --
# corre-se uma vez só, depois de 01-03 (precisa do projecto, do Cloud SQL e
# dos segredos já existirem).
#
# Decisão do dono do projecto (2026-09-15): push/merge em `main` passa a
# fazer deploy sozinho, código E migrações -- ver CLAUDE.md secção 10 para
# o porquê e a rede de segurança que fica no lugar da pausa manual.
#
# Porque Workload Identity Federation e não uma chave JSON de service
# account: uma chave JSON é um segredo de vida longa -- se vazar (log, commit
# por engano, o que for), continua válida até alguém a revogar à mão. A WIF
# troca isso por confiança federada: o GitHub Actions prova quem é (token
# OIDC, assinado pela própria GitHub, válido minutos) e o GCP verifica essa
# prova sem nenhum segredo partilhado a guardar em lado nenhum. Nada disto
# aparece nos logs do GitHub nem precisa de rotação.
set -euo pipefail
cd "$(dirname "$0")"
[ -f ./00-config.sh ] && source ./00-config.sh

GITHUB_REPO="${GITHUB_REPO:?export GITHUB_REPO=\"dono/repositorio\" antes de correr isto}"
POOL_ID="github-actions"
PROVIDER_ID="github"
DEPLOY_SA="jpa-deploy"
DEPLOY_SA_EMAIL="${DEPLOY_SA}@${PROJECT_ID}.iam.gserviceaccount.com"

command -v gh >/dev/null 2>&1 || { echo "ERRO: precisa do 'gh' CLI autenticado." >&2; exit 1; }

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"

echo "==> A activar a API do IAM Credentials (necessária para WIF)"
gcloud services enable iamcredentials.googleapis.com

echo "==> Workload Identity Pool '${POOL_ID}'"
if ! gcloud iam workload-identity-pools describe "$POOL_ID" --location=global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL_ID" \
    --location=global \
    --display-name="GitHub Actions"
else
  echo "    já existe."
fi

echo "==> Provider OIDC '${PROVIDER_ID}', restrito ao repositório ${GITHUB_REPO}"
# attribute-condition fecha a confiança a ESTE repositório -- sem isto,
# qualquer repositório de qualquer conta GitHub poderia pedir para
# personificar o service account de deploy.
if ! gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
    --location=global --workload-identity-pool="$POOL_ID" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
    --location=global \
    --workload-identity-pool="$POOL_ID" \
    --display-name="GitHub" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository == '${GITHUB_REPO}'" \
    --issuer-uri="https://token.actions.githubusercontent.com"
else
  echo "    já existe."
fi

WIF_PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"

echo "==> Service account de deploy '${DEPLOY_SA_EMAIL}'"
if ! gcloud iam service-accounts describe "$DEPLOY_SA_EMAIL" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$DEPLOY_SA" \
    --display-name="CI/CD -- deploy da API (GitHub Actions)"
else
  echo "    já existe."
fi

echo "==> Permissão para o GitHub Actions (só de refs/heads/main) personificar o SA de deploy"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA_EMAIL" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${GITHUB_REPO}" \
  >/dev/null

echo "==> Papéis do SA de deploy no projecto (mínimo necessário para build + deploy + migrar)"
# run.admin            -- gcloud run deploy / gcloud run jobs create|update|execute
# cloudbuild.builds.editor -- gcloud builds submit (o build em si corre como
#                             o SA do Cloud Build, não como este; ver abaixo)
# cloudsql.editor      -- gcloud sql backups create (não há papel mais
#                         estreito só para backups; aceite conscientemente
#                         para uma equipa pequena)
# iam.serviceAccountUser -- para o Cloud Run correr como o SA de runtime
#                           (o SA de compute por omissão, usado em --set-secrets)
for role in roles/run.admin roles/cloudbuild.builds.editor roles/cloudsql.editor roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
    --role="$role" \
    --condition=None >/dev/null
  echo "    ${role}"
done

echo "==> O Cloud Build (o serviço que faz o build de facto) precisa de poder publicar no Artifact Registry"
CLOUDBUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CLOUDBUILD_SA}" \
  --role="roles/artifactregistry.writer" \
  --condition=None >/dev/null

echo "==> A escrever a configuração como Variables no repositório GitHub (${GITHUB_REPO})"
# Nenhum destes valores é secreto -- são identificadores (nomes de projecto,
# região, emails de service account), nunca chaves. É precisamente o que a
# WIF evita ter de guardar como Secret.
gh variable set GCP_PROJECT_ID --repo "$GITHUB_REPO" --body "$PROJECT_ID"
gh variable set GCP_REGION --repo "$GITHUB_REPO" --body "$REGION"
gh variable set GCP_AR_REPO --repo "$GITHUB_REPO" --body "$AR_REPO"
gh variable set GCP_SQL_INSTANCE --repo "$GITHUB_REPO" --body "$SQL_INSTANCE"
gh variable set GCP_SQL_CONNECTION_NAME --repo "$GITHUB_REPO" --body "$SQL_CONNECTION_NAME"
gh variable set GCP_API_SERVICE --repo "$GITHUB_REPO" --body "$API_SERVICE"
gh variable set GCP_FRONTEND_DOMAIN --repo "$GITHUB_REPO" --body "$FRONTEND_DOMAIN"
gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER --repo "$GITHUB_REPO" --body "$WIF_PROVIDER"
gh variable set GCP_DEPLOY_SERVICE_ACCOUNT --repo "$GITHUB_REPO" --body "$DEPLOY_SA_EMAIL"

echo
echo "==> Feito. O job 'deploy-api' em .github/workflows/ci.yml já tem tudo o que precisa"
echo "    a partir do próximo push/merge em main."
