# Deploy no Google Cloud Run

Scripts de provisionamento e deploy **da API**. O frontend não está aqui — é servido
pelo Vercel (conta e CI/CD próprios, domínio `janelasparaalma.com`), com deploy
automático a cada push/merge em `main`; ver `CLAUDE.md` §0/§2.

**Desde 2026-09-15, o deploy da API é automático** — um push/merge em `main` builda a
imagem, migra o esquema e actualiza o Cloud Run sozinho (job `deploy-api` em
`.github/workflows/ci.yml`), decisão do dono do projecto para o backend acompanhar o
frontend (ver `CLAUDE.md` §2/§9/§10 para o porquê e a rede de segurança). Estes scripts
continuam a existir e a funcionar exactamente na mesma para quem precisar de correr um
deploy à mão (fora do fluxo automático, ou antes de ele existir — ver "Ordem" abaixo).

> Se vires um deploy da API a acontecer no `git push` sem ter sido por aqui, confirma
> se não é um **trigger do Cloud Build** à parte (Console → Cloud Build → Triggers) —
> não deviam coexistir os dois a fazer a mesma coisa.

## Pré-requisitos

- `gcloud` CLI autenticado (`gcloud auth login`) com permissões de Owner/Editor no projecto.
- `python` no PATH (o `03-secrets.sh` usa-o para gerar o `JWT_SECRET_KEY`).
- Um projecto GCP com facturação activa (o Cloud Run e o Cloud SQL exigem cartão
  registado mesmo dentro do escalão gratuito).
- `gh` CLI autenticado (só para o `06-ci-cd-setup.sh`, que escreve a configuração
  directamente no repositório GitHub).

## Ordem

```sh
cp 00-config.example.sh 00-config.sh      # e preencher PROJECT_ID, REGION, ...
export SQL_PASSWORD='<password forte da DB>'

./01-bootstrap.sh     # activa APIs + cria o Artifact Registry
./02-cloud-sql.sh     # instância Postgres + base de dados + utilizador
./03-secrets.sh       # segredos no Secret Manager (DATABASE_URL, JWT, R2, Resend)
./07-r2-cors.sh       # CORS do bucket R2 -- sem isto, upload directo (avatar/
                       # comprovativos) falha sempre no browser, mesmo com
                       # credenciais e endpoint correctos (ver o próprio script)
./05-migrate.sh       # alembic upgrade head -- primeiro esquema, ANTES do primeiro deploy
./04-deploy.sh        # build da imagem + deploy da API

export GITHUB_REPO='projectossociais/janelas_para_alma_gcloud'
./06-ci-cd-setup.sh   # liga o GitHub Actions ao GCP -- só depois disto o push/merge
                       # em main passa a fazer os dois passos acima sozinho
```

`01`–`03` e `06` correm-se uma vez (são idempotentes; podem repetir-se sem estragar
nada). `04`/`05` só precisas de os correr à mão antes do `06-ci-cd-setup.sh` existir, ou
sempre que quiseres forçar um deploy fora do fluxo automático (`05` sempre antes do
`04` — uma migração tem de aplicar-se contra o esquema antigo antes do código novo
começar a servir pedidos com ele).

Depois do primeiro `04-deploy.sh` (manual ou automático): se o `API_URL` mudou (primeiro
deploy, ou serviço recriado), actualizar o `rewrite` de `/api/*` em
`frontend/vercel.json` com o novo URL e voltar a fazer deploy do frontend — esse passo
não está aqui, é directo no Vercel (push/merge em `main`, ou `vercel --prod` local se
precisares de forçar fora do fluxo normal).

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

## CI/CD (`06-ci-cd-setup.sh`)

Liga o GitHub Actions ao GCP por **Workload Identity Federation** — o GitHub prova quem
é com um token OIDC de vida curta (assinado por ele próprio), o GCP confia nessa prova
para um repositório específico, e nunca há uma chave JSON de service account a existir
em lado nenhum (nem como ficheiro, nem como GitHub Secret) para poder vazar. O script:

1. Cria o Workload Identity Pool + Provider OIDC, restrito ao repositório exacto
   (`attribute-condition`) — nenhum outro repositório, fork incluído, consegue pedir
   para personificar o service account de deploy.
2. Cria o service account `jpa-deploy`, com só os papéis que o build + deploy + migração
   precisam (`run.admin`, `cloudbuild.builds.editor`, `cloudsql.editor`,
   `iam.serviceAccountUser`) — não é dono do projecto, não gere Secret Manager, não toca
   IAM de outros service accounts.
3. Escreve a configuração resultante como **Variables** do repositório GitHub (`gh
   variable set`) — nenhuma delas é secreta (nomes de projecto, região, emails), por
   isso não há nada a esconder nos logs.

Corre-se uma vez, depois do `01`–`03`. A partir daí, o job `deploy-api` do
`.github/workflows/ci.yml` já tem tudo o que precisa a cada push/merge em `main`.

## Por resolver antes do primeiro deploy real a sério

1. ~~**Domínio próprio + certificado**~~ — **resolvido**: `janelasparaalma.com` já
   aponta para o Vercel. A API continua no URL `*.run.app` do Cloud Run (não precisa de
   domínio próprio — o browser nunca o vê directamente, só através do rewrite).
2. ~~**Cloudflare R2**~~ — **resolvido**: credenciais, env vars e CORS do bucket
   (`07-r2-cors.sh`) configurados; avatar e comprovativos usam upload directo.
3. **`--allow-unauthenticated`** está ligado no serviço da API (é um site público).
   Rever se algum dia houver endpoints que não devam ser expostos directamente.

## Custo

`db-f1-micro` + o serviço Cloud Run da API com `min-instances=0` cabem, com folga, no
uso típico de arranque. O frontend no Vercel tem custo/plano à parte, fora deste
projecto GCP. O que custa no lado GCP é manter a API com instância quente — não pôr
`min-instances>0` sem intenção. Anotar a data de expiração de qualquer crédito de trial
(ver `docs/BACKLOG.md`).
