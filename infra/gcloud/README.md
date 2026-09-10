# Deploy no Google Cloud Run

Scripts de provisionamento e deploy. **Nenhum deles corre sozinho no `git push`** —
não há CI de deploy neste repositório (ver `.github/workflows/ci.yml`: só lint, testes
e build). O deploy é sempre manual, a partir daqui.

> Se vires um deploy a acontecer no `git push`, é um **trigger do Cloud Build** ligado
> ao repositório do lado da GCP (Console → Cloud Build → Triggers), configurado fora
> deste repo. Estes scripts são a alternativa explícita e versionada a esse trigger.

## Pré-requisitos

- `gcloud` CLI autenticado (`gcloud auth login`) com permissões de Owner/Editor no projecto.
- `python` no PATH (o `03-secrets.sh` usa-o para gerar o `JWT_SECRET_KEY`).
- Um projecto GCP com facturação activa (o Cloud Run e o Cloud SQL exigem cartão
  registado mesmo dentro do escalão gratuito).

## Ordem

```sh
cp 00-config.example.sh 00-config.sh      # e preencher PROJECT_ID, REGION, ...
export SQL_PASSWORD='<password forte da DB>'

./01-bootstrap.sh     # activa APIs + cria o Artifact Registry
./02-cloud-sql.sh     # instância Postgres + base de dados + utilizador
./03-secrets.sh       # segredos no Secret Manager (DATABASE_URL, JWT, R2)
./04-deploy.sh        # build das imagens + deploy da API e do frontend
./05-migrate.sh       # alembic upgrade head (pára e pede confirmação — CLAUDE.md §10)
```

`01`–`03` correm-se uma vez (são idempotentes; podem repetir-se sem estragar nada).
`04` corre-se a cada deploy. `05` só quando há migrações novas por aplicar.

## Como as peças ligam

```
utilizador ─HTTPS─> jpa-frontend (Cloud Run, NGINX + build estático)
                        │  /api/*  ─proxy (envsubst ${API_URL})─┐
                        │                                       v
                        └───────────────────────────> jpa-api (Cloud Run, uvicorn)
                                                          │ unix socket /cloudsql/<conn>
                                                          v
                                                     Cloud SQL (Postgres)
```

- O browser fala **sempre** com `<frontend-url>/api/*` — mesma origem, para o cookie
  `httpOnly` de sessão funcionar (CLAUDE.md §3b). O `API_URL` real da API só entra no
  NGINX do frontend, em run-time, injectado pelo `04-deploy.sh`.
- A API liga-se ao Cloud SQL pelo socket unix `/cloudsql/<connection-name>` (a flag
  `--add-cloudsql-instances` do `gcloud run deploy`). O `DATABASE_URL` completo, com
  password, vive num único segredo (`jpa-database-url`).
- `AMBIENTE=producao` → os cookies de sessão passam a ter `Secure` (só HTTPS), ver
  `api/app/core/config.py`.

## Por resolver antes do primeiro deploy real a sério

1. **Domínio próprio + certificado** (`gcloud run domain-mappings`, ou um External
   HTTPS Load Balancer com regras de caminho se um dia se quiser um único domínio a
   servir os dois). Sem isto o site fica nos URLs `*.run.app`.
2. **Cloudflare R2** — o `03-secrets.sh` salta os segredos de R2 se não houver
   credenciais; enquanto isso, avatares e comprovativos ficam por migrar.
3. **`--allow-unauthenticated`** está ligado nos dois serviços (é um site público).
   Rever se algum dia houver endpoints que não devam ser expostos directamente.

> **NGINX → upstream HTTPS do Cloud Run: resolvido.** O `default.conf.template` já
> faz `proxy_ssl_server_name on` (SNI) e manda `Host: $proxy_host` (o Cloud Run
> encaminha pelo Host), com o host público em `X-Forwarded-Host`. Funciona igual
> contra `http://api:8000` (compose) e `https://<serviço>.run.app` (produção).

## Custo

`db-f1-micro` + dois serviços Cloud Run com `min-instances=0` cabem, com folga, no uso
típico de arranque. O que custa é manter instâncias quentes — não pôr `min-instances>0`
sem intenção. Anotar a data de expiração de qualquer crédito de trial (ver
`docs/BACKLOG.md`).
