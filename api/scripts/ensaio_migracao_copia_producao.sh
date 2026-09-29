#!/usr/bin/env bash
# Ensaio da migração b2c6e9a4d1f8 (exercícios sem webcam) contra uma CÓPIA dos
# dados reais, numa base descartável. Nunca liga à produção.
#
# Uso:
#   ENSAIO_DATABASE_URL=postgresql://jpa:jpa@localhost:5432/jpa_ensaio \
#     api/scripts/ensaio_migracao_copia_producao.sh [caminho/para/o/dump]
#
#   - Com um dump (pg_dump em formato custom `-Fc` ou SQL simples), a base de
#     ENSAIO_DATABASE_URL é APAGADA e recriada a partir do dump. Só é permitido
#     em localhost.
#   - Sem dump, usa a base tal como está (ex.: um backup do Cloud SQL já
#     restaurado numa instância separada, criada só para isto).
#
# Salvaguardas -- o script recusa correr se:
#   - ENSAIO_DATABASE_URL não apontar para localhost/127.0.0.1/::1 ou para um
#     socket local, A NÃO SER que o nome da base termine em `_descartavel` E
#     ENSAIO_CONFIRMO_DESCARTAVEL=sim esteja definido;
#   - o socket for do Cloud SQL (`/cloudsql/...`);
#   - o servidor, mesmo em "localhost", for uma instância Cloud SQL (tem o papel
#     `cloudsqlsuperuser`) -- é o caso do Cloud SQL Auth Proxy a apontar para a
#     produção --, salvo base `_descartavel` + ENSAIO_CONFIRMO_DESCARTAVEL=sim e
#     sem dump;
#   - houver um dump para restaurar e a base não for local (nunca se faz
#     DROP DATABASE fora de localhost);
#   - a base não estiver na revisão imediatamente anterior (f3c8a1e6b9d4) ou
#     já na head -- para não ensaiar sobre um esquema inesperado.
#
# Requisitos: psql, pg_restore, dropdb/createdb (cliente Postgres 16) e um
# Python com as dependências da API (`pip install -e "api[dev]"`); por omissão
# usa `python3`, ou o que estiver em ENSAIO_PYTHON.
set -euo pipefail

REVISAO_ANTERIOR="f3c8a1e6b9d4"
REVISAO_NOVA="b2c6e9a4d1f8"
DUMP="${1:-}"
URL="${ENSAIO_DATABASE_URL:-}"
PY="${ENSAIO_PYTHON:-python3}"
API_DIR="$(cd "$(dirname "$0")/.." && pwd)"

falhar() { echo "ERRO: $*" >&2; exit 1; }

[ -n "$URL" ] || falhar "defina ENSAIO_DATABASE_URL (ex.: postgresql://jpa:jpa@localhost:5432/jpa_ensaio)"

# --- Salvaguarda: só bases locais ou explicitamente descartáveis ------------
read -r HOST NOME_BASE < <("$PY" - "$URL" <<'EOF'
import sys
from urllib.parse import urlsplit, parse_qs
u = urlsplit(sys.argv[1].replace("+psycopg", ""))
host = u.hostname or ""
q = parse_qs(u.query)
if not host and "host" in q:          # socket unix: ?host=/caminho
    host = q["host"][0]
print(host or "-", (u.path or "/").lstrip("/") or "-")
EOF
)
DESCARTAVEL_CONFIRMADA=0
if [[ "$NOME_BASE" == *_descartavel ]] && [ "${ENSAIO_CONFIRMO_DESCARTAVEL:-}" = "sim" ]; then
  DESCARTAVEL_CONFIRMADA=1
fi
case "$HOST" in
  */cloudsql/*|/cloudsql*) LOCAL=0 ;;          # socket do Cloud SQL (Cloud Run / proxy): nunca é local
  localhost|127.0.0.1|::1|/*) LOCAL=1 ;;
  *) LOCAL=0 ;;
esac
if [ "$LOCAL" != 1 ]; then
  if [ "$DESCARTAVEL_CONFIRMADA" = 1 ]; then
    echo "AVISO: base remota '$NOME_BASE' em '$HOST', marcada como descartável. A continuar."
  else
    falhar "recuso correr contra '$HOST/$NOME_BASE': não é local. Para uma instância criada só para o ensaio, o nome da base tem de terminar em '_descartavel' e ENSAIO_CONFIRMO_DESCARTAVEL=sim."
  fi
fi
if [ -n "$DUMP" ] && [ "$LOCAL" != 1 ]; then
  falhar "restaurar um dump apaga a base: só é permitido em localhost."
fi

PSQL_URL="${URL/+psycopg/}"
export DATABASE_URL="postgresql+psycopg://${PSQL_URL#postgresql://}"
sql() { psql "$PSQL_URL" -v ON_ERROR_STOP=1 -tAq -c "$1"; }
alembic() { (cd "$API_DIR" && "$PY" -m alembic "$@"); }

# --- Salvaguarda: "localhost" pode ser o Cloud SQL Auth Proxy -----------------
# O proxy expõe a instância de produção em 127.0.0.1. Pergunta-se ao próprio
# servidor: uma instância Cloud SQL tem sempre o papel `cloudsqlsuperuser`.
# Liga-se à base de administração `postgres`, que existe sempre, antes de
# qualquer DROP.
SERVIDOR_URL="$("$PY" -c 'import sys; from urllib.parse import urlsplit, urlunsplit; u = urlsplit(sys.argv[1]); print(urlunsplit(u._replace(path="/postgres")))' "$PSQL_URL")"
E_CLOUDSQL="$(psql "$SERVIDOR_URL" -v ON_ERROR_STOP=1 -tAq -c "SELECT count(*) FROM pg_roles WHERE rolname = 'cloudsqlsuperuser';")" \
  || falhar "não consegui ligar ao servidor de '$HOST' para confirmar que não é um Cloud SQL."
if [ "$E_CLOUDSQL" != "0" ]; then
  if [ "$DESCARTAVEL_CONFIRMADA" = 1 ] && [ -z "$DUMP" ]; then
    echo "AVISO: o servidor é uma instância Cloud SQL; a base '$NOME_BASE' está marcada como descartável. A continuar."
  else
    falhar "o servidor em '$HOST' é uma instância Cloud SQL (pode ser a produção através do Cloud SQL Auth Proxy). Só corro contra uma instância criada para o ensaio, com a base a terminar em '_descartavel', ENSAIO_CONFIRMO_DESCARTAVEL=sim e sem dump para restaurar."
  fi
fi

# --- Restaurar o dump (só local) --------------------------------------------
if [ -n "$DUMP" ]; then
  [ -f "$DUMP" ] || falhar "dump não encontrado: $DUMP"
  ADMIN_URL="$("$PY" -c 'import sys; from urllib.parse import urlsplit, urlunsplit; u = urlsplit(sys.argv[1]); print(urlunsplit(u._replace(path="/postgres")))' "$PSQL_URL")"
  echo "==> A recriar a base local '$NOME_BASE' a partir de $DUMP"
  psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS \"$NOME_BASE\";" -c "CREATE DATABASE \"$NOME_BASE\";"
  if head -c 5 "$DUMP" | grep -q "PGDMP"; then
    pg_restore --no-owner --no-acl -d "$PSQL_URL" "$DUMP"
  else
    psql "$PSQL_URL" -v ON_ERROR_STOP=1 -q -f "$DUMP" >/dev/null
  fi
fi

# --- Estado inicial ----------------------------------------------------------
ACTUAL="$(sql "SELECT version_num FROM alembic_version;" | tr -d '[:space:]')"
echo "==> Revisão actual: $ACTUAL"
if [ "$ACTUAL" = "$REVISAO_NOVA" ]; then
  echo "    A base já está na $REVISAO_NOVA -- a descer para $REVISAO_ANTERIOR para ensaiar o upgrade."
  alembic downgrade "$REVISAO_ANTERIOR"
elif [ "$ACTUAL" != "$REVISAO_ANTERIOR" ]; then
  falhar "a base está na revisão '$ACTUAL', esperava $REVISAO_ANTERIOR (a anterior) ou $REVISAO_NOVA."
fi

contar() {
  S="$(sql "SELECT count(*) FROM sessoes_exercicio;")"
  U="$(sql "SELECT count(*) FROM utilizadores;")"
}
contar; S0=$S; U0=$U
echo "    sessoes_exercicio: $S0 · utilizadores: $U0"

# --- Upgrade -----------------------------------------------------------------
echo "==> alembic upgrade head"
T0=$(date +%s)
alembic upgrade head
T1=$(date +%s)
contar; S1=$S; U1=$U
V1="$(sql "SELECT count(*) FROM sessoes_exercicio WHERE versao = 1;")"
VN="$(sql "SELECT count(*) FROM sessoes_exercicio WHERE versao IS DISTINCT FROM 1;")"
NOVAS_NAO_NULAS="$(sql "SELECT count(*) FROM sessoes_exercicio WHERE olho IS NOT NULL OR limiar IS NOT NULL OR sinais IS NOT NULL;")"
PERFIL_NAO_NULO="$(sql "SELECT count(*) FROM utilizadores WHERE px_por_mm IS NOT NULL OR olho_mais_fraco IS NOT NULL OR usa_oculos IS NOT NULL OR faixa_etaria IS NOT NULL;")"
CHECKS="$(sql "SELECT count(*) FROM pg_constraint WHERE conname IN ('ck_sessoes_exercicio_olho','ck_utilizadores_olho_mais_fraco','ck_utilizadores_faixa_etaria') AND convalidated;")"

# --- Downgrade e upgrade outra vez ------------------------------------------
echo "==> alembic downgrade -1"
alembic downgrade -1
contar; S2=$S; U2=$U
echo "==> alembic upgrade head (outra vez)"
alembic upgrade head
contar; S3=$S; U3=$U
FINAL="$(sql "SELECT version_num FROM alembic_version;" | tr -d '[:space:]')"

# --- Resumo ------------------------------------------------------------------
ok() { [ "$1" = "$2" ] && echo "OK" || { echo "FALHOU ($1 ≠ $2)"; FALHAS=$((FALHAS+1)); }; }
FALHAS=0
echo
echo "================ Resumo do ensaio ================"
echo "Base                         : $HOST/$NOME_BASE"
echo "Upgrade demorou              : $((T1-T0)) s"
echo "sessoes_exercicio antes/depois do upgrade : $S0 / $S1  -> $(ok "$S0" "$S1")"
echo "utilizadores antes/depois do upgrade      : $U0 / $U1  -> $(ok "$U0" "$U1")"
echo "Linhas antigas com versao=1               : $V1 de $S0  -> $(ok "$V1" "$S0")"
echo "Linhas com versao diferente de 1          : $VN  -> $(ok "$VN" "0")"
echo "Sessões antigas com campos novos preenchidos: $NOVAS_NAO_NULAS  -> $(ok "$NOVAS_NAO_NULAS" "0")"
echo "Utilizadores com perfil visual preenchido : $PERFIL_NAO_NULO  -> $(ok "$PERFIL_NAO_NULO" "0")"
echo "CHECKs novos criados e validados          : $CHECKS de 3  -> $(ok "$CHECKS" "3")"
echo "Contagens depois do downgrade             : $S2 / $U2  -> $(ok "$S2/$U2" "$S0/$U0")"
echo "Contagens depois do 2.º upgrade           : $S3 / $U3  -> $(ok "$S3/$U3" "$S0/$U0")"
echo "Revisão final                             : $FINAL  -> $(ok "$FINAL" "$REVISAO_NOVA")"
echo "=================================================="
[ "$FALHAS" = 0 ] && echo "Ensaio sem falhas." || { echo "$FALHAS verificação(ões) falharam."; exit 1; }
