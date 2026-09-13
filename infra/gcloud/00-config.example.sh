# Copiar para `00-config.sh` (que está no .gitignore) e preencher.
# Todos os scripts fazem `source ./00-config.sh`.
#
#   cp 00-config.example.sh 00-config.sh
#   $EDITOR 00-config.sh
#
# Nada de segredos em claro aqui se o 00-config.sh vier a ser partilhado: as
# passwords/chaves passam por variáveis de ambiente na altura de correr os
# scripts (ver 02 e 03).

# --- Projecto e região ------------------------------------------------------
export PROJECT_ID="TROCAR-pelo-id-do-projecto"   # o ID, não o nome amigável
export REGION="europe-west1"                      # Cloud Run e Cloud SQL na MESMA região
export AR_REPO="jpa"                              # repositório Artifact Registry para as imagens

# --- Cloud SQL (Postgres) -------------------------------------------------
export SQL_INSTANCE="jpa-db"
export SQL_TIER="db-f1-micro"                     # o mais barato; subir se precisar
export SQL_DB="jpa"
export SQL_USER="jpa"
# Password do utilizador da base de dados. Deixar vazio aqui e exportar na
# shell antes de correr o 02/03:  export SQL_PASSWORD='...'
export SQL_PASSWORD="${SQL_PASSWORD:-}"

# --- Serviços Cloud Run --------------------------------------------------
# Só a API tem serviço Cloud Run — o frontend é servido pelo Vercel (ver
# CLAUDE.md §0/§2), fora destes scripts.
export API_SERVICE="jpa-api"

# Domínio público do frontend no Vercel — vai para FRONTEND_ORIGINS da API
# (rede de segurança do CORS; o caminho normal é mesma-origem via o rewrite
# de frontend/vercel.json, que nem chega a exercitar isto).
export FRONTEND_DOMAIN="janelasparaalma.com"

# --- Cloudflare R2 (storage de ficheiros) — preencher quando existir -----
export R2_ENDPOINT_URL="${R2_ENDPOINT_URL:-}"
export R2_BUCKET="janelasparaalma"
export R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-}"
export R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-}"
# Base pública por onde o bucket é servido (domínio ligado ao bucket, ou o
# https://pub-xxxx.r2.dev). URL final de um ficheiro = {base}/{chave}. Não é
# segredo — vai como env var normal, não pelo Secret Manager.
export R2_PUBLIC_BASE_URL="${R2_PUBLIC_BASE_URL:-}"

# --- Derivados (não editar) --------------------------------------------
export SQL_CONNECTION_NAME="${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"
export AR_HOST="${REGION}-docker.pkg.dev"
export IMAGE_BASE="${AR_HOST}/${PROJECT_ID}/${AR_REPO}"
