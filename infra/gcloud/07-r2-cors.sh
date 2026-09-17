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
python3 - <<PYEOF
import boto3
from botocore.config import Config

client = boto3.client(
    "s3",
    endpoint_url="${R2_ENDPOINT_URL}",
    aws_access_key_id="${R2_ACCESS_KEY_ID}",
    aws_secret_access_key="${R2_SECRET_ACCESS_KEY}",
    config=Config(signature_version="s3v4"),
    region_name="auto",
)

cors_config = {
    "CORSRules": [
        {
            # O apex (sem "www.") faz 308 para "www." em produção -- aos
            # olhos do browser são origens diferentes, por isso as duas têm
            # de estar aqui, não só o domínio "canónico". Confirmar com
            # `curl -sI https://<dominio>` se algum dia isto mudar.
            "AllowedOrigins": [
                "https://${FRONTEND_DOMAIN}",
                "https://www.${FRONTEND_DOMAIN}",
                "http://localhost:8080",
                "http://localhost:5173",
            ],
            "AllowedMethods": ["PUT", "GET", "HEAD"],
            "AllowedHeaders": ["content-type"],
            "MaxAgeSeconds": 3600,
        }
    ]
}

client.put_bucket_cors(Bucket="${R2_BUCKET}", CORSConfiguration=cors_config)
print("CORS aplicado a ${R2_BUCKET}:")
print(client.get_bucket_cors(Bucket="${R2_BUCKET}"))
PYEOF

echo "==> Feito."
