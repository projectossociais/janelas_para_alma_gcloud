# Deploy no Google Cloud Run

Scripts de provisionamento e deploy **da API**. O frontend não está aqui — é servido
pelo Vercel (conta e CI/CD próprios, domínio `janelasparaalma.com`), com deploy
automático a cada push/merge em `main`; ver `CLAUDE.md` §0/§2. **Nenhum destes scripts
corre sozinho no `git push`** — não há CI de deploy da API neste repositório (ver
`.github/workflows/ci.yml`: só lint, testes e build). O deploy da API é sempre manual,
a partir daqui.

> Se vires um deploy da API a acontecer no `git push`, é um **trigger do Cloud Build**
> ligado ao repositório do lado da GCP (Console → Cloud Build → Triggers), configurado
> fora deste repo. Estes scripts são a alternativa explícita e versionada a esse trigger.

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
./04-deploy.sh        # build da imagem + deploy da API
./05-migrate.sh       # alembic upgrade head (pára e pede confirmação — CLAUDE.md §10)
```

`01`–`03` correm-se uma vez (são idempotentes; podem repetir-se sem estragar nada).
`04` corre-se a cada deploy da API. `05` só quando há migrações novas por aplicar.

Depois do `04-deploy.sh`: se o `API_URL` mudou (primeiro deploy, ou serviço recriado),
actualizar o `rewrite` de `/api/*` em `frontend/vercel.json` com o novo URL e voltar a
fazer deploy do frontend — esse passo não está aqui, é directo no Vercel (push/merge em
`main`, ou `vercel --prod` local se precisares de forçar fora do fluxo normal).

## Como as peças ligam

```
utilizador ─HTTPS─> janelasparaalma.com (Vercel, build estático)
                        │  /api/*  ─rewrite (frontend/vercel.json)─┐
                        │                                          v
                        └──────────────────────────────> jpa-api (Cloud Run, uvicorn)
                                                             │ unix socket /cloudsql/<conn>
                                                             v
                                                        Cloud SQL (Postgres)
```

- O browser fala **sempre** com `janelasparaalma.com/api/*` — mesma origem, para o
  cookie `httpOnly` de sessão funcionar (CLAUDE.md §3b). O `rewrite` que faz esse proxy
  vive em `frontend/vercel.json`, versionado neste repositório — não há `envsubst`
  nem passo de deploy que o gere: o URL da API tem de estar escrito lá directamente,
  actualizado à mão sempre que mudar (raro — só no primeiro deploy ou se o serviço for
  recriado).
- A API liga-se ao Cloud SQL pelo socket unix `/cloudsql/<connection-name>` (a flag
  `--add-cloudsql-instances` do `gcloud run deploy`). O `DATABASE_URL` completo, com
  password, vive num único segredo (`jpa-database-url`).
- `AMBIENTE=producao` → os cookies de sessão passam a ter `Secure` (só HTTPS), ver
  `api/app/core/config.py`.
- `FRONTEND_ORIGINS` (env var da API, ver `00-config.example.sh` → `FRONTEND_DOMAIN`)
  é só a rede de segurança do CORS — o caminho normal nem a exercita, é mesma-origem
  via o rewrite acima.

## Por resolver antes do primeiro deploy real a sério

1. ~~**Domínio próprio + certificado**~~ — **resolvido**: `janelasparaalma.com` já
   aponta para o Vercel. A API continua no URL `*.run.app` do Cloud Run (não precisa de
   domínio próprio — o browser nunca o vê directamente, só através do rewrite).
2. **Cloudflare R2** — o `03-secrets.sh` salta os segredos de R2 se não houver
   credenciais; enquanto isso, avatares e comprovativos ficam por migrar.
3. **`--allow-unauthenticated`** está ligado no serviço da API (é um site público).
   Rever se algum dia houver endpoints que não devam ser expostos directamente.

## Custo

`db-f1-micro` + o serviço Cloud Run da API com `min-instances=0` cabem, com folga, no
uso típico de arranque. O frontend no Vercel tem custo/plano à parte, fora deste
projecto GCP. O que custa no lado GCP é manter a API com instância quente — não pôr
`min-instances>0` sem intenção. Anotar a data de expiração de qualquer crédito de trial
(ver `docs/BACKLOG.md`).
