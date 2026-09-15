# Janelas Para a Alma — Guia de Desenvolvimento

> Este ficheiro é lido automaticamente pelo Claude Code sempre que alguém abre o projecto.
> É a fonte única das regras de desenvolvimento. Se uma regra aqui entrar em conflito com
> um hábito antigo do código, **esta regra ganha** — e o código antigo deve ser corrigido
> quando for tocado.

---

## 0. Este repositório é uma reescrita de infraestrutura — não um projecto novo

Este monorepo substitui o repositório antigo (`janelasparaalma`, mantido intacto como
arquivo/histórico). O produto, as páginas, os exercícios, as regras de negócio e as
lições aprendidas com bugs reais **mantêm-se** — só a infraestrutura por baixo muda:

| | Antigo | Aqui |
|---|---|---|
| Auth | Supabase Auth | Serviço próprio (`api/app/services/auth_service.py`), JWT próprio |
| Base de dados | Supabase Postgres + RLS | Postgres próprio (Cloud SQL em produção), sem RLS — autorização vive na API |
| Storage | Supabase Storage | Cloudflare R2 (compatível com S3) |
| Frontend | Vercel (build antigo, Lovable) | **Vercel** (conta e CI/CD próprios do projecto, domínio `janelasparaalma.com`) — reaproveitado deliberadamente, ver nota abaixo |
| Deploy do frontend | Vercel + Supabase cloud | Vercel, automático a cada push/merge em `main` |
| Deploy da API | Vercel + Supabase cloud | Container Docker no Google Cloud Run, manual (`infra/gcloud/`) |

**Nota sobre o Vercel (decidido em 2026-09-13):** o frontend saiu do Vercel do projecto
antigo, mas **volta a usar o Vercel** — desta vez com conta e CI/CD próprios do Lukeny,
já ligados ao domínio `janelasparaalma.com`. Não é reverter a decisão da Sprint 0: a API,
a base de dados e o storage continuam inteiramente fora do Supabase. O que muda é só quem
serve o build estático — Cloud Run com um container NGINX próprio deixou de fazer sentido
quando já havia CI/CD pago e a funcionar no Vercel para exactamente essa função. Ver §2
para como isto preserva o cookie `httpOnly` de sessão (§3b) sem introduzir CORS a sério.

**Decisão explícita do dono do projecto: sem importação de dados de utilizadores do
Supabase.** Esta base de dados nasce vazia — não há migração de contas nem de hashes de
password a validar. O que se espelha é a **estrutura** (tabelas, colunas, tipos), extraída
de `supabase/migrations/*.sql` e `types.ts` do repositório antigo — não os dados.

Duas correcções deliberadas em relação ao esquema antigo, decididas ao arrancar do zero
em vez de arrastadas como dívida (ver `api/app/repositories/orm_models.py`):

1. **`utilizadores` funde identidade e perfil.** O Supabase tinha `auth.users` (gerido por
   eles) e `profiles` (nosso) como duas tabelas ligadas por FK 1:1. Sem Supabase Auth, essa
   separação deixou de ter razão de ser.
2. **`papel` é uma única coluna enum.** O projecto antigo tinha `profiles.papel` (texto) e
   `user_roles` (enum) como duas fontes paralelas — dívida conhecida, nunca corrigida.
   Ao começar do zero, a correcção certa é não a reproduzir. **Premium não é um papel:**
   é um estado de subscrição (`utilizadores.premium_ativo` + `premium_expira_em`),
   ortogonal ao `papel` — um `estrabico` pode ter Premium sem deixar de ser `estrabico`.
   Activado por `PremiumService` ao aprovar um pagamento (W-11); a validade é sempre
   verificada na leitura, não há job a desligar nada.

Foi também removida toda a integração específica do Lovable.dev (`src/lib/mcp/`,
`@lovable.dev/*`, `lovable-tagger`, a rota `/.lovable/oauth/consent`) — glue da IDE cloud
onde o projecto nasceu, sem função nenhuma fora dela, e responsável por um incidente real
(`mcpPlugin()` corrompia `supabase/functions/mcp/index.ts` silenciosamente em builds
locais). Ver histórico do repositório antigo se for preciso consultar o que fazia.

---

## 1. O que é este projecto

Plataforma angolana de saúde visual focada em estrabismo e ambliopia:

- **Rastreio ocular** por webcam (MediaPipe FaceMesh) — deteta sinais, encaminha para clínica
- **Exercícios de terapia visual** com rastreio ocular — 4 gratuitos, 8 premium (3 construídos)
- **Modelo freemium** — Premium a 15.000 Kz/mês (pagamento por transferência + comprovativo)
- **Rede de clínicas parceiras**, doações, programa de voluntariado, painel administrativo

Público-alvo inclui **crianças**. Todo o tratamento de dados deve assumir isso.

Idioma do produto e do código: **português (pt-PT)**. Nomes de colunas, rotas e variáveis
de domínio em português. Não introduzir inglês em nomes de domínio novos.

---

## 2. Arquitectura

```
BROWSER (React + Vite + TS)
   │
   └─→ VERCEL ── serve o build estático em janelasparaalma.com, deploy automático
         │        (rewrite estático em vercel.json, sem servidor nosso pelo meio)
         │
         └─→ /api/* ──→ API PRÓPRIA (FastAPI, container, Cloud Run)
                            │
                            ├─→ Postgres próprio (Cloud SQL)      dados, tudo
                            ├─→ Cloudflare R2                      ficheiros (avatares, etc.)
                            └─→ Auth próprio (JWT, argon2)         login, identidade
```

**Não há RLS.** Sem Supabase, não há `auth.uid()` a chegar ao Postgres. Consequência
directa: a fronteira de autorização é inteiramente a API — não existe "acesso directo
seguro" ao Postgres a partir do browser, porque essa segurança dependia do RLS que já não
existe. Isto simplifica a regra de ouro da secção seguinte.

Localmente: `docker-compose.yml` sobe só `db` + `api` — o frontend não tem container
próprio (ver nota do Vercel em §0). Para desenvolvimento do dia-a-dia do frontend,
`npm run dev` dentro de `frontend/` continua a ser o caminho — mais rápido, com hot
reload real, e o proxy do Vite já reencaminha `/api/*` tal como o Vercel faz em produção.

O browser fala **sempre com `/api/*` na mesma origem** — nunca com um URL absoluto da
API. Em dev (`npm run dev`) o proxy do Vite (`vite.config.ts`) reencaminha `/api/*` para
`http://localhost:8000`. Em produção, `frontend/vercel.json` faz o mesmo por um
`rewrite` (proxy do lado do Vercel, não um redirect — o browser nunca vê o domínio da
API): `/api/*` → o URL público `https://` do serviço da API no Cloud Run. Esse URL só se
conhece depois do primeiro deploy da API, tal como acontecia antes com o `API_URL` do
NGINX — só que agora fica escrito directamente em `vercel.json` (não há `envsubst`: o
Vercel não passa uma variável de ambiente para dentro do ficheiro de rewrites, o valor
tem de estar commitado). Nada de URL de API baked no *bundle* JS; `VITE_API_URL` só
existe para apontar o `npm run dev` a uma API remota. É esta partilha de origem —
mantida pelo rewrite do Vercel exactamente como antes pelo NGINX — que torna o cookie
`httpOnly` de sessão viável (§3b) sem CORS a sério; o CORS na API (`frontend_origins`)
fica só como rede de segurança para pedidos verdadeiramente cross-origin.

Produção da API (Cloud Run): scripts de provisionamento e deploy em `infra/gcloud/` (ver
o `README.md` lá). **Decisão do dono do projecto (2026-09-15): o deploy da API passa a
ser automático**, tal como o do frontend — um push/merge para `main` builda a imagem,
migra o esquema e actualiza o Cloud Run sozinho (job `deploy-api` em
`.github/workflows/ci.yml`), sem pausa manual. Ver §9 e §10 para o detalhe e a rede de
segurança que fica no lugar dessa pausa — não é a mesma coisa que "sem cuidado nenhum".
Antes disto o deploy era sempre manual (`infra/gcloud/04-deploy.sh`/`05-migrate.sh`
corridos à mão); esses scripts continuam a existir e a funcionar exactamente na mesma,
para quem preferir correr um deploy fora do fluxo automático.

---

## 3. Regra de ouro: onde vive cada lógica

> **Pergunta a fazer sempre: "o utilizador podia mentir sobre isto?"**
> Se sim → é lógica de negócio, vive num `service` da API, com teste.
> Se não → é só leitura/gravação simples, o router chama o repository directamente.

Sem RLS, **tudo passa pela API** — a distinção que existia no projecto antigo entre "vai
directo ao Supabase" e "passa pela API" não se aplica aqui. A distinção que continua a
importar é dentro da própria API:

| Fica num `router` fino, direto ao repository | Exige um `service` com regras e testes |
|---|---|
| Ler o meu perfil | Confirmar um pagamento |
| Ler o meu histórico de sessões | Activar/revogar acesso Premium |
| Gravar uma sessão de exercício | Calcular o diagnóstico do scanner |
| Ler banners e conteúdo público | Processar encomendas, decidir candidaturas |

Se houver dúvida sobre onde algo pertence, **pertence a um `service`, com teste primeiro**.

---

## 4. Segurança — regras não negociáveis

O projecto antigo já teve um incidente real: a tabela `scanner_analyses` esteve acessível
publicamente (RLS desligada apesar de existirem políticas). Aqui não há RLS para desligar
por engano — mas a lição generaliza: **nunca assumir que uma camada de protecção está
activa; verificar e testar isso explicitamente.**

1. **Toda a autorização é explícita e testada na API.** Um endpoint que lê ou escreve dados
   de um utilizador confirma sempre que o `utilizador_id` do JWT é o dono do recurso (ou que
   quem pede tem `papel == admin`) — nunca confiar num id vindo do corpo do pedido.
2. **Password: sempre com hash (argon2), nunca texto simples, nem em log.** Ver
   `api/app/core/security.py`.
3. **JWT: access token de vida curta, refresh token separado.** Nunca um token só, de vida
   longa, a fazer os dois papéis.
3b. **A sessão viaja em cookies `httpOnly`, nunca no corpo JSON nem em `localStorage`.**
   Decisão da Sprint 1, possível porque o NGINX já faz proxy de `/api/*` (frontend e API
   partilham origem aos olhos do browser). Um token que o JavaScript nunca consegue ler
   não pode ser roubado por XSS — relevante com público infantil. Ver
   `api/app/routers/auth.py`.
3c. **Um papel que o utilizador escolhe para si próprio (registo) é validado no schema
   Pydantic contra uma lista fechada de papéis permitidos** (`PAPEIS_AUTO_REGISTAVEIS` em
   `schemas/auth.py`) — nunca confiar que a interface (`<Select>`) é o único caminho para
   chegar ao endpoint. Um pedido forjado a enviar `papel: "admin"` tem de ser rejeitado
   pela API, não só escondido no formulário.
4. **Nunca guardar fotografias do scanner a longo prazo.** Processar → extrair medições →
   descartar a imagem. São imagens faciais de crianças: não guardar é sempre mais
   defensável do que guardar bem.
4b. **Ficheiros que o utilizador envia (avatar) vão directos ao R2, nunca através da API.**
   A API só assina um URL de `PUT` temporário (`repositories/storage.py` +
   `services/upload_service.py`); o browser envia os bytes ao R2 e depois pede à API para
   confirmar. A API valida que a chave a confirmar pertence ao próprio utilizador
   (`avatares/{utilizador_id}/...`) antes de a gravar. Menos uma cópia de imagens de
   crianças a passar pelos nossos servidores e logs.
5. **Nunca escrever segredos no frontend nem os comitar em `.env`.** O repositório antigo
   teve `.env` rastreado em `main` durante meses (chave pública do Supabase — não crítico
   por ser uma chave `anon`, mas errado de qualquer forma). Este repositório nasce com
   `.env` no `.gitignore` desde o primeiro commit — não repetir esse erro.
6. **Nunca correr `docker compose` de produção com os segredos de desenvolvimento.** Os
   valores em `docker-compose.yml` e `.env.example` são só para local.

---

## 5. Antes de escrever qualquer código — checklist obrigatória

- [ ] **O esquema da tabela foi confirmado contra `api/app/repositories/orm_models.py` e
      a migração Alembic correspondente?** Nunca assumir a forma de uma tabela de memória.
- [ ] **Já existe um service/repository/componente que faz isto?** Procurar antes de criar.
- [ ] **Esta alteração toca o esquema de dados, autorização ou paywall?**
      Se sim, é trabalho de risco alto: exige revisão humana antes de correr em produção.
- [ ] **Um router está a falar directamente com a base de dados?** Não devia — passa
      sempre por um repository, e a regra de negócio (se houver) vive num service.

---

## 6. Armadilhas já verificadas (herdadas do projecto antigo — continuam a aplicar-se)

Erros reais que já aconteceram neste produto. A infraestrutura mudou; estas lições não.

### Dados

- **Nunca mostrar sucesso antes de verificar `error`/excepção.**
  O bug mais grave já encontrado no projecto antigo: o fluxo de doações mostrava "Doação
  registada!" mesmo quando a gravação falhava. Todo o caminho que grava dados verifica o
  erro explicitamente, e nunca avança para UI de sucesso a partir de um `catch`.

- **`has_role`/verificação de papel deve ter uma única implementação.**
  O projecto antigo teve duas versões sobrepostas de uma função SQL `has_role()` e isso
  causou `PGRST203`. Aqui a verificação de papel vive em Python, num único sítio —
  a dependency `obter_utilizador_admin` em `api/app/core/dependencies.py` (401 sem
  sessão, 403 se `papel != "admin"`). Rotas de admin declaram
  `Depends(obter_utilizador_admin)`; não duplicar a comparação de papel por endpoint.
  A base de dados nasce sem admins e o registo não deixa ninguém escolher `admin`
  (§3c) — o primeiro cria-se por linha de comando (`python -m app.criar_admin <email>`);
  a partir daí um admin promove outros por `POST /admin/utilizadores/promover`.

### React / estado

- **Padrão "hidratar uma vez".** Formulários inicializados a partir de um Context devem
  hidratar **uma única vez** (`useRef` de controlo), nunca a cada mudança de referência do
  Context — um `setProfile()` noutro sítio já apagou silenciosamente o que o utilizador
  estava a escrever. Ver `EditarPerfil.tsx` e `Configuracoes.tsx`.

- **Contextos, não hooks por componente**, para estado partilhado entre páginas e Navbar.

### Testes (Vitest)

- **`vi.mock` factories: nunca referenciar um `const`/`class` externo directamente** —
  `vi.mock(...)` é hoisted para o topo do ficheiro, por isso qualquer binding declarado
  fora dele ainda está em TDZ quando a factory corre. Funções: envolver em arrow function
  (`getX: () => getX()`). Classes usadas para `instanceof` (ex.: uma classe de erro):
  evitar `instanceof` através de um módulo mockado por completo — usar duck-typing (ex.:
  verificar uma propriedade como `status`) no código de produção, para o teste nem
  precisar de reconstruir a classe real. Ver `AuthContext.tsx`/`AuthContext.test.tsx`.

### Animação / exercícios

- **Nunca misturar CSS `transition`/`animate-*` com uma propriedade actualizada por
  `requestAnimationFrame`.** Causou um engasgo visível no exercício de Acompanhamento.
- **Ângulos periódicos devem ser contínuos.** Nunca `elapsed % duracao` antes de
  `Math.sin`/`Math.cos` — já são periódicos; o módulo criava um salto visível por ciclo.
- **Suavizar antes de amplificar, nunca depois.**
- **Motor de exercícios:** `BaseExercise` + `useEyeTracking` + **um único**
  `requestAnimationFrame` por exercício. Qualquer exercício novo segue este padrão.

### Build / ferramentas

- **A dependência do Lovable.dev (`mcpPlugin()`) já corrompeu ficheiros silenciosamente
  fora do ambiente deles.** Foi removida por completo neste repositório — não voltar a
  introduzir plugins de build ligados a uma IDE cloud específica sem entender exactamente
  o que fazem fora dela.

---

## 7. Estrutura da API Python (FastAPI)

```
api/
  app/
    routers/       recebe o pedido HTTP, valida entrada, devolve resposta   (≈ Controller)
    services/      regras de negócio — o valor real do sistema
    repositories/  acesso a dados (Postgres) + modelos SQLAlchemy            (≈ Model)
    schemas/       formas dos dados (Pydantic)
    core/          config, segurança (hash, JWT)
    db.py          engine/sessão do SQLAlchemy
  alembic/          migrações — versionadas, nunca editadas depois de aplicadas
  tests/            espelha app/
```

Regras:

- **Um router nunca fala directamente com a base de dados.** Passa sempre por um
  repository; se houver regra de negócio, por um service.
- **Um service nunca sabe o que é HTTP.** Sem `Request`, sem `HTTPException` — devolve
  resultados ou levanta erros de domínio (excepções próprias); o router traduz para HTTP.
- **Um repository implementa um `Protocol`**, não é referenciado directamente pelo service
  — é o que torna o service testável sem base de dados (ver `auth_service.py` +
  `test_auth_service.py` como padrão de referência).
- **Toda a entrada é validada com Pydantic.** Nada de `dict` solto vindo do cliente.
- **Testes com `pytest`** para cada service novo — sem excepção.

---

## 8. Testes — nenhum código entra sem eles

> **Nenhum PR entra em `main` sem testes que cubram a lógica que acrescenta ou altera.**
> Um PR que corrige um bug traz obrigatoriamente o teste que reproduz esse bug.

### O que tem obrigatoriamente teste

- **Todo o service da API** (`app/services/`) — sem excepção.
- **Tudo o que decide acesso, dinheiro ou resultado clínico.**
- **Toda a correcção de bug** — o teste que reproduz o bug, escrito primeiro.
- **Funções de cálculo** — suavização do olhar, conversões, validações.

### O que não precisa

Componentes puramente visuais, estilos, layout.

### Unitário vs integração

| | O que testa | Exemplo |
|---|---|---|
| **Unitário** | Uma função/service isolado, sem base de dados nem rede | `AuthService.autenticar` com repositório falso |
| **Integração** | Um percurso completo, com as peças ligadas | Submeter uma doação com a gravação a falhar **não** mostra ecrã de sucesso |

> **Regra prática:** todo o fluxo que grava dados precisa de um teste que verifique **o
> caminho do erro**, não apenas o do sucesso.

### Frontend — Vitest + Testing Library

Ficheiros em `frontend/src/**/*.test.ts(x)`. Correr com `npm run test` dentro de `frontend/`.

### API — pytest

Ficheiros em `api/tests/`, a espelhar `api/app/`.

- **Services** testam-se directamente, com um repositório falso (`Protocol`), sem HTTP.
- **Routers** testam-se com `TestClient`, incluindo códigos de erro (401, 403, 422, 409).
- **Nunca correr testes contra a base de dados de produção.**

---

## 9. Git

**Branches:** `<área>/<descricao-curta-kebab>` — ex.: `api/auth-service`, `infra/docker-compose`.
Uma branch = um pacote de trabalho.

**Commits:** Conventional Commits com âmbito
```
feat(auth): adiciona endpoint de registo e login
fix(paywall): remove bypass temporário do Premium
chore(infra): adiciona docker-compose para desenvolvimento local
```

**Portão de entrada para `main`:**
1. PR obrigatório — nunca commit directo em `main`
2. CI verde: `npm run lint` + `npm run test` + `npm run build` (frontend);
   `ruff check` + `pytest` + `alembic upgrade head` contra um Postgres real (api);
   `docker build` da imagem da API (imagens) — ver `.github/workflows/ci.yml`. O deploy
   do frontend em si é o Vercel, fora deste CI — o `npm run build` aqui é só o portão de
   qualidade antes do merge, não o que corre em produção
3. **Testes novos para a lógica nova** — CI verde não chega
4. Revisão humana obrigatória em tudo o que toque: esquema de dados (`orm_models.py` +
   migração Alembic), autenticação, paywall, papéis de utilizador
5. **Migrações Alembic em produção — decisão do dono do projecto (2026-09-15):** passam
   a correr sozinhas a seguir ao merge (job `deploy-api`), sem uma segunda pausa manual
   depois disso. A confirmação humana continua a existir, só que já não é um passo à
   parte — é a própria revisão do PR (ponto 4): quem aprova o merge já viu a migração e
   o esquema resultante. Rede de segurança automática a seguir a esse ponto: o CI (ponto
   2) já correu essa mesma migração contra um Postgres real antes de sequer chegar aqui,
   e `05-migrate.sh` tira sempre um backup do Cloud SQL logo antes de migrar a sério. Ver
   §2 e §10.

---

## 10. Nunca fazer sem confirmação humana explícita

- Alterar a lógica de paywall ou de papéis de utilizador
- Apagar dados de utilizadores
- Alterar dados bancários ou preços
- Rodar o `JWT_SECRET_KEY` de produção sem plano de invalidar sessões activas

**Já não está nesta lista, de propósito:** correr migrações Alembic em produção. Até
2026-09-14 estava aqui — o dono do projecto decidiu deixar de exigir uma pausa manual
separada depois do merge, para o deploy do backend acompanhar o do frontend (automático
a cada push/merge para `main`, ver §2/§9). A confirmação humana não desapareceu, mudou
de sítio: acontece na revisão do PR (§9 ponto 4), reforçada por três redes automáticas —
`alembic upgrade head` já corre no CI antes do merge (§9 ponto 2), `05-migrate.sh` tira
sempre um backup do Cloud SQL antes de migrar a sério, e o deploy da API só acontece
depois da migração correr sem erro. Ver `infra/gcloud/06-ci-cd-setup.sh` para o desenho
completo (Workload Identity Federation, sem chaves de longa duração).

---

## 11. Dívida conhecida (não é padrão — é para corrigir)

Estado herdado do projecto antigo — o código ainda não foi todo migrado para a API nova.
Não imitar estes padrões enquanto a migração módulo-a-módulo decorre (ver `docs/BACKLOG.md`):

| Onde | Problema |
|---|---|
| `frontend/src/integrations/supabase/*` | Ainda chama o Supabase directamente — a substituir por um cliente da API própria, módulo a módulo |
| `Scanner.tsx` | O "diagnóstico" é `Math.random()` — não é calculado a partir de medições |
| `Exercicios.tsx`, `BaseExercise.tsx` | Paywall Premium ainda desligado por bypass (`temAcessoPremium = true`) — a activação já existe (W-11), falta só virar a chave, num PR isolado |
| `ClinicalPartners.tsx` | Formulário de agendamento não persiste nada — só mostra um toast |
| `DashboardUser.tsx` | Parte dos números são valores fixos, não dados reais |
| `Produto.tsx` | Catálogo de óculos é mock — sem carrinho nem checkout |

---

## 12. Este ficheiro é vivo — mantém-no sincronizado

Qualquer PR que mude o modelo de dados (`orm_models.py` + migração), a arquitectura, ou
configuração de infraestrutura (`docker-compose.yml`, Dockerfiles, CI) **actualiza este
ficheiro no mesmo PR**. Não é um "seria bom" — é portão de entrada, ver secção 9.

---

## 13. Organização — onde vive cada coisa nova

| Tipo de ficheiro | Vive em | Convenção de nome |
|---|---|---|
| Página React | `frontend/src/pages/` | `PascalCase.tsx` |
| Componente partilhado | `frontend/src/components/` | `PascalCase.tsx` |
| Hook | `frontend/src/hooks/` | `useAlgumaCoisa.ts` |
| Teste (frontend) | ao lado do ficheiro testado | `Nome.test.tsx` |
| Router da API | `api/app/routers/` | `snake_case.py`, um por área |
| Service da API | `api/app/services/` | `algo_service.py` |
| Repository da API | `api/app/repositories/` | `algo_repository.py` |
| Modelo SQLAlchemy | `api/app/repositories/orm_models.py` | uma classe por tabela |
| Migração Alembic | `api/alembic/versions/` | gerada por `alembic revision`, nunca editada à mão depois de aplicada em qualquer ambiente partilhado |
| Teste (API) | `api/tests/`, espelhando `api/app/` | `test_algo.py` |
| Documentação de processo | `docs/` | `MAIUSCULAS.md` para os que são referência viva (`BACKLOG.md`) |

O projecto usa **npm** (frontend) e **pip + pyproject.toml** (api) exclusivamente.
Lockfiles de outros gestores (`bun.lock`, `yarn.lock`, `pnpm-lock.yaml`) nunca são
comitados — ver `.gitignore`.
