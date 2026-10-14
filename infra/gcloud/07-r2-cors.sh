#!/usr/bin/env bash
# Configura o CORS do bucket R2 -- sem isto, o upload directo ao storage
# (avatar, comprovativos de doação/Premium) falha sempre no browser: o R2
# responde 403 "CORS not configured for this bucket" ao preflight OPTIONS
# que o fetch() dispara antes do PUT, e isso aparece como "não foi possível
# enviar a foto/o comprovativo" (ver EditarPerfil.tsx/Apoiar.tsx). É um
# ajuste no lado do bucket, não do código -- não fica visível em nenhum
# `git diff`, por isso este script existe para não se perder outra vez.
#
# Idempotente -- correr sempre que o bucket for recriado, ou noutro
# ambiente (ex.: um bucket de staging separado). Precisa de R2_ENDPOINT_URL,
# R2_BUCKET, R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY (ver 00-config.sh) e do
# boto3 (já é dependência da API).
set -euo pipefail
cd "$(dirname "$0")"
[ -f ./00-config.sh ] && source ./00-config.sh

[ -n "${R2_ENDPOINT_URL:-}" ] || { echo "ERRO: define R2_ENDPOINT_URL." >&2; exit 1; }
[ -n "${R2_ACCESS_KEY_ID:-}" ] || { echo "ERRO: define R2_ACCESS_KEY_ID." >&2; exit 1; }
[ -n "${R2_SECRET_ACCESS_KEY:-}" ] || { echo "ERRO: define R2_SECRET_ACCESS_KEY." >&2; exit 1; }

# As origens permitidas a fazer PUT/GET/HEAD directo ao bucket. Adicionar
# aqui qualquer domínio novo do frontend (ex.: um preview do Vercel) antes
# de o upload directo passar a falhar silenciosamente por CORS a partir
# dele -- não há rede de segurança para isto no lado da API.
[ -n "${FRONTEND_DOMAIN:-}" ] || { echo "ERRO: define FRONTEND_DOMAIN (ex.: janelasparaalma.com)." >&2; exit 1; }
export R2_ENDPOINT_URL R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY FRONTEND_DOMAIN
export R2_BUCKET="${R2_BUCKET:-}" R2_BUCKET_COMPROVATIVOS="${R2_BUCKET_COMPROVATIVOS:-}"

# Heredoc entre aspas: o bash não expande nada lá dentro (antes, as crases de
# um comentário eram executadas como comando), e as chaves chegam ao Python
# por variável de ambiente, nunca copiadas para o código.
python3 - <<'PYEOF'
import os
import sys

import boto3
from botocore.config import Config

client = boto3.client(
    "s3",
    endpoint_url=os.environ["R2_ENDPOINT_URL"],
    aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    config=Config(signature_version="s3v4"),
    region_name="auto",
)
dominio = os.environ["FRONTEND_DOMAIN"]

cors_config = {
    "CORSRules": [
        {
            # O apex (sem "www.") faz 308 para "www." em produção -- aos
            # olhos do browser são origens diferentes, por isso as duas têm
            # de estar aqui, não só o domínio "canónico". Confirmar com
            # "curl -sI https://<dominio>" se algum dia isto mudar.
            "AllowedOrigins": [
                f"https://{dominio}",
                f"https://www.{dominio}",
                "http://localhost:8080",
                "http://localhost:5173",
            ],
            "AllowedMethods": ["PUT", "GET", "HEAD"],
            "AllowedHeaders": ["content-type"],
            "MaxAgeSeconds": 3600,
        }
    ]
}

# O bucket privado dos comprovativos de pagamento também recebe PUT directo
# do browser (validação instantânea do Premium) -- precisa do mesmo CORS.
# Cada bucket à parte: um que não exista (ou que o token não veja) não
# impede o outro, mas o script termina com erro para não passar despercebido.
falhou = False
for bucket in [b for b in (os.environ["R2_BUCKET"], os.environ["R2_BUCKET_COMPROVATIVOS"]) if b]:
    try:
        client.put_bucket_cors(Bucket=bucket, CORSConfiguration=cors_config)
        regras = client.get_bucket_cors(Bucket=bucket)["CORSRules"]
        print(f"CORS aplicado a {bucket}: {regras}")
    except client.exceptions.NoSuchBucket:
        falhou = True
        print(f"ERRO: o bucket {bucket} não existe nesta conta (ou o token não o vê).", file=sys.stderr)
sys.exit(1 if falhou else 0)
PYEOF

echo "==> Feito."
