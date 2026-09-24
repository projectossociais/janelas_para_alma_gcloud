# Backlog — Janelas Para a Alma

> **Registo do raciocínio, não o quadro do dia-a-dia.** Este ficheiro explica *porque*
> cada tarefa existe e nesta ordem. O tracker publicado (link partilhado à parte) é
> editável directamente na página — marcar, editar, adicionar tarefas e secções — e é
> aí que o estado corrente vive. Os dois podem divergir com o tempo: se alguém adicionar
> ou reescrever uma tarefa só no tracker, este ficheiro fica desactualizado nesse ponto
> até alguém o trazer aqui. Não é um erro do sistema, é o preço de o tracker ser editável
> sem passar por commit — mantém-se este ficheiro por ser o que chega sem login e o que
> fica no histórico do git.
>
> Vive no repositório de propósito: chega a toda a gente com `git pull`, não pede login,
> e fica versionado junto do código a que se refere.
>
> Contexto e justificação das decisões: [`README.md`](../README.md) · Regras de código
> e de arquitectura (sempre a manter sincronizado): [`CLAUDE.md`](../CLAUDE.md)

**Legenda de responsável:** `W` = Wilson (Dev A) · `L` = Lukeny (Dev B) · `W+L` = par

---

## Sprint 0 — Fundação da infraestrutura nova (2026-09-09)

Decisão do dono do projecto: sair do Supabase e do Vercel por completo — API própria em
FastAPI, Postgres próprio, storage em Cloudflare R2, tudo em containers no Google Cloud
Run. Sem importação de dados de utilizadores; a base de dados nasce vazia, só a estrutura
é espelhada. Detalhe completo em `CLAUDE.md` secção 0.

**Feito:**

- [x] Monorepo criado (`frontend/`, `api/`, `infra/`) — este repositório
- [x] `api/app/services/auth_service.py` — registo, login, refresh token, com 12 testes
      `pytest` (incluindo caminhos de erro: password errada, email duplicado, token
      confundido com o tipo errado)
- [x] Esquema de dados espelhado do repositório antigo — 16 tabelas em
      `api/app/repositories/orm_models.py`, migração Alembic baseline
- [x] Frontend copiado do repositório antigo, com a integração específica do Lovable.dev
      removida (`src/lib/mcp/`, plugins de build) — 9 testes a passar, lint sem regressões
- [x] `docker-compose.yml` + Dockerfiles (frontend com NGINX, api com uvicorn) + `nginx.conf`
- [x] CI (`.github/workflows/ci.yml`) — lint+test+build (frontend), ruff+pytest (api)

**Por fazer, nesta ordem:**

1. ~~**Correr a migração Alembic contra um Postgres real**~~ — feito a 2026-09-10 (Docker
   disponível). `alembic upgrade head` + `alembic check` contra Postgres a sério
   revelaram **drift** da baseline escrita à mão (ver "Baseline alinhada com o ORM" mais
   abaixo); corrigido numa migração aditiva, `alembic check` agora verde.
   > Nota de ambiente: nesta máquina há um PostgreSQL 18 do sistema no 5432. O
   > `docker-compose.override.yml` (não versionado) publica o container no 5433 e o
   > `api/.env` local aponta para lá. O `.gitignore` passou a ignorar o override.
2. ~~**Storage:** endpoint na API para emitir URLs assinadas do Cloudflare R2 (avatares).~~
   Feito a 2026-09-10 (ver "Upload de avatar via R2" mais abaixo). O código está escrito
   e testado contra um `Presigner` falso; falta só ligar credenciais reais do R2 e
   `R2_PUBLIC_BASE_URL` quando o bucket existir.
3. **Deploy no Cloud Run** — scripts de provisionamento e deploy escritos em
   `infra/gcloud/` (activação de APIs, Artifact Registry, Cloud SQL, Secret Manager,
   deploy dos dois serviços, migração via Cloud Run Job com confirmação humana). Falta:
   conta/projecto GCloud com facturação, e resolver o proxy NGINX → upstream HTTPS do
   Cloud Run (ou pôr frontend e API atrás de um domínio único) — ver
   `infra/gcloud/README.md`.

O que se segue abaixo desta secção é o backlog de produto herdado do repositório antigo —
continua válido *depois* de a API existir para o suportar.

---

## Sprint 1 — Autenticação de ponta a ponta (2026-09-09)

**Feito:**

- [x] Sessão por **cookie `httpOnly`**, não token em `localStorage` — decisão nova,
  possível porque o NGINX já faz proxy de `/api/*` (frontend e API partilham origem aos
  olhos do browser). Um XSS já não consegue roubar a sessão lendo `localStorage`.
- [x] `api/app/routers/auth.py`: `/auth/registar`, `/auth/entrar`, `/auth/eu`,
  `/auth/sair`, `/auth/atualizar-token` — 28 testes `pytest` (12 do service + 16 novos:
  8 de service para o registo com perfil, 8 de router com `TestClient` cobrindo cookies,
  401/409/422 e a dependency `obter_utilizador_atual` que protege rotas).
- [x] Registo recolhe nome/província/género/papel (o formulário já os pedia) —
  `papel` validado no schema Pydantic contra uma lista de papéis auto-registáveis
  (`comum`, `estrabico`, `profissional`); "admin" enviado directamente à API é
  rejeitado com 422, não só escondido no `<Select>` do formulário.
- [x] `frontend/src/lib/apiClient.ts` (novo) — cliente fino, `credentials: "include"`
  sempre, sem tocar em tokens.
- [x] `AuthContext.tsx` reescrito por completo: sai o Supabase Auth **e** o sistema de
  autenticação paralelo em `localStorage` que coexistia com ele (dívida já identificada
  antes desta reescrita) — fica um único caminho de autenticação. 8 testes novos.
- [x] `Auth.tsx` reescrito: um único fluxo real (antes tentava Supabase e o fallback
  local ao mesmo tempo, aceitando qualquer um dos dois). "Esqueceu a password" mostra
  agora uma mensagem honesta de indisponível, em vez de chamar um Supabase Auth que as
  contas novas nunca vão ter (nenhuma conta nova existe lá) — recuperação de password
  fica pendente de uma decisão de fornecedor de email.
- [x] `tsc --noEmit` corrido explicitamente (não fazia parte do gate antes) — confirmado
  que os 8 erros de tipos que aparecem são **pré-existentes**, idênticos byte-a-byte aos
  do repositório antigo, não introduzidos por este trabalho.

**Gap conhecido, importante:** autenticar pela API nova **não torna o resto da app
funcional**. `ProfileContext.tsx`, `DashboardUser.tsx`, `Scanner.tsx` e outros continuam
a chamar `supabase.auth.getSession()` directamente para saber quem é o utilizador actual,
independentemente do `AuthContext`. Uma conta criada pela API nova não existe no Supabase,
por isso essas páginas vão continuar a comportar-se como "sem sessão" até serem migradas.
Isto não é um bug desta sprint — é o próximo passo.

**Por fazer, nesta ordem:** ver Sprint 2, já feito abaixo.

---

## Sprint 2 — Perfil (2026-09-09)

**Feito:**

- [x] Renomeada uma inconsistência introduzida na Sprint 1 antes de ela se espalhar:
  o registo gravava em `utilizadores.nome`, mas todo o resto da app já lia
  `nome_completo` (a tabela antiga tinha as duas colunas, paralelas — dívida nunca
  corrigida). Consolidado numa só coluna, `nome_completo`, em toda a cadeia
  (`orm_models`, migração baseline, schemas, service, router, frontend).
- [x] `api/app/repositories/perfil_repository.py` + `services/perfil_service.py` +
  `routers/perfil.py` — `GET /perfil`, `PATCH /perfil` (parcial: campo omitido não
  muda). Nunca aceita mudar `papel` nem `email` por aqui — só `PerfilAtualizar` chega
  ao service, `papel`/`email` enviados no corpo são ignorados pelo schema, nem chegam à
  base de dados. 10 testes novos (service com repositório falso + router com
  `TestClient`) — **38/38 testes `pytest`**, ruff limpo.
- [x] `obter_utilizador_atual` extraída de `routers/auth.py` para
  `app/core/dependencies.py` — deixou de ser só do router de autenticação a partir do
  momento em que um segundo router também precisa dela.
- [x] `ProfileContext.tsx` reescrito: `GET /perfil` em vez de
  `supabase.auth.getSession()` + `profiles` directo. Só pede o perfil depois de
  `AuthContext` terminar de verificar a sessão (evita um pedido destinado a falhar).
- [x] `EditarPerfil.tsx`: guardar nome/biografia/data de nascimento/género/telefone/
  província passa a usar `PATCH /perfil`. **Upload de avatar desligado com mensagem
  honesta** — dependia do Supabase Storage; o substituto (Cloudflare R2) ainda não tem
  endpoint. Continuar a chamá-lo silenciosamente falharia contra dados que já não
  existem.
- [x] 5 testes novos (`ProfileContext.test.tsx`) — **19/19 testes vitest**, lint e
  `tsc --noEmit` sem regressões (os mesmos 8 erros pré-existentes de sempre).

**Gap que se torna mais preciso com este sprint:** `profile.id` agora vem da tabela
`utilizadores` da API nova, não da sessão Supabase. Páginas de exercícios
(`TrackingExercise.tsx`, `CerebroExercise.tsx`, `ConvergenciaExercise.tsx`,
`RelaxamentoExercise.tsx`, `AmbliopiaExercise.tsx`) gravam `sessoes_exercicio`
directamente no Supabase usando `profile.id` como `user_id` — com uma conta da API
nova, esse id não corresponde a nada no Supabase; essas gravações continuam a falhar
(RLS rejeita, ou pior, falha silenciosa). Não é novo — já era um "sem sessão
reconhecida" na Sprint 1 — mas agora é precisamente "grava com um id estranho" em vez
de "não grava". Fica para quando `sessoes_exercicio` migrar para a API.

> **Resolvido a 2026-09-10** — ver "Sessões de exercício via API" mais abaixo. Os cinco
> exercícios gravam agora em `POST /sessoes-exercicio`, com o `user_id` tirado do
> cookie de sessão, não do `profile.id` do browser.

---

## Sprint 3 — Conta: mudar password, eliminar (30 dias) (2026-09-09)

**Feito:**

- [x] `app/core/cookies.py` (novo) — cookies de sessão extraídos de `routers/auth.py`
  porque `routers/conta.py` também precisa de os limpar ao eliminar a conta.
- [x] `api/app/services/conta_service.py` + `repositories/utilizadores_repository.py`
  ganha `atualizar_password_hash`, `agendar_eliminacao`, `cancelar_eliminacao_se_agendada`,
  `apagar` (usada pelo futuro trabalho de purga, ainda não construído) —
  `POST /conta/mudar-password`, `POST /conta/eliminar`.
- [x] **Nunca elimina na hora** — agenda para daqui a 30 dias (reaproveitando a coluna
  `eliminar_agendado_para` já existente) e termina a sessão actual. Voltar a entrar
  dentro do prazo cancela o pedido: `POST /auth/entrar` chama agora também o
  `ContaService`, e `UtilizadorPublico` ganha `eliminacao_cancelada: bool` para o
  frontend mostrar o aviso certo.
- [x] `mudar-password` reutiliza o validador de password forte do registo
  (`validar_password_forte`, extraído para ser partilhado) — mesma regra, um só sítio.
- [x] 15 testes novos (service com repositório falso + router com `TestClient`,
  incluindo o cenário completo "eliminar → voltar a entrar → cancelado") —
  **51/51 testes `pytest`**, ruff limpo.
- [x] `Configuracoes.tsx` migrado por completo: mudar password e eliminar conta
  passam a chamar a API nova (`contaApi`), não o Supabase. Preferências de
  notificação também migradas (`perfilApi.atualizar`) — era a última chamada directa
  ao Supabase nesta página.
- [x] **Refactor que vale a pena registar:** três páginas (`AuthContext`,
  `Configuracoes`, `EditarPerfil`) tinham cada uma a sua própria versão de "extrair a
  mensagem de erro da API". Consolidado em `mensagemDeErroApi` (`apiClient.ts`), por
  duck-typing (propriedade `status`) — não `instanceof ApiError`, que não sobrevive a
  um módulo mockado nos testes (ver CLAUDE.md, "Testes (Vitest)"). Menos código, e o
  padrão de teste deixa de precisar de reconstruir a classe de erro real.
- [x] 6 testes reescritos (`Configuracoes.test.tsx`, agora contra `apiClient`, não
  Supabase) — **21/21 testes vitest**, lint sem regressões. `tsc --noEmit`: **6 erros
  pré-existentes**, dois a menos que antes (o rewrite eliminou de raiz dois erros de
  tipos que só existiam no mock antigo do Supabase).

**Por fazer:** `EditarPerfil.tsx` não ganhou teste próprio nesta sprint — a lógica de
negócio que importa (validação, sucesso/erro de `PATCH /perfil`) já está coberta do
lado da API; falta só o teste de integração da página, se/quando fizer falta.

---

## Sprint 4 — Banners, e uma correcção de âmbito (2026-09-09)

Antes de construir, investiguei os próximos candidatos óbvios (`pontos_recolha`,
`contact_messages`, `site_content`) e descobri que **não são realmente consumidos**:
`PontosRecolha.tsx` é conteúdo estático (nada a ver com a tabela do mesmo nome);
`ContactSection.tsx` envia email por uma Edge Function, não grava em
`contact_messages` — depende de escolher um fornecedor de email, decisão que não é
minha para tomar às 2h da manhã; `site_content` só tem um CMS de admin, sem nenhum
consumidor público. Ajustei o sprint para o que é real.

> **Revisto a 2026-09-10** — a parte de *guardar* a mensagem de contacto é separável da
> parte de *enviar email*, e foi feita (ver "Formulário de contacto via API" mais
> abaixo). O envio de email continua pendente. `site_content` continua sem consumidor
> público — fica de fora.

**Feito:**

- [x] `GET /banners/ativo` — leitura pública directa ao repository, sem `service`
  (ver CLAUDE.md secção 3: ler conteúdo público não decide acesso, dinheiro nem
  resultado clínico). 2 testes com `TestClient` — **53/53 testes `pytest`**, ruff limpo.
- [x] **Corrigido um bug genuíno herdado do repositório antigo:** `SiteBanner.tsx`
  lia `title`/`active`/`color`, colunas que nunca existiram na tabela real
  (`titulo`/`mensagem`/`ativo`, sem `color`) — o banner nunca apareceu a um utilizador
  real, mesmo com um banner activo na base de dados. Corrigido ao migrar para a API
  nova, que devolve a forma real. Dois dos erros de tipo pré-existentes desaparecem
  de vez (não só se movem) — **4 erros pré-existentes**, a descer de 8.
- [x] 21/21 testes vitest, lint sem regressões, build ok.

**Dívida identificada nesta sprint, resolvida a 2026-09-10** (ver "CRUD de banners de
admin" mais abaixo): `AdminBanners.tsx` tinha o mesmo bug de nomes de campo
(`title`/`message`/`active`/`color`) e continuava no Supabase — agora migrado para a
API, protegido por `obter_utilizador_admin`.

---

## Sprint 5 — Doações: o fluxo com o pior bug do projecto (2026-09-09)

O bug mais grave que este projecto já teve foi aqui: o fluxo antigo mostrava "Doação
registada!" mesmo quando o `insert` falhava. Esta sprint constrói o serviço de doações
com essa lição como regra estrutural, não como cuidado a lembrar.

**Feito:**

- [x] `POST /doacoes/materiais` — só o fluxo de materiais (o financeiro depende de upload
  de ficheiro + email, infra ainda não decidida — ver abaixo). Recibo (`recibo_id`)
  **gerado no servidor**, não confiado ao `Date.now()` do browser como estava antes.
- [x] `DoacaoService.registar_doacao_materiais` **nunca apanha uma falha de gravação** —
  o repository não tem `try/except` nenhum à volta do `commit()`; se falhar, a excepção
  propaga até ao router (500) e o frontend nunca vê sucesso. Testado explicitamente:
  `test_nunca_engole_uma_falha_de_gravacao` — o teste mais importante desta sprint.
- [x] 6 testes de API (service + router, incluindo o cenário de falha ao nível HTTP:
  nunca 201 quando o repository falha) — **60/60 testes `pytest`**, ruff limpo.
- [x] `Apoiar.tsx` (fluxo de materiais) migrado para a API nova. Email de confirmação
  fica pendente (dependia de uma Edge Function do Supabase) — mensagem nenhuma finge
  que foi enviado.
- [x] **`Apoiar.test.tsx` (novo)** — o mesmo teste-exemplo do CLAUDE.md secção 8, ao
  nível do componente: "nunca mostra sucesso quando a API falha ao registar a doação".
  2 testes — **23/23 testes vitest**, lint sem regressões.

**Fora de âmbito, deliberadamente:** o fluxo financeiro (`handleConcluirDoacao`) não foi
tocado — o comprovativo de transferência é enviado através da mesma Edge Function que
manda o email, sem upload separado para storage nenhum. Migrar isto a sério precisa de
resolver R2 (upload do ficheiro) e um fornecedor de email ao mesmo tempo; fazer só metade
seria pior do que não tocar.

**Nota sobre o ambiente:** ao correr `npm run lint`/`tsc` nesta sprint, reparei que vários
ficheiros do painel de administração (`AdminAdmins.tsx`, `AdminSidebar.tsx`,
`command.tsx`, `textarea.tsx`, `tailwind.config.ts`, etc.) tinham sido corrigidos
automaticamente (remoção de `as any`, `require()` → `import`) — não fui eu que fiz essas
edições deliberadamente; o ambiente parece ter ESLint fix-on-save activo. Confirmei que
`npm run build` continua bem depois disso. Não é trabalho desta sprint, mas fica
registado para não parecer um commit misterioso.

---

## Sprint 6 — Feedback (2026-09-09)

Confirmei antes de construir: `notifications` só tem consumidor no painel de admin (sem
leitura pública do lado do utilizador) — mesma situação de `site_content`, fica de fora.
`user_feedback`, via `FeedbackWidget.tsx`, é genuinamente público (funciona com ou sem
sessão) e usado no site inteiro — candidato real.

**Feito:**

- [x] `POST /feedback` — público de propósito (não exige sessão), identifica o utilizador
  quando há cookie válido via `obter_utilizador_atual_opcional` (novo em
  `core/dependencies.py`: nunca 401, um cookie ausente ou inválido só significa "sem
  identidade conhecida"). Validação de forma só (rating 1–5, comentário ≤500), sem
  `service` — não decide acesso, dinheiro nem resultado clínico.
- [x] 4 testes de router (com sessão, sem sessão, rating fora do intervalo, comentário
  opcional) — **64/64 testes `pytest`**, ruff limpo.
- [x] `FeedbackWidget.tsx` migrado: usa `feedbackApi` em vez de
  `supabase.auth.getSession()` + `user_feedback` directo. Notificação por email ao admin
  fica pendente (mesma razão de sempre — fornecedor de email por decidir) — o feedback em
  si já fica gravado, o que importa não se perde.
- [x] `FeedbackWidget.test.tsx` (novo) — 3 testes, incluindo o caminho do erro (nunca
  mostra sucesso quando a API falha) — **26/26 testes vitest**, lint a **zero erros**
  (só os 13 avisos `react-refresh` de sempre, inofensivos). `tsc --noEmit`: 6 erros
  pré-existentes, todos no painel de administração (fora de âmbito, ver Sprint 4).

---

## Fim dos 6 sprints autónomos — o que ficou por fazer, por decisão consciente

Seis sprints em sequência (implementar → testar → seguinte, sem pausar para autorização,
por pedido explícito do dono do projecto). O que ficou de fora não foi esquecido — cada
item abaixo depende de uma decisão que não é minha para tomar sozinho:

| Item | Depende de |
|---|---|
| Fornecedor de email transacional | Escolha de serviço (SES, Resend, Postmark, ...) e custo |
| Storage de ficheiros (avatares ~~feito~~, comprovativos) | Avatar: só falta credenciais reais do R2 + `R2_PUBLIC_BASE_URL` (código feito 2026-09-10). Comprovativos: ainda por construir |
| Migração Alembic contra Postgres real | Docker Desktop a correr nesta máquina |
| Deploy no Cloud Run | Scripts feitos em `infra/gcloud/`. Falta conta/projecto GCloud com facturação + resolver o proxy NGINX→HTTPS do Cloud Run (`infra/gcloud/README.md`) |
| CRUD de admin (notifications, site_content) | ~~Verificação de papel/admin na API~~ já construída (`obter_utilizador_admin`); ~~banners~~ feito a 2026-09-10 (ver abaixo). Falta `notifications`/`site_content` — mesmo padrão |
| Fluxo financeiro de doações (upload de comprovativo) | Email + storage, os dois primeiros itens desta lista |
| ~~`sessoes_exercicio`~~ (feito 2026-09-10), Scanner, Premium | Scanner e Premium continuam módulos maiores, cada um merece o mesmo tratamento cuidadoso — próximos sprints |

### Infra do NGINX — alvo do proxy parametrizado (2026-09-09)

O `infra/nginx/nginx.conf` (com `proxy_pass http://api:8000/` fixo) deu lugar a
`infra/nginx/default.conf.template`: a imagem oficial do NGINX corre `envsubst` no
arranque e injecta `${API_URL}` de uma variável de **run-time** — o URL da API só se
conhece depois do primeiro deploy no Cloud Run. `frontend.Dockerfile` copia agora o
`.template` para `/etc/nginx/templates/`; `docker-compose.yml` passa `API_URL=http://api:8000`
ao serviço `frontend`.

**Frontend na mesma origem (feito — branch `refactor/frontend-mesma-origem-api`):**
`apiClient.ts` passa a usar `/api` por omissão (era `""`), o browser deixa de falar
cross-origin com a API. `vite.config.ts` ganha um proxy `/api → http://localhost:8000`
para `npm run dev` sem Docker. `docker-compose.yml`/`frontend.Dockerfile` já não fazem
baked de `VITE_API_URL`. `api/app/main.py`: CORS passa a rede de segurança (métodos e
cabeçalhos limitados ao que o cliente usa; origens já eram lista fechada). Testes novos:
`frontend/src/lib/apiClient.test.ts` (prefixo `/api`, `credentials: include`, caminho de
erro) e `api/tests/test_cors.py` (origem permitida vs. desconhecida no preflight).
Verificação do `docker build` do frontend continua pendente (Docker/WSL a instalar).

Estado do gate em todos os 6 sprints: API sempre 100% verde (64/64 no fim), frontend
sempre 100% verde (26/26 no fim), lint da API sempre limpo, lint do frontend a chegar a
zero erros, `tsc --noEmit` só com dívida pré-existente documentada e a diminuir (8 → 6
erros), nunca a aumentar.

### Frontend passa do Cloud Run (NGINX próprio) para o Vercel (2026-09-13)

Decisão do dono do projecto: o Lukeny já tinha conta paga no Vercel com CI/CD ligado ao
frontend, deploy automático a cada push/merge em `main`, e o domínio `janelasparaalma.com`
já apontado lá. Manter um container NGINX próprio no Cloud Run só para servir ficheiros
estáticos deixou de fazer sentido quando já havia infra paga e a funcionar a fazer
exactamente isso — não é reverter a saída do Supabase/Vercel da Sprint 0 (essa continua
válida para auth, base de dados e storage), é só trocar quem serve o build.

O que mudou:
- `frontend/vercel.json` ganha o `rewrite` de `/api/*` para o URL da API no Cloud Run —
  o mesmo papel que o `default.conf.template` do NGINX tinha, só que resolvido do lado
  do Vercel em vez de um container nosso. Preserva a mesma-origem de que depende o
  cookie `httpOnly` de sessão (CLAUDE.md §3b) sem precisar de CORS a sério.
- Saem: `infra/nginx/`, `infra/docker/frontend.Dockerfile`, o serviço `frontend` do
  `docker-compose.yml`, o job `imagens` do CI deixa de construir a imagem do frontend e
  de correr `nginx -t`.
- `infra/gcloud/04-deploy.sh` deixa de fazer deploy do frontend — só a API.
  `00-config.example.sh` ganha `FRONTEND_DOMAIN` (para o `FRONTEND_ORIGINS`/CORS da API,
  que continua só como rede de segurança).
- **Pendente:** o `rewrite` de `frontend/vercel.json` está com um placeholder
  (`SUBSTITUIR-PELO-URL-DA-API.run.app`) até a API ter o primeiro deploy real no Cloud
  Run — nessa altura, substituir pelo URL verdadeiro e voltar a fazer deploy do frontend.
  Sem isso, `/api/*` em produção não funciona.

### Verificação de papel de administrador na API (2026-09-10 — branch `api/verificacao-admin`)

Trabalho novo (não migração), feito em paralelo enquanto o bug da página do frontend
era investigado noutra frente. É pré-requisito de vários sprints por vir (CRUD de
banners no painel — Sprint 4 abaixo, `W-11` Premium, decisão de candidaturas).

- `obter_utilizador_admin` em `api/app/core/dependencies.py` — assenta em
  `obter_utilizador_atual` (401 sem sessão válida), devolve 403 se `papel != "admin"`.
  Implementação única da comparação de papel, nunca repetida endpoint a endpoint
  (CLAUDE.md §6, "has_role numa só implementação").
- 3 testes (`api/tests/test_dependencies_admin.py`): sem sessão → 401, papel comum →
  403, admin → 200. **70/70 `pytest`**, `ruff check app tests` limpo.
- Primeiro consumidor real: o CRUD de banners de admin, logo a seguir.

### CRUD de banners de admin (2026-09-10 — mesma branch)

Primeiro uso real de `obter_utilizador_admin`, e fecho da dívida da Sprint 4.

- `api/app/routers/banners.py` ganha `GET /banners` (listar todos), `POST /banners`,
  `PATCH /banners/{id}`, `DELETE /banners/{id}` — todos com
  `dependencies=[Depends(obter_utilizador_admin)]`. Sem `service`: gerir conteúdo de
  banner não decide acesso, dinheiro nem resultado clínico (CLAUDE.md §3); o router
  fala directo com o repository, tal como a leitura pública já fazia.
- `banners_repository.py`: `BannersRepository` (Protocol) cresce com `listar`, `criar`,
  `atualizar` (via `BannerPatch`, `None` = "não mexer", como `PerfilPatch`) e `apagar`.
  `BannerRegisto` ganha `ativo`.
- `AdminBanners.tsx` migrado de `supabase.from("banners")` para `bannersApi` — e com
  isso desaparece o bug de nomes de campo herdado (`title`/`message`/`active`/`color`
  contra os reais `titulo`/`mensagem`/`ativo`, sem `color`). A coluna `color` nunca
  existiu na tabela real; o seletor de cor foi removido, não inventada uma coluna.
  Cada gravação verifica o erro antes de mostrar sucesso (CLAUDE.md §6).
- Testes: 8 de router (`test_banners_router.py` reescrito — 401 sem sessão, 403 papel
  comum, criar/listar/apagar como admin, `PATCH` desativa, 404 em id inexistente) +
  2 de página (`AdminBanners.test.tsx` — nunca mostra sucesso quando a API falha).
  **76/76 `pytest`**, **33/33 vitest**, ruff limpo, lint do frontend a zero erros,
  `tsc --noEmit` e `npm run build` sem regressões.
- Fora de âmbito: `AdminBanners.tsx` não tinha teste próprio antes; ganhou só o do
  caminho do erro na criação. `notifications`/`site_content` seguem o mesmo padrão
  quando fizerem falta.

### Upload de avatar via R2 (2026-09-10 — mesma branch)

Fecha o item 2 do "por fazer" do Sprint 0 e reactiva o upload de foto de perfil que
estava desligado desde a Sprint 2 (dependia do Supabase Storage).

**Fluxo em três passos, os bytes nunca passam pela API** (CLAUDE.md §4b):

1. `POST /uploads/avatar {content_type}` → a API valida o tipo (PNG/JPEG/WebP),
   escolhe a chave `avatares/{utilizador_id}/{uuid}.{ext}` e devolve um URL de `PUT`
   assinado do R2 + o URL público final.
2. O browser faz `PUT` do ficheiro directamente ao R2 (`uploadsApi.enviarParaStorage`,
   fora do `apiClient` — outra origem, sem cookies, corpo binário).
3. `POST /uploads/avatar/confirmar {chave}` → a API confirma que a chave começa pelo
   prefixo do próprio utilizador (403 se não) e grava em `utilizadores.avatar_url`.

- **É um `service` com regras e testes** (`services/upload_service.py`), não um router
  fino: o utilizador podia mentir sobre o tipo do ficheiro e sobre a dona da chave
  (CLAUDE.md §3). Ambas recusadas — `TipoDeFicheiroNaoPermitidoError` (422),
  `ChaveDeAvatarInvalidaError` (403).
- `repositories/storage.py` — `Presigner` (Protocol) + `R2Presigner` (boto3, `s3v4`).
  A implementação real **não é exercitada pelos testes** (não há bucket nem
  credenciais); a garantia está nos testes do service contra um `Presigner` falso —
  mesmo padrão de `auth_service`.
- `config.py` ganha `r2_public_base_url` e `r2_upload_url_expira_segundos` (300s).
- `SQLAlchemyPerfilRepository.definir_avatar_url` — fora de `PerfilPatch` de propósito:
  `avatar_url` não é campo que o utilizador escreve no formulário, é resultado de um
  upload já validado.
- Frontend: `EditarPerfil.tsx` reactiva o botão (validação de tipo e tamanho ≤5 MB do
  lado do cliente como segunda linha de defesa); cada passo verifica o erro antes de
  mostrar sucesso.
- Testes: 10 de service (`test_upload_service.py`) + 5 de router
  (`test_uploads_router.py`) + 3 de página (`EditarPerfil.test.tsx`, novo — caminhos do
  erro no envio e na confirmação). **88/88 `pytest`**, **36/36 vitest**, ruff limpo,
  lint do frontend a zero erros, `tsc --noEmit` e `npm run build` sem regressões.
- **Ainda por fazer para funcionar em produção:** credenciais reais do R2, um bucket, e
  `R2_PUBLIC_BASE_URL` a apontar para o domínio público do bucket. Até lá o endpoint
  responde mas o `PUT` assinado não tem destino real.

### Sessões de exercício via API (2026-09-10 — mesma branch)

Fecha o gap identificado nos Sprints 2 e 3: os cinco exercícios gravavam
`sessoes_exercicio` directamente no Supabase, usando o `profile.id` da API nova como
`user_id` — um id que no Supabase não corresponde a nada.

- `POST /sessoes-exercicio` — router fino, direto ao repository, **sem service**:
  gravar uma sessão é escrita simples e não decide acesso, dinheiro nem resultado
  clínico (CLAUDE.md §3, a tabela lista exactamente este caso do lado do router fino).
- **O `user_id` vem do JWT, nunca do corpo.** O schema `SessaoExercicioCriar` nem tem
  campo `user_id`; um pedido forjado com `user_id` no corpo é ignorado pelo Pydantic e
  a API grava sempre o dono do cookie. Testado explicitamente.
- `sessoes_exercicio_repository.py` — sem `try/except` à volta do `commit()` (mesmo
  padrão de `doacoes_repository.py`): se a gravação falhar, a excepção propaga (500),
  nunca um 201 fabricado. Teste: `test_nunca_201_quando_a_gravacao_falha`.
- `pontuacao`/`precisao_percentual`/`detalhes` são opcionais (o exercício de
  relaxamento não pontua); `duracao_segundos` entre 1 e 24 h.
- Frontend: `TrackingExercise`, `CerebroExercise`, `ConvergenciaExercise`,
  `RelaxamentoExercise`, `AmbliopiaExercise` deixam de importar `supabase` — passam a
  `sessoesExercicioApi.registar`. Mantido o comportamento existente de **não** bloquear
  o ecrã de feedback final se a gravação falhar (só `console.error`): o utilizador já
  terminou o exercício e a sessão é telemetria, não há UI de sucesso presa a ela.
- Testes: 5 de router (`test_sessoes_exercicio_router.py`) + 2 de `apiClient`
  (`apiClient.test.ts` — payload sem `user_id`, erro propagado). **93/93 `pytest`**,
  **38/38 vitest**, ruff limpo, lint do frontend a zero erros, `tsc --noEmit` e
  `npm run build` sem regressões.
- **Ainda por fazer:** ler estas sessões (histórico de exercícios, números reais no
  `DashboardUser`) — hoje esse ecrã ainda usa valores fixos (ver secção 11 da
  `CLAUDE.md`). É trabalho de leitura, para um sprint próprio.

### Formulário de contacto via API (2026-09-10 — mesma branch)

O formulário de contacto do site (`ContactSection.tsx`) só enviava um email por Edge
Function — a mensagem em si não ficava guardada em lado nenhum, apesar de o
`AdminInbox.tsx` a tentar listar. Guardar é separável de enviar email, e é o que não
pode perder-se.

- `POST /contact-messages` — público (não exige sessão), mesmo padrão de `/feedback`:
  sem service, só validação de forma (nome, email válido, mensagem ≤1000). Repository
  sem `try/except` à volta do `commit()` — nunca um "enviado" falso.
- 8 testes de router (201, público sem sessão, 4 casos de 422, nunca 201 quando a
  gravação falha).
- Frontend: o `handleSubmit` do contacto passa a chamar `contactMessagesApi.enviar` em
  vez da Edge Function. O toast de sucesso passou de "Mensagem enviada" para "Mensagem
  registada" — honesto: o email à equipa ainda não sai. A candidatura a **voluntário**,
  no mesmo componente, **não foi tocada** — não tem tabela (`voluntarios` não existe no
  esquema; é trabalho novo, não migração) e continua na Edge Function.
- `ContactSection.test.tsx` (novo) — 2 testes, incluindo o caminho do erro.
- **100/100 `pytest`**, **40/40 vitest**, ruff limpo, lint do frontend a zero erros,
  `tsc --noEmit` e `npm run build` sem regressões.

#### Leitura de admin das mensagens de contacto (2026-09-10 — mesma branch, logo a seguir)

- `GET /contact-messages` e `PATCH /contact-messages/{id}` (`{lida: bool}`) — ambos
  protegidos por `Depends(obter_utilizador_admin)` (401 sem sessão, 403 sem papel
  admin). Primeiro uso real da dependency de admin numa rota de **leitura**.
- `AdminInbox.tsx` — o separador de Mensagens passa a usar `contactMessagesApi`
  (`listar` / `marcarLida`), e larga colunas que o esquema real nunca teve
  (`source`, `phone`, `status` de texto) — o estado agora é o booleano `lida`. O
  separador de **Pedidos Premium continua no Supabase**: a activação do Premium (W-11)
  toca paywall e papéis, trabalho que exige revisão humana.
- `AdminOverview.tsx` (KPIs) não foi tocado — conta `contact_messages`, `profiles`,
  `scanner_analyses` e `premium_requests` de uma vez, é um painel de analytics inteiro
  e metade das fontes ainda está bloqueada (Scanner). Fica para um sprint próprio; até
  lá a contagem de mensagens nesse ecrã fica desalinhada (já entrava na dívida "números
  fixos" da secção 11 da `CLAUDE.md`).
- `AdminInbox.test.tsx` (novo) — 3 testes (listagem falha não rebenta, marcar tratada
  recarrega, nunca sucesso quando marcar falha).
- **104/104 `pytest`**, **43/43 vitest**, ruff limpo, lint do frontend a zero erros,
  `tsc --noEmit` e `npm run build` sem regressões.
- **Ainda por fazer:** envio de email à equipa (fornecedor por decidir);
  `AdminOverview` KPIs; candidaturas de voluntário (sem tabela).

### Baseline alinhada com o ORM (2026-09-10 — branch `api/premium-w11`)

Ao correr a migração baseline contra Postgres real pela primeira vez (Docker finalmente
disponível), `alembic check` apanhou duas diferenças que a baseline escrita à mão tinha
em relação a `orm_models.py`:

- `admin_permissions.user_id` estava nullable; o ORM diz `NOT NULL`.
- `utilizadores.email`: o ORM pede um único índice único; a baseline tinha um índice
  não-único + uma `UniqueConstraint` separada.

Corrigido em `6318271fa98f_alinha_a_baseline_com_os_modelos_orm.py` (aditiva, base vazia).
Migração baseline nunca editada — a correcção é uma migração nova por cima.
`alembic upgrade head` + `alembic check` verdes, downgrade testado.

### W-11 · Confirmação de pagamento activa o Premium (2026-09-10 — branch `api/premium-w11`)

Decisão do dono do projecto (2026-09-10): **A** (Premium é estado próprio, não papel) ·
**2a** (o bypass dos exercícios NÃO se mexe neste lote) · **30 dias** de validade ·
migração validada contra Postgres real.

**Esquema** (migração `0becabba3bad`, aditiva): `utilizadores.premium_ativo` +
`premium_expira_em`; `premium_requests.aprovado_por` (FK) + `aprovado_em`.

**API**
- `services/premium_service.py` — `aprovar_pagamento(pedido_id, admin_id)`: pedido
  inexistente → 404, já aprovado → 409 (não estica a validade sem novo pagamento), sem
  conta ligada → 422. `revogar(...)` desliga o acesso. `admin_id` vem sempre do JWT.
- `repositories/premium_repository.py` — `aprovar_pagamento` / `revogar` tocam
  `premium_requests` **e** `utilizadores` numa só transacção (um `commit`): estado do
  pedido e acesso do utilizador nunca dessincronizam.
- `routers/premium.py` — `POST /premium-requests` (público, liga a conta se houver
  cookie), `GET /premium-requests` (admin), `POST /premium-requests/{id}/aprovar` e
  `/revogar` (admin).
- `PerfilPublico` / `GET /perfil` expõem `premium_ativo` (já com a validade verificada)
  e `premium_expira_em`.
- **Criação de admins:** `python -m app.criar_admin <email>` (arranque a frio — a base
  nasce sem admins e o registo não deixa escolher `admin`). Depois, `routers/admin.py`:
  `GET /admin/utilizadores`, `POST /admin/utilizadores/promover` (por email),
  `POST /admin/utilizadores/{id}/remover-admin` — `admin_service.py` impede despromover
  a própria conta e o último admin.

**Frontend**
- `RegistoPremium.tsx` — o pedido passa a gravar via `premiumApi.pedir` (antes não
  gravava nada de útil). O envio do comprovativo continua pela Edge Function (único
  caminho até o R2 ter credenciais).
- `AdminInbox.tsx` — separador Premium via `premiumApi`, com **"Aprovar pagamento"**
  (activa 30 dias) e **"Revogar"**, distintos. Botão de aprovar desactivado se o pedido
  não tem conta ligada.
- `AdminAdmins.tsx` — reescrito: sai a matriz de permissões `admin_permissions`/
  `is_super`/`can_*` (não existe no modelo de `papel` único) e o `useAdminScope`; fica
  listar admins + promover por email + remover.
- **Bypass do paywall NÃO tocado** (decisão 2a) — `Exercicios.tsx:154`
  `temAcessoPremium = true` fica; virar a chave é um PR isolado (bloqueio #3).

**Testes** — 33 novos de API (`test_premium_service`, `test_admin_service`,
`test_premium_router`, `test_admin_router`, `test_criar_admin`) + 5 de frontend
(`AdminInbox` premium, `AdminAdmins`). **137/137 `pytest`**, **48/48 vitest**, ruff
limpo, lint do frontend a zero erros, `tsc --noEmit` e `npm run build` sem regressões.
`alembic upgrade head` + `alembic check` verdes contra Postgres real.
- Sem teste de componente para o wizard de `RegistoPremium` — a navegação multi-passo
  esbarra nas lacunas do jsdom com o Radix Select; a lógica que importa (gravar o
  pedido, não avançar em caso de erro) espelha o padrão já testado de `Apoiar.tsx` e
  está coberta do lado da API.
- `src/test/setup.ts` ganhou polyfills de `ResizeObserver` e Pointer Capture (Radix).

**Ainda por fazer:** virar o bypass do paywall (bloqueio #3); notificar o utilizador
por email quando o Premium é activado (fornecedor de email por decidir).

---

## Como está organizado

O trabalho está separado em **duas correntes que não se cruzam**, para os dois poderem
avançar em paralelo sem conflitos de merge:

| Corrente | Quem | Onde mexe | Natureza |
|---|---|---|---|
| **Fundação** | Wilson | `api/` (novo), `supabase/**`, lógica de segurança e dados | Risco alto, invisível ao utilizador |
| **Superfície** | Lukeny | `public/**`, `src/assets/**`, páginas institucionais, navegação | Risco baixo, imediatamente visível |

A sobreposição de ficheiros entre as duas correntes é quase nula. Onde existe, está
marcada com ⚠️ e tem ordem definida.

---

## Prioridade — o raciocínio em três linhas

1. **Primeiro paramos de mentir ao utilizador.** Cinco funcionalidades dizem uma coisa e
   fazem outra. Duas delas contradizem a Política de Privacidade publicada. Isto é rápido
   de corrigir e é o que traz risco legal.
2. **Depois paramos de parecer partidos.** Imagens que não carregam e vídeos que não
   tocam são o que uma clínica vê quando avalia a parceria. Barato, muito visível.
3. **Só então construímos fundação.** A API e os testes não produzem nada que se mostre —
   mas tudo o resto assenta neles, e são mais baratos agora do que depois.

---

## SPRINT 0 — Parar de mentir · Wilson

**Objectivo:** nenhuma funcionalidade afirma ao utilizador algo que não é verdade.
Não depende de infraestrutura nova. Dias, não semanas.

### W-01 · Remover o bypass do Premium — ✅ **FEITO** (confirmado no código a 2026-09-17)
- **Onde:** `src/pages/Exercicios.tsx:153`, `src/components/exercises/BaseExercise.tsx:82`
- **Estado actual:** já não há bypass — ambos verificam `profile.premium_ativo || profile.papel === "admin"` a sério, com teste dedicado (`Exercicios.test.tsx`, comentário explícito: "nunca mais pelo bypass fixo"). Não ficou registado aqui quando foi feito nem por quem — só se confirmou ao verificar o código para responder a "o que falta" (2026-09-17). Sem pagantes confirmados nessa data (saída 1 da armadilha abaixo), por isso não houve necessidade da saída 2/3
- **Pronto quando:** uma conta sem Premium é bloqueada nos 8 exercícios avançados, e uma com Premium entra — ✅

> ⚠️ **Armadilha de sequência — ler antes de executar.**
> Nenhum fluxo escreve hoje `profiles.papel = "premium"` (é o que **W-11** vai construir).
> Remover o bypass isolado leva o produto de *"toda a gente tem acesso de graça"* para
> ***"ninguém consegue aceder, incluindo quem pagou"***. Para um cliente pagante, o
> segundo estado é pior do que o primeiro.
>
> **Três saídas, por ordem de preferência:**
> 1. **Não há ninguém pago ainda** → remover já, sem mais nada. É o caso mais provável e o mais simples
> 2. **Há pagantes** → activar-lhes o `papel` manualmente no painel do Supabase **no mesmo momento** em que o bypass sai
> 3. **Vai haver pagantes em breve** → segurar W-01 e lançá-lo junto com W-11
>
> Verificar primeiro: existe alguma linha em `premium_requests` com pagamento confirmado,
> ou algum `profiles.papel = 'premium'`? A resposta escolhe a saída.

### W-02 · Mudar palavra-passe passa a mudar mesmo a palavra-passe
- **Onde:** `src/pages/Configuracoes.tsx` → `handlePasswordSubmit`
- **Hoje:** valida que os campos não estão vazios, mostra "Palavra-passe atualizada com sucesso" e **nunca chama o Supabase**
- **Fazer:** reautenticar com a palavra-passe actual, depois `supabase.auth.updateUser({ password })`. Nunca mostrar sucesso sem verificar `error`
- **Pronto quando:** palavra-passe actual errada é recusada com mensagem clara; a nova palavra-passe funciona no login seguinte e a antiga deixa de funcionar
- **Testes:** integração — caminho de erro (palavra-passe actual errada) **e** caminho de sucesso

### W-03 · Eliminar conta passa a eliminar mesmo a conta
- **Onde:** `src/pages/Configuracoes.tsx` → `handleDelete`
- **Hoje:** faz logout, mostra "Conta eliminada", navega para a home. Não apaga nada
- **Porquê é urgente:** a Política de Privacidade publicada invoca GDPR/LGPD e aponta as Configurações como o mecanismo de eliminação. É um compromisso já assumido publicamente
- **Fazer:** fluxo real de eliminação/anonimização, com confirmação explícita. Decidir e documentar o que é apagado e o que é anonimizado (sessões de exercício e doações podem ter de sobreviver anonimizadas)
- **Pronto quando:** após eliminar, o login deixa de funcionar e os dados pessoais desapareceram da base de dados
- **Testes:** integração, incluindo o caminho de erro

### W-04 · Scanner deixa de inventar diagnósticos — ✅ feito 2026-09-17
- **Onde:** `src/pages/Scanner.tsx` (`DIAGNOSES[Math.floor(Math.random() * ...)]`)
- **O que mudou entretanto (fora deste backlog, por isso ficou desactualizado):** o Lukeny ligou um microserviço próprio de análise, o `janelas-scanner-api` (ver W-09 abaixo — a nota "parte-se do zero" já não é verdade), ao fluxo de câmara guiada (3 poses). Esse fluxo já calculava um diagnóstico real, com medições de alinhamento ocular
- **O que ainda faltava e foi corrigido agora:** o botão "Carregar Fotografia" (upload de uma única imagem) nunca chamava esse microserviço — caía sempre no `Math.random()`. Removido por completo: só fica a captura guiada, que exige as 3 poses para o cálculo real
- **Pronto quando:** nenhum ecrã apresenta um resultado clínico que não tenha sido calculado a partir de medições reais — ✅

### W-16 (candidaturas) · Candidaturas a voluntário nunca chegavam à base de dados — ✅ **FEITO 2026-09-23**
*(Nota: há outro item chamado W-16 mais abaixo, "Validação contra casos reais", do scanner —
colisão de numeração pré-existente na Sprint 3, não corrigida aqui para não gerar mais churn.)*
- **Onde:** `src/components/ContactSection.tsx` (modal "Quero ser um Kamba", página `/junte-se`) e
  `src/components/VolunteerSection.tsx` (página `/kamba`), ambos via `src/lib/edgeFunction.ts`
- **Antes:** os dois formulários chamavam `sendToEdgeFunction("send-volunteer-email", dados)` —
  uma Edge Function do Supabase que só enviava um email. Nenhum dos dois chamava
  `POST /voluntariado/candidatar`, o endpoint que já existia na API própria
  (`app/routers/voluntariado.py`), com serviço, testes, e um ecrã de admin inteiro
  (`AdminVoluntariado.tsx`) pronto para aprovar candidaturas
- **Descoberta ao planear a correcção:** `POST /voluntariado/candidatar` exige sessão (decisão já
  tomada e documentada no próprio router — sem conta não há como ligar "as minhas actividades").
  Os dois formulários, em contraste, pediam nome e email para visitantes sem conta. Decisão
  tomada com o dono do projecto: **exigir login antes de candidatar**, sem abrir excepção nova
  no backend
- **Feito:** os dois formulários passam a chamar `voluntariadoApi.candidatar(motivacao, telefone)`;
  o botão/CTA de candidatura verifica `isLoggedIn` primeiro e redirecciona para
  `/auth?next=/junte-se` (ou `/kamba`) em vez de abrir o formulário; os campos Nome e Email saem
  do formulário (o endpoint real não os aceita); `edgeFunction.ts` removido (zero consumidores)
- **Pronto quando:** submeter qualquer um dos dois formulários cria uma linha em
  `candidaturas_voluntariado`, visível em `AdminVoluntariado.tsx` — ✅
- **Testes:** integração — caminho de erro (API recusa/falha) e caminho de sucesso, mesmo
  padrão dos outros formulários já migrados (`ContactSection.tsx` → `contactMessagesApi`)

### W-05 · Tirar o `.env` do controlo de versões
- **Onde:** `.gitignore` (já actualizado), falta `git rm --cached .env`
- **Nota honesta:** as três variáveis actuais são `VITE_*`, públicas por natureza — vão no bundle do browser de qualquer forma. **Não é uma fuga de segredos hoje.** É uma armadilha para amanhã: a API vai precisar de `service_role`, credenciais SMTP e tokens de pagamento, e com o `.env` versionado isso é commitado sem ninguém dar por ela
- **Pronto quando:** `git ls-files .env` não devolve nada e `.env.example` está commitado

---

## SPRINT 0 — Parar de parecer partido · Lukeny · em paralelo

**Objectivo:** um visitante (ou uma clínica a avaliar a parceria) não encontra nada
visivelmente avariado. Nenhuma destas tarefas toca base de dados, RLS ou paywall.

### L-01 · Repor as 8 imagens perdidas no export da Lovable
- **Onde:** ficheiros `src/assets/*.asset.json` que apontam para `/__l5e/assets-v1/...`
- **Causa:** ao exportar da Lovable, as imagens ficaram no CDN deles e nunca vieram para o repositório
- **Quatro têm equivalente local** já em `public/`: `estrabismo-intro-boy`, `eye-comparison`, `registo-premium-doctor`, `pillar-educacao-kids` → basta apontar para o ficheiro local
- **Quatro não têm** e precisam de imagem nova: `tipos-estrabismo`, `populares-boy`, `consequencias-estrabismo`, `tratamento-exam`, `ocularis-home1`
- **Aproveitar para resolver o outro problema:** o relatório UX pede fotografias reais de pessoas negras angolanas em vez de imagens genéricas. Como estas têm de ser substituídas de qualquer forma, substituir por imagens representativas resolve os dois pontos de uma vez
- **Pronto quando:** nenhuma imagem do site fica em branco, e `grep -r "__l5e" src/` não devolve nada

### L-02 · Vídeos dos exercícios
- **Onde:** `src/pages/Exercicios.tsx` referencia `/videos/exercicio-*.mp4`; a pasta `public/videos` **não existe**
- **Decisão de produto primeiro:** ou se produzem os 4 vídeos, ou se remove o player até existirem. Um player vazio é pior do que nenhum player
- **Pronto quando:** ou os vídeos tocam, ou o player não aparece

### L-03 · Modal "Últimas Referências" não faz scroll até ao fim
- **Fazer:** altura máxima com `overflow-y: auto` no corpo do modal
- **Pronto quando:** a última referência da lista é alcançável em telemóvel

### L-04 · Correcções de navegação
- Links rápidos não levam ao topo da página de destino → repor scroll no destino
- O terceiro link rápido não funciona → identificar e corrigir
- Link do Google Maps abre no mesmo separador → `target="_blank" rel="noopener noreferrer"`
- **Pronto quando:** cada link do rodapé foi clicado e leva onde promete

### L-05 · Dois ajustes visuais apontados na avaliação
- Botão "Voltar" pouco visível → contraste, posição ou tamanho
- Botão de perfil colado ao logótipo depois do login → espaçamento

### L-06 · Levantamento completo de botões e links
- O relatório diz que há mais elementos partidos além dos identificados
- **Fazer:** percorrer o site elemento a elemento e registar o que não responde, numa lista neste ficheiro
- **Pronto quando:** existe uma lista fechada — não é preciso corrigir tudo, é preciso saber o tamanho do problema

---

## SPRINT 1 — Fundação · Wilson ∥ Conteúdo · Lukeny

### Wilson — a API

#### W-06 · Serviço FastAPI publicado no Cloud Run
- Estrutura em camadas (`routers` / `services` / `repositories` / `schemas` / `core`)
- **Pronto quando:** um endpoint de healthcheck responde em produção

#### W-07 · Validação de JWT e reencaminhamento do login
- A API fala com o Postgres **em nome do utilizador**, para o RLS continuar a proteger por baixo
- `service_role` fica reservada a operações elevadas identificadas
- **Pronto quando:** um pedido sem token devolve 401; um pedido com token lê apenas os dados desse utilizador

#### W-08 · CI
- `pytest` + build da imagem Docker na API; `lint` + `test` + `build` no frontend
- **Pronto quando:** um PR com teste a falhar é bloqueado automaticamente

#### W-09 · Motor de análise — ⚠️ nota desactualizada, corrigida 2026-09-17
- **A assunção abaixo já não é verdade e não deve orientar mais nenhum trabalho.**
  Ficou aqui como registo de como o plano evoluiu, não como estado actual
- ~~**Assunção fixada:** não existe código nem base do scanner de IA. O `janelas-scanner-api`
  deixa de constar do plano.~~ O `janelas-scanner-api` **existe e está em produção** —
  um microserviço FastAPI à parte (fora deste monorepo), que `Scanner.tsx` chama via
  `POST /screening/multi-gaze` (`src/services/api/screeningApi.ts`) com as 3 fotografias
  guiadas, e devolve medições reais de alinhamento ocular por olho (posição, desvio
  horizontal/vertical, qualidade de captura). Quem o construiu e quando não está
  documentado aqui — só se percebeu ao abrir `Scanner.tsx` para corrigir o W-04
- **O que existe agora do lado da API própria (2026-09-17):** o resultado desse
  microserviço passou a persistir-se em `screenings` (tabela já existente na baseline,
  antes órfã) através de `POST /screenings` / `GET /screenings/minhas`
  (`app/routers/screenings.py`) — nunca a fotografia, só as medições (CLAUDE.md §4.4)
- **O que continua por fazer:** validar clinicamente as medições que o `janelas-scanner-api`
  devolve (não há parceiro clínico a confirmar casos reais, ver bloqueio nº8 mais abaixo),
  e decidir se esse microserviço passa a viver dentro deste monorepo ou fica separado
  a prazo. A extracção de pontos faciais no browser (`useEyeTracking.ts`,
  `EyeLandmarkOverlay.tsx`, FaceMesh) continua a ser usada só para o overlay ao vivo, não
  para o cálculo em si — isso acontece no microserviço

### Lukeny — conteúdo e estrutura

#### L-07 · Termos de Uso
- `Politicas.tsx` intitula-se "Políticas de Privacidade **e Termos de Uso**" mas as 5 secções são todas de privacidade. Os Termos não existem
- **Fazer:** escrever os Termos de Uso (condições de utilização, limitações de responsabilidade — sobretudo o aviso de que o rastreio **não substitui diagnóstico médico** —, condições do Plano Premium)
- **Pronto quando:** o título da página corresponde ao conteúdo

#### L-08 · Ordem da informação segue o menu
- "Serviços" abre com "A Nossa Visão" em vez dos serviços; o mesmo em "Produtos"
- **Pronto quando:** cada página começa por aquilo que o menu promete

#### L-09 · Separar planos de exercícios
- Hoje os exercícios aparecem misturados com os planos. Apresentar os planos como grupos com lista, distintos dos exercícios
- ⚠️ **Depende de W-01** (paywall) estar fechado — mesma página. Wilson primeiro, é uma linha

#### L-10 · Linguagem
- "Três tiers, três formas de transformar" mistura inglês com português
- **Pronto quando:** não há termos em inglês no texto visível ao utilizador

---

## SPRINT 2 — Premium real · Wilson ∥ Candidaturas · Lukeny

### W-11 · Confirmação de pagamento activa o Premium — ✅ **FEITO a 2026-09-10**
Ver secção "W-11 · Confirmação de pagamento activa o Premium" no bloco de trabalho
concluído, mais acima. Nota de infra: já não há `service_role` (não há Supabase); a
autorização é a dependency `obter_utilizador_admin`. O Premium é `utilizadores.premium_ativo`,
não `papel → premium` (ver `CLAUDE.md` §0). A transacção `status → aprovado` +
activação do utilizador + auditoria está no `PremiumService`, com testes.

### L-11 · Botão "Aprovar pagamento" no painel
- Em `AdminInbox.tsx`, distinto do "Contactado" já existente
- Consome o endpoint de W-11 — **depende dele**

### L-12 · Ecrã "a aguardar aprovação"
- Para quem tem pedido pendente, reutilizando `LockedVideoOverlay` / `PremiumPaywallModal`

### W-12 + L-13 · Sistema de candidaturas
- Voluntários e clínicas parceiras chegam hoje só por email
- Seguir as **10 boas práticas do [`README.md`](../README.md#10-gestão-de-candidaturas--boas-práticas)**: máquina de estados, transições auditadas, notificação em cada mudança, RLS de submissão pública com leitura restrita
- **Wilson:** tabela, RLS e service com a máquina de estados
- **Lukeny:** formulários e página de gestão no painel, seguindo o padrão de `AdminInbox.tsx`

---

## SPRINT 3 — Scanner clínico · Wilson

> **Este é o sprint mais difícil do projecto, e o menos parecido com programação.**
> Vale a pena ser directo: extrair pontos faciais é a parte fácil, e já está feita.
> Transformar esses pontos num número que signifique alguma coisa em oftalmologia é
> investigação clínica aplicada — não se resolve escrevendo mais código.

### O que torna isto diferente de tudo o resto no backlog

| | |
|---|---|
| **Já resolvido** | Detecção de rosto e íris com FaceMesh, em tempo real, no browser |
| **Por resolver** | Que medida usar, como calibrá-la, e como saber se está certa |

Um ângulo de desvio calculado a partir de uma webcam depende da distância ao ecrã, do
ângulo da cabeça, da iluminação e da resolução. Sem calibração e sem validação contra
casos reais com diagnóstico conhecido, o número produzido **não é melhor do que o
`Math.random()` que estamos a remover** — só parece mais credível, o que é pior.

### W-13 · Escolher e documentar o método de medição
- Investigar qual o método aplicável por webcam (reflexo corneano / Hirschberg é o
  candidato mais provável para rastreio não-especializado)
- **Pronto quando:** existe um documento que diz que medida se calcula, a partir de que
  pontos, e quais os seus limites conhecidos
- **Precisa de validação clínica** — não é decisão de programador

### W-14 · Calibração
- Compensar distância à câmara e inclinação da cabeça, ou definir e impor as condições de
  captura (o `Scanner.tsx` já guia 3 poses — é a base para isto)
- **Pronto quando:** duas capturas da mesma pessoa em condições diferentes dão resultados próximos

### W-15 · Serviço de análise na API
- `services/` recebe coordenadas → calcula → devolve medição + grau de confiança **real**
- **Testes obrigatórios** com casos de referência conhecidos: é lógica de resultado clínico

### W-16 · Validação contra casos reais
- **É isto que separa um produto clínico de uma demonstração.** Precisa de casos com
  diagnóstico já estabelecido por um profissional, para comparar
- **É aqui que a rede de parceiros deixa de ser só distribuição e passa a ser
  infraestrutura:** IONA, AOOA ou uma clínica parceira são a única via realista para obter
  casos validados. Sem isso, não há como afirmar que o rastreio funciona
- **Pronto quando:** há uma taxa de acerto medida, escrita, e um profissional de saúde
  disposto a assinar por baixo dela

### W-17 · Política de não guardar imagens
- Processar → extrair medições → descartar. Balde de 1 GB do Supabase esgota aos ~1.500
  exames, e são imagens faciais de crianças

### L-14 · Ecrã de resultados ligado ao relatório real
- Substitui o texto estático actual. Só depois de W-16 — até lá, o ecrã mitigado de W-04
  ("sinais observados") é o comportamento correcto

> **Regra que não se negoceia:** o ecrã só volta a usar a palavra *diagnóstico* depois de
> W-16 estar fechado. Até lá, é "sinais observados, sujeitos a confirmação clínica".

### Nota sobre o Google Cloud trial

Há crédito de trial disponível, o que ajuda — mas com uma armadilha conhecida:

- **Usar o trial para medir, não para viver nele.** Serve para descobrir quanto tempo demora um arranque a frio com o MediaPipe carregado e quanta memória é precisa
- **Configurar para caber no escalão gratuito permanente**, não no crédito. Quando o crédito acabar, o serviço tem de continuar a funcionar sem mudar de sítio
- **Uma excepção legítima:** manter uma instância quente durante demonstrações a clínicas parceiras. Vale o crédito — só não pode virar o pressuposto do dia-a-dia
- **Anotar a data de expiração do crédito** num sítio visível. Créditos de trial acabam sempre em cima de uma demonstração importante

---

## SPRINT 4 — Matchmaker clínico e teleconsulta (revisto 2026-09-24)

**Porque isto deixou de ser "só um formulário":** o pitch deck já afirma às clínicas que o
agendamento com a Optioptika *"não é uma promessa de roadmap"* — hoje é mentira: o
`OptioptikaBookingDialog.tsx` fabrica um "recibo" com um número de pedido inventado no
browser (`OPT-${Date.now()...}`) e nunca sai dali. Nem a Optioptika nem ninguém do lado
da equipa fica a saber que alguém pediu uma consulta. O separador "Clínicas" dos
resultados do scanner (`ScannerResultados.tsx`) tem o mesmo problema pelo lado oposto: o
botão "Agendar" só abre o site externo da clínica, sem nenhum registo do lado de cá.

**A ideia original do projecto para isto já está semeada no código, só nunca foi
construída:** `DashboardPro.tsx` já existe com "Pacientes atribuídos", "Teleconsultas
agendadas" e uma secção "Em breve" a prometer "agenda integrada de teleconsultas" e
"emissão de recomendações clínicas" — mas está inacessível (sem link em lado nenhum do
site) e todos os números são `—`. Os papéis `profissional` (auto-registável, sem
verificação) e `oftalmologista` (só promovível por admin) já existem no sistema de
utilizadores. Não há nenhuma dependência de videochamada instalada — a teleconsulta em
si nunca chegou a começar.

**Reformulação:** não é um formulário de contacto, é o segundo pilar do produto — um
mercado de três lados (paciente, clínica/médico, plataforma), cada um com algo a ganhar e
algo a dar. Faseado para que cada fase seja entregável e útil sozinha:

### Fase 0 — Pedido de consulta real (a fundação de tudo o resto)
- **L:** tabela `agendamentos_clinicos` (migração aditiva, padrão de `sessoes_exercicio`),
  desenhada desde já com `clinica_id`, `profissional_id` (nulável — nem toda a fase 0
  precisa de um profissional atribuído), `modalidade` (`presencial`/`online`), `estado`,
  e `screening_id` opcional (liga o pedido ao rastreio que o motivou, quando existir) —
  **nunca hardcoded a uma clínica só**, para as fases seguintes não obrigarem a reescrever
  o esquema
- **W:** endpoints de criação (paciente) e decisão (admin, por agora — sem portal da
  clínica ainda)
- **L:** liga `ClinicalPartners.tsx`/`OptioptikaBookingDialog.tsx` e o separador
  "Clínicas" de `ScannerResultados.tsx` à API; página `AdminAgendamentos.tsx`
- **W:** email real de confirmação ao paciente e de aviso à equipa/clínica, mesmo padrão
  já usado em candidaturas de voluntariado (`CandidaturaVoluntariadoService`)
- **Pronto quando:** um pedido de consulta feito no site aparece de facto para um admin
  decidir, e a Optioptika (ou quem for) recebe um email real — nunca mais um recibo
  fabricado no browser

### Fase 1 — Matchmaking real
- Perfil de clínica/profissional: especialidades, cidade, modalidade, preço
- Correspondência por regras (não ML — seria over-engineering nesta fase): tipo de
  diagnóstico do scanner + localização + modalidade + prioridade para quem tem Premium
- Disponibilidade do profissional: horário semanal recorrente simples, não um calendário
  completo — o paciente passa a escolher um horário real, não "de manhã, mais ou menos"

### Fase 2 — A teleconsulta em si
- **Não construir infra de videochamada própria.** Usar um fornecedor alojado (Daily.co
  ou 100ms, SDK simples, custo por minuto) — montar sinalização WebRTC de raiz não se
  justifica para o volume inicial
- Ciclo de vida da sessão: agendada → em curso → concluída → relatório
- O médico emite uma recomendação clínica no fim — fecha o que `DashboardPro.tsx` já
  promete

### Fase 3 — Notificações a sério
- Email já é o padrão do projecto; para Angola, **WhatsApp Business API** é a alternativa
  com mais impacto real em lembretes de consulta (penetração muito mais alta que email,
  reduz faltas de forma muito mais eficaz) — avaliar como próximo canal, não só
  "bom teria"

### Fase 4 — Fechar o modelo de negócio
- Ligar à subscrição Premium já existente: prioridade de marcação ou créditos de
  teleconsulta incluídos para quem paga; utilizador gratuito paga por consulta
- Clínicas pagam por visibilidade/selo verificado na "Rede de Parceiros" — só é possível
  negociar isto depois de a Fase 0 dar números reais de leads gerados para mostrar
  a clínicas novas

### Riscos a não ignorar
- **Verificação de profissionais:** hoje qualquer conta pode registar-se como
  `profissional` sem nenhuma credenciação. Antes de ligar pacientes a "médicos" a sério,
  precisa de existir um passo de verificação (documentos, ordem profissional) — risco
  legal e de confiança real sem isto
- **Dados de saúde de crianças:** o mesmo cuidado já aplicado ao scanner (CLAUDE.md §4)
  estende-se a relatórios clínicos e notas do médico
- **Sequenciar a sério.** A tentação de construir o matchmaker completo de uma vez é o
  maior risco de nunca se enviar nada — cada fase acima tem de ser entregável sozinha

---

## SPRINT 5 — Unificação de papéis · Wilson

`profiles.papel` e `user_roles` são duas fontes de verdade paralelas. Cada papel novo
acrescentado antes disto agrava o problema.

- Decidir a lista oficial (paciente, profissional, oftalmologista, voluntário, admin) — decisão de negócio antes de código
- Migração de unificação + actualizar todos os pontos de leitura

---

## SPRINT 6 — Produto

- Histórico de exames com evolução ao longo do tempo (**L**)
- Painel pessoal com dados reais — hoje "4 exercícios" e "próxima teleconsulta" são valores fixos (**L**)
- Exercícios premium restantes, sobre `BaseExercise` (**L**)
- Loja de óculos com carrinho e pagamento (**W+L**)
- Conteúdo editável pelo administrador (**W+L**)

---

## Sprint planeado — Identidade externa e email (decidido 2026-09-10, não iniciado)

Discussão tida a 2026-09-10 (ver também [[gcloud-trial-google-auth-platform]] na memória).
Decisão do dono do projecto: **fazer**, num sprint próprio, mais para a frente. Não é
para hoje. Três peças que andam juntas porque partilham a mesma infra de email:

1. **Autenticação com a Google (Sign in with Google).**
   - OAuth2/OIDC via Google Identity Services — *OAuth client ID* criado na consola GCP
     (APIs & Services → Credenciais). Grátis, sem dependência gerida nova.
   - Implementa-se **dentro do `auth_service.py`**: verificar o ID token da Google no
     servidor, criar/ligar uma linha em `utilizadores`. Mantém o modelo JWT + cookie
     `httpOnly` já existente.
   - Esquema: coluna `google_sub` (unique) em `utilizadores`, `password_hash` passa a
     nullable (contas só-Google não têm password). Migração Alembic aditiva.
   - **Não** reintroduzir Firebase Auth / Identity Platform — é o tipo de auth gerido
     que a reescrita passou 6 sprints a remover do Supabase.

2. **Recuperação de palavra-passe por email.**
   - Substitui o recado fixo de `Auth.tsx` ("ainda não está disponível"). Fluxo:
     pedir → token de uso único com validade curta guardado (hash) → email com link →
     `AtualizarPassword.tsx` (já existe, hoje ligado ao Supabase) reescrito para a API.
   - **Bloqueado por:** escolher o fornecedor de email (ver abaixo).

3. **Confirmação de conta por email no registo.**
   - O registo passa a criar a conta como *não confirmada*; email com link de
     confirmação; até confirmar, sessão limitada ou bloqueada (decidir o grau).
   - Esquema: `email_confirmado bool` + token de confirmação (mesma tabela/mecanismo
     do ponto 2).
   - **Bloqueado por:** o mesmo fornecedor de email.

**Decisão que falta (bloqueia 2 e 3):** qual o fornecedor de email transacional. O
GCloud não tem serviço nativo. Candidatos: **Resend** (mais simples), **SendGrid**
(tier grátis no marketplace GCP), **AWS SES** (mais barato a volume). Chamada por API
HTTP a partir do FastAPI (o Cloud Run bloqueia SMTP), chave no Secret Manager.

### Fornecedor decidido: Resend — recuperação de password fechada (2026-09-14)

Decisão do dono do projecto: **Resend**, sem mais adiar. Só a recuperação de password
avançou agora (CROSS-04) — confirmação de conta por email (ponto 3 acima) e login com
Google (ponto 1) continuam deliberadamente fora deste PR, cada um merece o seu próprio.

O que ficou feito:

- **Tabela nova** `tokens_recuperacao_password` (migração `a1f3c9e7d2b4`) — guarda o
  **hash** do token (nunca o valor em claro), com `expira_em` (30 minutos) e `usado_em`
  (uso único). Mesmo princípio de uma password: uma fuga da tabela não dá a ninguém um
  link válido.
- **`api/app/core/email.py`** — `EmailSender` (Protocol) + `ResendEmailSender`, chamada
  HTTP directa (`httpx`) à API do Resend, sem SDK a mais. Mesmo padrão do `Presigner` em
  `repositories/storage.py`: o service depende do Protocol, não da implementação, para
  ser testável sem rede.
- **`api/app/services/recuperacao_password_service.py`** — `solicitar()` nunca revela
  se um email existe (mesma resposta, exista conta ou não); `redefinir()` valida token
  existente + não usado + não expirado antes de trocar a password. Nunca mostra sucesso
  se o Resend falhar de verdade — só o caso "email não existe" parece sucesso ao
  chamador, um erro real do Resend propaga como erro (ver CLAUDE.md, "nunca mostrar
  sucesso antes de verificar erro").
- **`POST /auth/recuperar-password`** (sempre 202, mesma resposta) e
  **`POST /auth/redefinir-password`** (400 se o token for inválido/expirado/usado).
- **Frontend:** `Auth.tsx` (botão "Esqueceu a palavra-passe?" deixa de mostrar o aviso
  fixo, chama a API a sério) e `AtualizarPassword.tsx` (reescrito de raiz — já não
  depende do Supabase Auth nem do evento `PASSWORD_RECOVERY`; o token vem em `?token=`
  na própria URL e é validado directamente pela API).
- **Testes:** 14 novos na API (service + router, cobrindo token válido/expirado/já
  usado/inexistente, e a resposta idêntica com/sem conta) e 8 no frontend.

**CROSS-07 — resolvida a 2026-09-14, confirmada a funcionar a 2026-09-15:** domínio
`janelasparaalma.com` verificado no Resend (`GET /domains` → `status: verified`,
`sending: enabled`) e chave de API gerada. **Testado a sério** — não só com o
`EmailSender` falso dos testes automatizados: um pedido real a
`POST https://api.resend.com/emails` com a chave e o remetente configurados foi aceite
e o email chegou à caixa de entrada. A integração está confirmada de ponta a ponta;
falta só colar `RESEND_API_KEY` no Secret Manager via
`infra/gcloud/03-secrets.sh` — bloqueado por **DEP-02** (o projecto GCloud com
facturação ainda não existe). Até lá, dá para testar tudo localmente: definir
`RESEND_API_KEY` e `EMAIL_REMETENTE=noreply@janelasparaalma.com` em `api/.env`
(gitignored — nunca commitar a chave) e correr a API sem Docker
(`python -m uvicorn app.main:app --reload`), ou passá-las como variável de ambiente ao
`docker compose up`. `04-deploy.sh` já sabe pegar no segredo automaticamente assim que
`03-secrets.sh` o tiver criado — nenhum código a mudar quando o DEP-02 destrancar.

### AUTH-02 fechada — confirmação de conta por email, bloqueio total (2026-09-14)

Decisão do dono do projecto, resolvendo a pergunta em aberto desde a Sprint planeada de
"identidade externa e email": **bloqueio total**. Uma conta recém-registada não entra —
nem com a password certa — até confirmar o email. Mais simples de raciocinar sobre
segurança do que uma "sessão limitada" (essa exigiria gating em vários sítios do
frontend, não só no login), e é a leitura mais directa do que já estava escrito no
`tarefas.csv`: "nunca redirecionar como se logado".

O que ficou feito:

- **`utilizadores.email_confirmado`** (migração `c7e4b8a1f6d3`, aditiva) — `false` por
  omissão. **`tokens_confirmacao_email`** — mesmo desenho de
  `tokens_recuperacao_password` (hash do token, expiração, uso único), só com validade
  mais longa (24h, contra 30 min da recuperação de password — confirmar não é tão
  urgente como recuperar acesso perdido).
- **`POST /auth/registar` deixa de definir cookies.** A conta é criada na mesma (commit
  na base de dados não muda), mas fica por confirmar — sem sessão nenhuma até ao clique
  no link. Manda sempre o email de confirmação a seguir; se o Resend falhar nesse
  momento, a conta não é revertida (já existe de facto) — fica registado no stderr, e a
  pessoa tem sempre `/auth/reenviar-confirmacao` como via de recuperação.
- **`AuthService.autenticar()`** verifica a password primeiro (mantém a mensagem
  genérica de sempre para email/password errados) e só depois checa
  `email_confirmado` — um `EmailNaoConfirmadoError` próprio, que o router mapeia a 403
  com uma mensagem explícita (aqui já não há razão para esconder a causa, ao contrário
  do caso email/password).
- **`POST /auth/confirmar-email`** (400 se o token for inválido/expirado/usado) e
  **`POST /auth/reenviar-confirmacao`** (sempre 202, mesma resposta exista ou não a
  conta, esteja ou não já confirmada — mesmo princípio anti-enumeração da recuperação
  de password).
- **Frontend:** `AuthContext.registerUser` deixa de marcar sessão local no sucesso;
  `Auth.tsx` passa a ter separadores controlados — depois de registar, muda para o
  login com o email pré-preenchido e um toast a explicar o próximo passo. Um login
  recusado por email não confirmado ganha um botão "Reenviar link" directamente no
  toast de erro. Página nova `ConfirmarEmail.tsx` (rota `/confirmar-email?token=...`) —
  só confirma, nunca inicia sessão automaticamente (mesma decisão de manter os dois
  passos separados).
- **Efeito colateral útil, descoberto ao testar:** sem isto, `npm run dev`/`uvicorn`
  locais sem `RESEND_API_KEY` configurada deixariam de conseguir registar contas
  nenhumas (o registo passou a depender do envio do email de confirmação). Corrigido
  com um `ConsoleEmailSender` de fallback em `core/email.py` — sem chave, imprime o
  email no terminal em vez de tentar chamar o Resend a sério. Beneficia também a
  recuperação de password (CROSS-04), que tinha o mesmo ponto cego.
- **Testes:** ~30 novos/alterados na API (service dedicado + router, cobrindo o
  bloqueio de login, confirmação válida/expirada/já usada, reenvio com/sem conta) e 13
  no frontend. Teve ripple noutros ficheiros de teste que assumiam "registar = já hei-
  de estar autenticado" (perfil, sessões de exercício, uploads, feedback, conta) — cada
  um passou a confirmar explicitamente a conta de teste antes de entrar.

### CROSS-08 — o painel de administração estava, na prática, inacessível (2026-09-15)

Achado ao investigar "o Supabase já saiu do frontend?" (pergunta directa do dono do
projecto) — não é só dívida por terminar, é uma funcionalidade **estragada**: nenhum
admin do sistema novo conseguia entrar no painel.

Causa: `RequireAdmin`, `AdminSidebar` e `useSupabaseRole`/`useAdminScope` liam
`supabase.auth.getSession()` — a sessão do **Supabase**, inteiramente separada da
sessão da API própria (cookie `httpOnly` + JWT). Uma conta que se regista/entra pelo
`/auth/registar`/`/auth/entrar` novos nunca cria sessão nenhuma no Supabase, por isso
`getSession()` devolvia sempre `null` para ela. Como a base de dados nasce vazia (sem
importação de contas do Supabase, decisão da Sprint 0), **não existia nenhum admin real
do sistema novo capaz de passar nesta porta** — só continuaria a "funcionar" para quem
tivesse por acaso uma sessão Supabase antiga, de antes desta reescrita começar.

Corrigido:

- `AuthContext.tsx` ganha `isAdmin` (`papel === "admin"`), derivado da mesma sessão que
  já existia — nenhum pedido novo à API, só uma leitura do que `/auth/eu` já devolvia.
- `RequireAdmin.tsx`, `AdminSidebar.tsx` (logout e menu), `Navbar.tsx` e `Parceiros.tsx`
  passam a usar `useAuth()` em vez de `useSupabaseRole`.
- `AdminSidebar` deixa de filtrar o menu por `useAdminScope` (permissões granulares do
  Supabase, tabela `admin_permissions`) — "admin" é binário na API própria (uma coluna
  `papel`, ver `obter_utilizador_admin`), mesma simplificação que `AdminAdmins.tsx` já
  tinha adoptado antes (W-11). Um admin vê o menu inteiro; não há hoje noção de admin
  parcial.
- Saem `useSupabaseRole.ts` e `useAdminScope.ts` — nenhum ficheiro os importa mais.
- Testes novos: `RequireAdmin.test.tsx` (loading / sem sessão / sem ser admin / admin) e
  2 casos em `AuthContext.test.tsx` para `isAdmin`.

**Fora de âmbito deste PR, de propósito:** as 4 páginas de dados do painel
(`AdminOverview` → `profiles`, `AdminUsers` → `user_roles`, `AdminContent` →
`site_content`, `AdminNotifications` → `notifications`) continuam a ler directamente do
Supabase. Migrar a sessão resolve "consigo entrar?"; estas páginas são trabalho novo —
tabelas e endpoints que ainda não existem na API própria, não só troca de chamada. Ver
CROSS-03.

### CROSS-09 — desfeito o retrocesso da doação de materiais (2026-09-15)

O PR #27 (`fix(doacoes): unifica materiais e financeiro no Supabase (temporario)`, já
mesclado) tinha posto `Apoiar.tsx` (modo "materiais") a chamar de novo o Supabase
directamente — `supabase.from("doacoes").insert` + `supabase.functions.invoke
("enviar-email-doacao")` — explicitamente enquanto a infra de email em Python não
estava pronta. Essa razão deixou de existir com o Resend (CROSS-01/CROSS-04/CROSS-07).

O que mudou:

- **`DoacaoService.registar_doacao_materiais`** ganha o passo de email de confirmação
  (via `EmailSender`, o mesmo Protocol de `core/email.py`), com o recibo e os materiais
  no corpo. Mantém o comportamento já testado deste fluxo desde a versão Supabase — ao
  contrário do registo de conta (AUTH-02, onde a conta já criada É o sucesso), aqui uma
  falha no envio conta como falha do pedido inteiro: nunca "doação recebida" sem a
  confirmação também sair. A doação em si não é apagada (fica `pendente` na base de
  dados, visível a um admin) — só a resposta ao chamador não finge sucesso.
- **`Apoiar.tsx`** (modo materiais) volta a chamar `doacoesApi.registarMateriais(...)` —
  um pedido só, gravação e email já vêm juntos do lado da API.
- Testes actualizados/novos: `test_doacao_service.py` (email enviado com o recibo,
  falha no envio propaga sem apagar o registo) e `test_doacoes_router.py`
  (500 quando o email falha) na API; `Apoiar.test.tsx` de volta ao mock de
  `doacoesApi` no frontend.

**Fica no Supabase, de propósito — bloqueado por storage, não por email:**
`Apoiar.tsx` (modo **financeiro**) e `RegistoPremium.tsx` continuam a mandar o
comprovativo de pagamento pela Edge Function `enviar-email-doacao`, que hoje é o
**único** sítio para onde esse ficheiro tem destino real (não há upload separado para
o R2 enquanto as credenciais não existirem — CROSS-02). Reverter estes dois sem ter
para onde mandar o ficheiro deixaria o comprovativo sem destino nenhum; fica para
quando o R2 estiver ligado.

### DEP-06 — deploy automático da API, código e migrações (2026-09-15)

Decisão do dono do projecto, pedida directamente: o Lukeny (ou quem for) precisa de
conseguir levar uma alteração ao backend a produção só com um push, tal como o frontend
já faz no Vercel. Isto **contraria** o que o `CLAUDE.md` dizia até aqui — "nenhuma
migração corre em produção sem confirmação humana", com pausa manual a seguir ao deploy
— e foi confirmado explicitamente depois de eu ter levantado esse ponto (ver a conversa
que levou a esta secção): a decisão fica registada como escolha consciente do dono do
projecto, não uma correcção silenciosa da regra antiga.

O que mudou:

- **`.github/workflows/ci.yml`** ganha o job `deploy-api`: corre só a seguir a `api` e
  `imagem-api` passarem, só em push directo a `main` (nunca em PRs, nunca em forks).
  Migra o esquema (`05-migrate.sh`) e só depois faz deploy do serviço (`04-deploy.sh`) —
  nessa ordem, sempre: código novo não deve começar a servir pedidos antes do esquema
  estar pronto para ele.
- **Sem chaves de longa duração**: autentica por **Workload Identity Federation**, não
  por uma chave JSON de service account descarregada e guardada como GitHub Secret. O
  GitHub prova quem é com um token OIDC assinado por ele próprio, válido minutos; o GCP
  confia nessa prova só para este repositório exacto (`attribute-condition` no
  provider). Provisionado por `infra/gcloud/06-ci-cd-setup.sh`, que também escreve a
  configuração resultante como Variables do repositório GitHub (`gh variable set`) —
  nada disto é secreto (nomes de projecto, região, emails de service account).
- **Rede de segurança automática, no lugar da pausa manual removida:**
  1. O CI já corre `alembic upgrade head` contra um Postgres real a cada PR (existia
     antes desta mudança) — se a migração não aplicar limpo, falha ali, nunca chega ao
     deploy.
  2. `05-migrate.sh` tira sempre um backup do Cloud SQL (`gcloud sql backups create
     --async`) logo antes de migrar a sério — ponto de restauro a minutos de distância.
  3. Corrido à mão fora do CI (`$CI` não definido), `05-migrate.sh` continua a pedir
     confirmação explícita como sempre pediu — só o caminho automático deixou de parar.
  4. A confirmação humana não desapareceu, mudou de sítio: passa a ser a própria
     revisão do PR antes do merge (já obrigatória para qualquer PR que toque esquema —
     `CLAUDE.md` §9 ponto 4), não uma segunda pausa depois disso.
- **`04-deploy.sh` e `05-migrate.sh` partilham agora `_build-imagem.sh`** (novo) — builda
  a imagem só se ainda não existir para o commit actual. Sem isto, cada script tinha a
  sua cópia da lógica de build, e corrê-los os dois (migrar depois de deployar, ou
  vice-versa) buildava a imagem duas vezes.
- `00-config.sh` (gitignored, só para uso local) passa a **opcional** em todos os
  scripts — no CI a mesma configuração vem de Variables do GitHub, nunca de um ficheiro.

**Bloqueado por DEP-02:** não há projecto GCloud ainda, por isso o job `deploy-api`
falha (sem credenciais válidas) até o `06-ci-cd-setup.sh` correr uma vez, depois do
`01`-`03`. Nenhum código fica por escrever à espera disso — fica pronto a activar.

### W-12 — voluntariado: candidatura, actividades e inscrições (2026-09-15)

Pedido directo do dono do projecto: pessoas poderem candidatar-se a voluntário, um
admin publicar actividades, e voluntários inscreverem-se e receberem confirmação por
email. O que existia até aqui (`VolunteerSection.tsx`, o formulário "Kamba") era só
uma Edge Function que enviava um email — nada ficava gravado, `papel: "voluntario"`
existia no enum mas não estava ligado a nada, e a tabela `Notification` já criada no
ORM nunca teve API nenhuma por cima (achado durante o levantamento inicial: o
`AdminNotifications.tsx` ainda no Supabase usa até colunas diferentes das do ORM).

Duas decisões do dono do projecto, pedidas explicitamente antes de escrever código:

1. **Candidatura exige conta** (não anónima como o formulário Kamba antigo) — sem
   isso não há como ligar "as minhas actividades" nem notificações a ninguém.
2. **MVP inclui limite de vagas; controlo de presença fica para depois.**

O que mudou:

- **`voluntariado` é um estado ortogonal ao `papel`**, não um valor dele — mesma
  correcção já feita para o Premium (ver `CLAUDE.md` §0): um profissional, um
  estrábico ou uma pessoa comum podem todos ser voluntários sem deixar de ser o que
  já são. `utilizadores.voluntario_ativo` (bool) é o "interruptor actual", mesmo
  desenho de `premium_ativo`.
- **`candidaturas_voluntariado`** — pedido com estado (`pendente`/`aprovada`/
  `rejeitada`) e auditoria de quem decidiu e quando, mesmo desenho de
  `premium_requests`. `CandidaturaVoluntariadoService.aprovar` liga
  `voluntario_ativo=true` na mesma transacção que decide o pedido — nunca podem ficar
  dessincronizados (mesmo cuidado do `PremiumRepository`).
- **`atividades_voluntariado`** — um admin publica (`titulo`, `descricao`, `local`,
  datas, `vagas` opcional). Publicar dispara um email a todos os voluntários activos
  com `notificacoes_projetos` ligado — a primeira utilização real desse campo de
  preferências, que existia desde o registo mas nunca tinha disparado nada.
- **`inscricoes_atividade`** — `UNIQUE(atividade_id, utilizador_id)` impede
  duplicação. `AtividadeVoluntariadoService.inscrever` verifica, sempre a partir da
  base de dados (nunca de um valor vindo do pedido): a actividade está publicada,
  quem pede é voluntário activo, ainda não está inscrito, e ainda há vagas.
- **Decisão deliberada sobre email, ao contrário das doações (`CROSS-09`):** aqui uma
  falha a enviar a confirmação **não** desfaz a candidatura/inscrição já gravada — o
  registo em si já é o estado de valor, e reverter obrigaria a um "tentar outra vez"
  que esbarraria na restrição `UNIQUE`. A falha fica só registada em log.
- Migração `cfaf27163f7e`. 42 testes novos (25 de service, 17 de router) — cobrem o
  caminho do erro tanto como o do sucesso: candidatura duplicada, decidir uma
  candidatura já decidida, inscrever sem ser voluntário activo, inscrever duas vezes,
  inscrever sem vagas, e a falha de email nunca impedir o registo.

**Fora deste PR, de propósito:**
- Frontend (ligar `VolunteerSection.tsx` à API, área "as minhas actividades",
  `AdminVoluntarios.tsx`, `AdminAtividades.tsx`) — ver `L-13`/`L-15`.
- Lembretes automáticos antes de uma actividade — precisa de um trigger por tempo
  (Cloud Scheduler ou um Cloud Run Job agendado) que ainda não existe — ver `W-18`.
- Corrida pela última vaga (duas inscrições em simultâneo a passar a verificação antes
  de qualquer uma gravar) é um risco teórico aceite para o volume esperado, não
  corrigido com `SELECT FOR UPDATE` — documentado, não esquecido.

### DEP-02 — primeiro deploy real (2026-09-15)

Projecto GCP criado pelo dono do projecto (`project-f083cafc-d127-435a-a77`,
`europe-west1`, facturação activa) e `01`→`04` correram pela primeira vez a sério.
Dois problemas de permissões apareceram — nenhum tinha aparecido antes porque nunca
tínhamos corrido isto contra um projecto GCP genuinamente novo:

1. **`gcloud builds submit` falhava com "storage.objects.get denied"** ao tentar ler
   a própria fonte que acabara de enviar. Causa: projectos GCP criados recentemente
   já não recebem `Editor` automático no service account por omissão do Compute
   Engine (endurecimento de segurança da Google, mudança relativamente recente) — o
   SA que o Cloud Build usa por omissão não tinha literalmente nenhum papel.
2. **O Job de migração e o deploy da API falhavam a ligar ao Cloud SQL** com
   `403 NOT_AUTHORIZED ... cloudsql.instances.get`. Mesma causa raiz: o SA por
   omissão também precisa de `roles/cloudsql.client` para o proxy do Cloud SQL
   embutido no Cloud Run funcionar.

Corrigido de vez em `01-bootstrap.sh` — passa a conceder `roles/cloudbuild.builds.builder`
e `roles/cloudsql.client` ao SA por omissão do Compute Engine, para nenhum projecto
novo voltar a tropeçar nisto. Também corrigido um bug real (não de permissões) em
`_build-imagem.sh`: `gcloud builds submit --config=-` não lê de stdin no `gcloud`
actual — tenta abrir literalmente um ficheiro chamado `-` e falha. Passa a escrever
a configuração num ficheiro temporário real.

Resultado: `jpa-db` (Cloud SQL) a correr, segredos no Secret Manager, esquema
migrado até `cfaf27163f7e` (inclui o voluntariado do PR #37), API viva em
`https://jpa-api-73u3krcgwa-ew.a.run.app` — `/saude` e `/auth/eu` confirmados a
responder correctamente. `frontend/vercel.json` actualizado com o URL real (deixa de
apontar para o placeholder `SUBSTITUIR-PELO-URL-DA-API.run.app`) — isto desbloqueia
tudo o que já estava construído e à espera disto (login, registo, recuperação de
password, confirmação de email, painel admin, doações), que estava silenciosamente
partido em produção desde o corte do domínio para o Vercel.

**Falta ainda:** correr `06-ci-cd-setup.sh` para o deploy automático (`DEP-06`) ficar
mesmo activo a partir de agora — feito manualmente desta vez.

### Backups automáticos do Cloud SQL estavam desligados (2026-09-15)

Achado ao responder a uma pergunta directa do dono do projecto ("os dados são apagados
a cada deploy? onde está o backup?"): a instância `jpa-db`, criada no DEP-02, tinha
`backupConfiguration.enabled: false` — nenhum backup diário automático. A única rede
de segurança que existia era o backup avulso que o `05-migrate.sh` dispara mesmo antes
de cada migração (bom para proteger uma migração; nada protegia os dados no dia-a-dia
entre migrações, ex.: um erro de operação, não de esquema).

Corrigido nos dois sítios:

- **A instância já criada** (`jpa-db`): activados backups diários (03:00, 7 dias de
  retenção) e recuperação num ponto no tempo (`point-in-time recovery`) — permite
  restaurar para qualquer instante exacto dentro da janela de 7 dias, não só para o
  momento de um backup.
- **`02-cloud-sql.sh`**: `gcloud sql instances create` ganha
  `--backup-start-time=03:00 --retained-backups-count=7 --enable-point-in-time-recovery`,
  para nenhuma instância nova voltar a nascer sem isto.

Confirmado com `gcloud sql instances describe jpa-db` e `gcloud sql backups list` —
`enabled: true`, `pointInTimeRecoveryEnabled: true`, e os dois backups avulsos das
migrações do DEP-02 já visíveis com `STATUS: SUCCESSFUL`.

### DEP-06 — três permissões em falta, achadas no primeiro deploy automático real (2026-09-15)

`06-ci-cd-setup.sh` correu, e o `deploy-api` do CI passou a correr (deixou de aparecer
"skipping") — mas falhou três vezes seguidas, cada vez por um motivo diferente, todos
do mesmo tipo: permissões que só aparecem quando **um service account restrito**
(`jpa-deploy`, não um humano com `Owner`) tenta fazer a mesma operação que eu já tinha
testado manualmente como Owner. Testar como Owner nunca ia mostrar nada disto.

1. `gcloud builds submit` recusado com *"forbidden from accessing the bucket
   [..._cloudbuild]"*, a sugerir `serviceusage.services.use`. Corrigido dando a
   `jpa-deploy` o papel `roles/serviceusage.serviceUsageConsumer`.
2. Mesmo comando, erro diferente a seguir: o mesmo tipo de acesso ao bucket, desta vez
   resolvido com `roles/cloudbuild.builds.builder` (o mesmo papel que já tinha
   resolvido um erro parecido para o service account de runtime, no DEP-02).
3. Com as duas permissões acima, **o build em si passou a ter sucesso** — mas o
   comando `gcloud builds submit` continuava a devolver erro, porque tenta mostrar os
   logs do build ao vivo, e isso exige que quem chama seja Viewer/Owner do *projecto*
   (não chega ter papéis específicos do Cloud Build) quando os logs vão para o bucket
   GCS por omissão. `jpa-deploy` não é Viewer do projecto, de propósito (permissões
   mínimas). Corrigido na raiz, não com mais um papel: `_build-imagem.sh` passa a
   configurar `options.logging: CLOUD_LOGGING_ONLY` no Cloud Build, o que evita por
   completo a necessidade de acesso ao bucket GCS para ler logs.

**Lição a levar**: sempre que se testar um fluxo de permissões novo, testar como o
service account real que o vai executar em produção, nunca só como Owner — um Owner
nunca vê estes erros.

### DEP-06 — a base de dados ficou à frente do `main` (2026-09-15)

Depois de corrigir as três permissões acima, o `deploy-api` voltou a falhar — desta
vez sem nada a ver com permissões: `alembic` recusou-se a correr com
`FAILED: Can't locate revision identified by 'cfaf27163f7e'`.

Causa: ao correr as migrações manuais do DEP-02, a pasta local ainda estava na branch
`api/voluntariado-atividades` (do PR #37, nessa altura por rever) em vez de `main` —
sem reparar nisso, a imagem construída e a migração aplicada usaram o código dessa
branch, que inclui a migração do voluntariado (`cfaf27163f7e`). A base de dados de
produção ficou a marcar essa revisão como aplicada, mas o `main` — o que o
`deploy-api` automático de facto usa — nunca teve essa migração, porque o PR #37
continuava por mesclar. Todo o deploy automático a seguir falhava logo ao arrancar,
porque o Alembic não encontra no histórico do `main` uma revisão que a base de dados
diz já ter.

Corrigido mesclando o PR #37 para o `main` — alinha o código com o que já estava de
facto na base de dados, em vez de reverter dados reais.

**Lição a levar**: antes de qualquer operação que toque produção a sério (build,
migração, deploy), confirmar explicitamente `git branch --show-current` — nunca supor
que a pasta está no `main` só porque foi lá que se começou a sessão.

### AUTH-03 — login com Google (2026-09-15)

Pedido directo do dono do projecto — reverte a decisão `NAO-02` ("Login com Google"),
que só tinha ficado de fora por prioridade, nunca por bloqueio técnico. Nada disto
existia no site antigo (Supabase) — estava só planeado, nunca construído (ver
`RoadmapTecnico.tsx`: "Login social (Google) — Não implementado").

Duas decisões do dono do projecto, confirmadas antes de escrever código:

1. **Se já existir conta com o mesmo email (registada por password), ligar
   automaticamente** — o Google já provou a posse desse email, é seguro, e é o
   comportamento padrão da generalidade dos sites com login social.

O que mudou:

- **`core/google_auth.py`** — `GoogleTokenVerifier` (Protocol) + `GoogleIdTokenVerifier`
  (real, usa a biblioteca `google-auth`), mesmo padrão do `EmailSender`
  (`core/email.py`): o `AuthService` nunca fala com o Google directamente, só com o
  Protocol — testável sem rede. A verificação confirma a assinatura contra as chaves
  públicas do Google **e** que o token foi emitido para este `google_client_id` —
  nunca confiar em nada vindo do browser sem isto.
- **`AuthService.entrar_com_google`** — liga a uma conta existente pelo email, ou cria
  uma nova (`papel: comum`, nunca outro — mesma regra de `PAPEIS_AUTO_REGISTAVEIS` do
  registo normal). `password_hash` de uma conta só-Google é uma password aleatória,
  nunca comunicada — quem quiser entrar também por password usa "esqueci-me da
  password", já funciona sem alterações. Uma conta que ainda não tivesse confirmado o
  email por link (AUTH-02) fica confirmada aqui também: a verificação do Google é pelo
  menos tão forte quanto isso.
- **`POST /auth/google`** — recebe `id_token`, define os mesmos cookies `httpOnly` de
  sempre em caso de sucesso.
- **`GoogleSignInButton.tsx`** — usa o Google Identity Services (script global em
  `index.html`), nunca um redireccionamento para fora do site. Sem
  `VITE_GOOGLE_CLIENT_ID` configurado, não renderiza nada (nunca um botão partido).
- Testes novos: 5 de service (conta nova, ligar a existente, confirmar email em
  atraso, recusar email não verificado pelo Google, duas entradas dão a mesma conta),
  4 de router, 12 de `AuthContext`/`GoogleSignInButton` no frontend.
- **Bug real apanhado pelo CI, não em dev**: `google.auth.transport.requests`
  precisa da biblioteca `requests` instalada à parte (não é dependência obrigatória
  do `google-auth`) — passou despercebido localmente só porque outra biblioteca já a
  tinha instalado por acaso; o ambiente limpo do CI apanhou logo (18 erros de colecção
  do `pytest`). Corrigido acrescentando `requests` explicitamente a `pyproject.toml`.

**Falta ainda:** o ID do cliente OAuth em si — criado manualmente na consola do GCP
(`console.cloud.google.com/apis/credentials`, ecrã de consentimento + credenciais tipo
"Aplicação Web"), pendente do dono do projecto. Sem isso preenchido em
`GOOGLE_CLIENT_ID` (API) e `VITE_GOOGLE_CLIENT_ID` (frontend), o botão simplesmente não
aparece — não há nada partido, só por activar.

## Ciclo completo do painel de administração (2026-09-16)

Pedido directo do dono do projecto: "complete o painel de administração", com mandato
para decidir sem parar a perguntar em cada passo. Antes de tocar em código, foi feito
um levantamento honesto, página a página — o retrato era mais nuançado do que o
`CROSS-03` registava: três páginas (`AdminInbox`, `AdminBanners`, `AdminAdmins`) já
estavam 100% na API própria; as outras quatro tinham problemas de gravidades muito
diferentes, não só "ainda no Supabase":

- **`AdminOverview`** — números de um Supabase que já não reflecte a actividade real
  (utilizadores novos registam-se na API própria, não em `profiles`). Enganoso, não
  só desactualizado.
- **`AdminUsers`** — mesmo problema: um admin que tente gerir um utilizador real do
  site novo simplesmente não o encontra aqui.
- **`AdminContent`** — o pior dos quatro: confirmado por grep que **nenhuma página
  pública lê `site_content`** (`HeroSection.tsx`/`ImpactSection.tsx` são hardcoded).
  Editar aqui não publica nada — o texto "publicado ao guardar" é falso.
- **`AdminNotifications`** — confirmado que **nenhuma página do site mostra
  notificações a ninguém**. O admin "envia" para o vazio.

### ADMIN-01 — `AdminOverview` real + Central de Pendências (feito)

`GET /admin/estatisticas` e `GET /admin/pendencias` novos — leitura pura sobre tabelas
que já existiam no Postgres próprio (`utilizadores`, `sessoes_exercicio`,
`scanner_analyses`, `premium_requests`, `contact_messages`, `candidaturas_voluntariado`),
nenhuma tabela nova. Decisão de desenho: o antigo "online agora" (presença em tempo
real do Supabase) não media nada de real — ninguém publica presença nesse canal desde
que a sessão passou a ser da API própria. Substituído por **"Ativos esta semana"**
(utilizadores distintos com uma sessão de exercício nos últimos 7 dias) — um sinal
honesto e mais relevante para um produto de terapia visual do que uma contagem de
"quem tem o painel aberto agora".

**Inovação própria**: a Central de Pendências — um cartão no topo da Visão Geral que
junta pedidos Premium por decidir, mensagens por ler, e candidaturas de voluntariado
por decidir, cada um a linkar directamente para o sítio certo (`AdminInbox` ganhou
`?tab=` para abrir já no separador certo). A ideia: um admin não devia ter de adivinhar
qual separador tem trabalho à espera — devia ver isso assim que abre o painel.

### L-15 — `AdminVoluntariado.tsx` (feito)

O backend do voluntariado (`W-12`/`AUTH-03`... na verdade `W-12`) estava pronto e
testado há um dia inteiro sem nenhuma interface — um admin não tinha forma nenhuma de
aprovar uma candidatura ou publicar uma actividade excepto chamando a API à mão. Uma
página só, dois separadores (mesmo padrão do `AdminInbox`): Candidaturas
(aprovar/rejeitar, com destaque para pendentes) e Actividades (publicar, cancelar, ver
inscritos num dialog). Entrada nova no menu lateral.

### ADMIN-03 — Publicações: substitui campanhas escritas em código (feito)

O pedido do dono do projecto foi claro: "as publicações e mural de actividades são
publicadas via código... o painel deve ter um lugar para fazer esta gestão". Confirmado
com `ActivitiesFeed.tsx` (uma única publicação hardcoded, "Ações Recentes") e
`CampanhaGamek.tsx` (uma página nova por campanha, escrita por um programador).

Duas tabelas novas: `publicacoes` (título, resumo, corpo, data, local, capa, estado
`rascunho`/`publicada`) e `midias_publicacao` (galeria de fotos, `ON DELETE CASCADE`
a partir de `publicacoes`) — migração `0140a7145adb`, validada `upgrade`→`downgrade`→
`upgrade` contra Postgres real antes de fechar. O slug é sempre gerado no servidor a
partir do título (nunca aceite do cliente) e nunca muda depois de criado — evita
colisões, enumeração de rascunhos, e um link partilhado que deixa de funcionar. Upload
de capa e galeria reaproveita tal e qual o padrão de três passos do avatar
(`Presigner`/R2, `INF-10`): a API só assina, o browser envia os bytes directamente, a
API confirma que a chave pertence à publicação certa. Uma única página pública dinâmica
(`/publicacoes/:slug`) substitui a ideia de "uma rota nova por campanha".

**A verificação de segurança que mais importava aqui**: um rascunho tem de ser
invisível mesmo sabendo o slug exacto — nunca assumir que ninguém vai tentar adivinhar
ou enumerar. Confirmado com um teste de integração dedicado e, para além dos testes,
com um `curl` real contra a API a correr em Postgres containerizado: `GET
/publicacoes` devolve `[]` e `GET /publicacoes/{slug}` devolve `404` enquanto o estado
é `rascunho`, e só aparecem depois de `POST /publicacoes/{id}/publicar`.

`AdminContent.tsx` (editor de `site_content` no Supabase — confirmado por grep que
**nenhuma página pública o lia**, e sem nenhum teste a perder) foi substituído por
`AdminPublicacoes.tsx`: criar em rascunho, editar, upload de capa/galeria, publicar/
despublicar, apagar. `ActivitiesFeed.tsx` (secção "Ações Recentes" da home) deixou de
mostrar a campanha da Gamek fixa em código — mostra agora até duas publicações reais
mais recentes, ou desaparece por completo se não houver nenhuma publicada. É a mesma
lição do `CROSS-08`: nunca deixar uma funcionalidade "pronta" sem ligar o lado que a
torna real. `CampanhaGamek.tsx` manteve-se tal como está (tem vídeos de testemunhos que
o novo modelo de publicações ainda não cobre) — conteúdo genuíno não se apaga só
porque o padrão mudou.

**Lição a levar**: `AdminContent`/`site_content` não tinha nenhum teste, nenhuma
página a consumi-lo, e ninguém tinha reparado. Um CMS "funcional" pode estar
completamente desligado do produto durante meses se nada o liga ao lado público —
o achado só apareceu porque a auditoria confirmou consumidores reais por grep, em vez
de assumir que "edita e guarda" implica "está a ser usado".

**TOCAVA esquema de dados — revisto e mesclado por Wilson (PR #45), deploy automático
confirmado em produção.**

### ADMIN-02 — `AdminUsers` com dados reais e mudança de papel genérica (feito)

`POST /admin/utilizadores/{id}/papel` novo: recusa `papel=admin` (422 — essa
transição mantém-se só em `promover`/`remover-admin`, que têm a protecção do último
admin) e recusa mudar o papel de quem já é admin por esta via (409 — mesma razão).
`AdminUsers.tsx` deixou de ler o Supabase (nem `profiles`, nem `user_roles` — dupla
fonte que já nem existe no esquema novo). Revisto a fundo, sincronizado com o `main`
e mesclado por Wilson (PR #44); deploy automático confirmado em produção.

### ADMIN-04 — Notificações reais por utilizador (feito)

Substitui o antigo `AdminNotifications.tsx`, que escrevia numa tabela `notifications`
do **Supabase** — confirmado por grep, sem nenhum consumidor no site — para um envio
que cria mesmo uma linha por destinatário na tabela `notifications` do Postgres
próprio, que já existia desde a baseline (nenhuma migração nova precisou de correr).

- `POST /notificacoes/admin/enviar` — broadcast a todos ou a um `papel` (reaproveita
  `AdminRepository.listar(papel=...)` para resolver os destinatários, em vez de
  duplicar essa consulta).
- `GET /notificacoes`, `GET /notificacoes/nao-lidas/contagem`, `POST
  /notificacoes/{id}/marcar-lida`, `POST /notificacoes/marcar-todas-lidas` — qualquer
  sessão autenticada, só sobre as suas próprias.
- **A verificação que mais importava aqui**: marcar como lida a notificação de outra
  pessoa devolve sempre 404 — nunca confiar no `id` vindo do cliente sem confirmar o
  dono, e nunca distinguir "não existe" de "não é tua" (evita confirmar por
  enumeração que um dado id existe). Verificado com testes de integração e com um
  `curl` real: o admin a tentar marcar como lida a notificação de outro utilizador
  leva 404 e a contagem desse outro utilizador não muda.
- `NotificationBell.tsx` no `Navbar` — sino com contagem de não lidas (sondagem a
  cada 60s), lista as notificações num popover, marca uma ou todas como lidas sem
  esperar por um novo pedido completo. É o consumidor real que faltava: antes desta
  mudança, nada no site alguma vez mostrava uma notificação a alguém.
- 21 testes novos na API, 9 no frontend.

**Lição a levar**: mesma lição do `ADMIN-03` — uma tabela e um formulário de admin a
funcionar não significam uma funcionalidade completa. `AdminNotifications.tsx`
"enviava" havia meses sem que ninguém alguma vez recebesse nada; só apareceu porque a
auditoria inicial confirmou, por grep, que não havia nenhum consumidor no lado
público, em vez de assumir que existia.

---

## O que NÃO fazer agora

Isto é tão importante como a lista acima. Somos duas pessoas, uma delas ainda a aprender.
O relatório UX perguntou, com toda a educação, *"quantas pessoas compõem a equipa de
desenvolvimento?"* — a resposta honesta condiciona o que cabe.

| Adiado | Porquê |
|---|---|
| Gateway de pagamento automático | Depende de contrato comercial (EMIS/AppyPay). O ciclo manual do Sprint 2 chega |
| ~~Login com Google~~ | **Feito a 2026-09-15** — ver `AUTH-03` acima |
| Versão em inglês | O público é angolano |
| Mapa de clínicas parceiras | Uma lista resolve, enquanto houver poucas clínicas |
| Notificações push e modo offline | Boa ideia, custo alto, nenhum utilizador bloqueado hoje |
| Migrar as 37 chamadas directas de uma vez | Migração por domínio, não big bang. É assim que as reescritas morrem |

---

## CROSS-02 — R2 ligado a sério ao deploy automático (2026-09-16)

Pedido directo do dono do projecto: "vamos resolver de uma vez por todas o R2".
As credenciais já existiam há dias, mas só em `api/.env` local — nunca tinham
chegado à produção, o que explica a confusão inicial ("já tenho as variáveis no
repositório" referia-se ao `.env`, que nunca é comitado nem lido pelo Cloud Run).

O que ficou feito:

- **Segredos** (`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`) para o Secret Manager
  (`jpa-r2-access-key-id`/`jpa-r2-secret-access-key`), com acesso concedido à
  service account de runtime do Cloud Run.
- **Variáveis não-secretas** (`R2_ENDPOINT_URL`, `R2_BUCKET`,
  `R2_PUBLIC_BASE_URL`) para GitHub Variables e ligadas ao job `deploy-api` do
  CI — a mesma lacuna que já tinha sido corrigida antes para
  `EMAIL_REMETENTE`/`GOOGLE_CLIENT_ID` (DEP-06/AUTH-03): sem isto no workflow,
  cada deploy automático apagava-as do serviço (`--set-env-vars` substitui, não
  soma).

**Bug real achado ao testar a sério** (nunca assumir que credenciais que "já
existem" estão correctas — testá-las de verdade): `R2_ENDPOINT_URL` tinha o
nome do bucket colado ao fim
(`https://<conta>.r2.cloudflarestorage.com/janelasparaalma`), quando o
`boto3`/S3 espera o endpoint sem o bucket (o bucket vai à parte, no parâmetro
`Bucket=`). Isto fazia todos os uploads ficarem guardados com o bucket
duplicado dentro da própria chave
(`janelasparaalma/janelasparaalma/avatares/...`), enquanto os URLs públicos
construídos como `{R2_PUBLIC_BASE_URL}/{chave}` continuavam a apontar para o
caminho sem essa duplicação — **404 garantido em qualquer avatar ou foto
publicada**, mesmo com um upload "bem sucedido" do ponto de vista da API.
Confirmado com um ciclo real `put`/`get`/`list`/`delete` contra o bucket antes
e depois da correcção.

**A verificação que salvou de um incidente maior**: antes de dar isto como
fechado, confirmou-se por uma consulta directa à base de dados de produção
que **zero utilizadores tinham `avatar_url`** e **zero publicações tinham
`capa_url`** guardados até este momento — o bug existia desde `INF-10`
(2026-09-10) mas nunca chegou a partir uma imagem real, porque ninguém tinha
ainda carregado nenhuma.

**Lição a levar**: "já tenho as credenciais" e "as credenciais funcionam em
produção" são coisas diferentes — só a segunda importa, e só se confirma
testando a sério (não só olhando para o valor). Um `.env` local nunca chega
a produção sozinho; toda a configuração nova precisa de um passo explícito
que a leve até ao serviço real, e esse passo tem de estar no caminho
automático, não só documentado para se lembrar de correr à mão.

**Falta ainda**: `Apoiar.tsx` (modo financeiro) e `RegistoPremium.tsx`
continuam a enviar o comprovativo de pagamento via Edge Function do Supabase
— agora que o R2 está resolvido a sério, o próximo passo é reescrever esse
envio para o mesmo padrão de upload em 3 passos já usado no avatar (`INF-10`)
e nas fotos de publicações (`ADMIN-03`).

---

## Bloqueios em aberto

| # | Bloqueio | Estado | Quem resolve |
|---|---|---|---|
| 1 | Motor de análise do scanner | ✅ **Existe e está em produção** — `janelas-scanner-api`, microserviço à parte, já devolve medições reais a `Scanner.tsx` (ver W-09, corrigido 2026-09-17). Falta validação clínica (bloqueio nº8) | — |
| 2 | Bypass do Premium é teste interno? | ✅ **Resolvido** — não é. Fica como tarefa atribuída (W-01), não se remove fora do sprint | — |
| 3 | Existe algum utilizador com Premium pago? | ✅ **Resolvido 2026-09-17** — confirmado que não, nessa data. O bypass do paywall já tinha saído do código antes disto ser perguntado (ver W-01) | Wilson |
| 8 | Parceiro clínico disposto a validar o scanner com casos reais | ⏳ **Aberto** — bloqueia W-16, e sem ele não há produto clínico defensável | Wilson (parcerias) |
| 4 | Cloud Run exige cartão registado, mesmo sem cobrar | ⏳ Aberto | Wilson (administrativo) |
| 5 | Consentimento parental para menores — nunca abordado, nem no código nem nos documentos | ⏳ Aberto | Wilson + apoio jurídico |
| 6 | Recuperação de palavra-passe | ✅ **Resolvido 2026-09-14** — `POST /auth/recuperar-password` + `/auth/redefinir-password`, token de uso único hasheado (30 min), ligado no frontend. Ver secção dedicada abaixo | — |
| 9 | Fornecedor de email transacional (Resend / SendGrid / SES) | ✅ **Resolvido 2026-09-14** — Resend. Falta só o domínio verificado no Resend (CROSS-07, Lukeny) para sair do remetente sandbox `onboarding@resend.dev` | Lukeny (DNS) |
| 7 | Data de expiração do crédito Google Cloud trial — anotar | ⏳ Aberto | Wilson |

---

## CROSS-02 — comprovativo de doações e Premium sai do Supabase (2026-09-17)

Pedido directo do dono do projecto, a seguir a fechar o R2: "vamos resolver de uma vez
por todas o comprovativo". `Apoiar.tsx` (modo financeiro) e `RegistoPremium.tsx`
continuavam a enviar o ficheiro do comprovativo por uma Edge Function do Supabase — o
único sítio, em todo o site, onde isso ainda acontecia.

O que ficou feito:

- `comprovativo_upload_service.py` novo — mesmo padrão de 3 passos do avatar
  (`upload_service.py`) e das fotos de publicações (`ADMIN-03`): a API só assina o
  `PUT`, o browser envia os bytes directamente ao R2. Diferença deliberada: aqui não
  há "dono" a validar na preparação (doar ou pedir Premium não exige sessão) — a chave
  nasce sob um prefixo fixo (`comprovativos/`), e é esse prefixo que se confirma no
  momento de criar a doação/o pedido, nunca aceitando um caminho arbitrário do bucket.
- Coluna `comprovativo_url` em `doacoes` e `premium_requests` (migração
  `05db9b9b607c`, validada `upgrade`→`downgrade`→`upgrade` contra Postgres real).
- `POST /doacoes/financeiro` novo (a doação financeira nunca tinha passado pela API
  própria — ia directa para o Supabase). `POST /premium-requests` passa a exigir
  `comprovativo_chave`; a lógica de validar essa chave saiu do router para dentro do
  `PremiumService` (regra de ouro do CLAUDE.md §3 — "o utilizador podia mentir sobre
  isto" já se aplicava aqui, só ainda não tinha um `service` a aplicá-la).
- `AdminInbox.tsx` ganha um link **"Ver comprovativo"** no separador Premium. Antes
  desta mudança, um admin aprovava um pagamento a confiar apenas no que via por email,
  fora do produto — agora vê o ficheiro real, no mesmo sítio onde decide.
- Verificado ponta-a-ponta com pedidos reais contra a API a correr em Docker: `PUT`
  no URL assinado devolvido pela própria API, seguido de `GET` no URL público
  devolvido — o ficheiro chega mesmo lá, com a chave certa.

**Perdido de propósito, não por descuido**: a Edge Function também mandava, só para
`RegistoPremium.tsx`, um email interno com notas de diagnóstico ("já tem diagnóstico
médico?", "dúvida clínica: ...") para a equipa. Isso nunca teve destino persistente
(não ficava gravado em lado nenhum, só num email) e não foi recriado — o formulário
continua a recolher essa informação (ainda validada, ainda no ecrã), só deixou de ser
enviada por email a alguém. Fica registado aqui para não passar despercebido: se a
equipa precisar mesmo dessas notas, o sítio certo para elas é uma coluna nova em
`premium_requests`, com um dono a decidir isso — não uma Edge Function a reviver.

12 testes novos na API, 12 no frontend. **Toca esquema de dados — PR aberto para
revisão humana antes do merge (CLAUDE.md §9/§10).**

---

### `jpa-deploy` sem permissão para verificar segredos — quarta lacuna do mesmo tipo (2026-09-17)

Achado ao confirmar o `CROSS-02` em produção: o URL de upload assinado devolvido pela
API tinha a credencial de acesso **vazia** (`X-Amz-Credential=%2F2026...`, sem nada
antes da primeira barra). `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` não estavam sequer
presentes no serviço em produção, apesar de já estarem no Secret Manager.

Causa: `04-deploy.sh` só liga um segredo (R2, Resend) se `gcloud secrets describe`
tiver sucesso — mas `jpa-deploy` (o SA que os deploys automáticos do CI usam) nunca
teve `secretmanager.secrets.get`, a permissão que `describe` exige (é diferente de
`secretmanager.versions.access`, essa sim concedida por segredo em `03-secrets.sh`,
mas que serve só para o SA de **runtime** ler o *valor*). O `describe` falhava em
silêncio (`>/dev/null 2>&1`) e o script saltava o segredo inteiro — todo o deploy
automático seguinte apagava-o do serviço.

É a mesma classe de falha já vista três vezes (DEP-06: `serviceusage`/`cloudbuild`;
`EMAIL_REMETENTE`/`GOOGLE_CLIENT_ID`: variáveis nunca chegavam ao CI): **testar como
Owner nunca mostra o que falta a um service account com menos permissões.** Corrigido
concedendo `roles/secretmanager.viewer` a `jpa-deploy` (metadados só — o valor dos
segredos continua a ler-se só pelo SA de runtime, nunca por este) e registado em
`06-ci-cd-setup.sh` para qualquer projecto novo já nascer sem esta lacuna.

Confirmado corrigido com um deploy manual imediato e um ciclo `PUT`/`GET` real contra
a API de produção — o mesmo teste que apanhou o problema.

**Lição a levar**: sempre que `04-deploy.sh` ganhar uma condição nova do tipo
`if gcloud <algo> describe ... ; then`, perguntar explicitamente "o SA de deploy tem
esta permissão, ou só o Owner a testar à mão?" — a resposta errada fica invisível até
ao primeiro deploy automático a sério, exactamente como desta vez.

---

## Auditoria de jornada do utilizador + UX externa (2026-09-17)

Duas auditorias pedidas pelo dono do projecto, cruzadas com o estado real do código
(não com suposições nem com o que está em produção — ver achado principal abaixo).
Documento de trabalho completo, com evidência ficheiro:linha e as tabelas comparativas,
publicado à parte como artefacto partilhável; este registo fica só com o essencial para
quem pega no `git pull` sem esse link.

**Achado principal**: das duas auditorias, a mais valiosa não foi nenhum problema de UI —
foi confirmar que **produção pode estar atrás de `main`**. Um relatório UX externo,
feito por navegação manual em `janelasparaalma.com`, apontou 8 problemas técnicos; ao
verificar cada um contra o código actual, **5 já estavam corrigidos em `main`** (páginas
legais, validação da password actual ao mudar password, recuperação de password, editar
perfil, separação plano gratuito/premium na página de exercícios). Antes de reabrir
qualquer um destes como tarefa nova, confirmar a data do último deploy da API (Cloud Run)
e do frontend (Vercel) contra o commit de `main` — se estiver atrasado, um deploy resolve
sozinho, sem código novo.

### UX-01 — Confirmar deploy de produção contra `main` · W

Antes de tocar em qualquer item desta secção: `git log -1 main` vs. o commit realmente
em Cloud Run/Vercel. Se divergir, disparar deploy e voltar a testar os 5 pontos "já
corrigidos" abaixo em produção antes de os tratar como bug.

### UX-02 — Gralha "Três tiers, três formas de transformar" · L

`frontend/src/pages/Apoiar.tsx:422`. Mistura inglês ("tiers") com português — corrigir
para "Três formas de transformar" ou "três níveis".

### UX-03 — Falta campo de localização/província na doação de materiais · L

`api/app/schemas/doacao.py` (`DoacaoMateriaisCriar`) não tem campo de
localização/província do doador, nem o formulário em `Apoiar.tsx` o pede — sem isto a
equipa não sabe onde recolher o que foi doado. Adicionar ao schema Pydantic e ao
formulário; validação simples (campo obrigatório), sem lógica de service — é dado, não
regra de negócio.

### UX-04 — Candidatura pública do Kamba não grava em BD · L

`VolunteerSection.tsx` (em `/kamba`) envia a candidatura por email via edge function do
Supabase. Já existe `voluntariadoApi.candidatar` (`apiClient.ts:729`), ligado a
`POST /voluntariado/candidatar`, que grava em BD e alimenta a fila de aprovação em
`AdminVoluntariado.tsx` — mas o formulário público não a chama. Resultado: o painel de
candidaturas do admin nunca recebe nada pela via pública actual. Trocar o envio por
email pela chamada real à API.

### UX-05 — Actividades de voluntariado sem vitrine pública · L

`voluntariadoApi.listarAtividades()` (`apiClient.ts:737`) está definida e nunca é
chamada em nenhuma página pública — confirmado por grep a todo o `frontend/src`. O
admin já filtra actividades por estado/período (`AdminVoluntariado.tsx`), mas esse
trabalho fica invisível ao utilizador comum. Consumir a listagem numa secção pública de
`/kamba`.

### UX-06 — Sem link permanente para o dashboard na Navbar · L

`Navbar.tsx:160-180` (`allLinks`, utilizador autenticado não-admin): Sobre Nós, Sobre o
Estrabismo, Equipa, Triagem Ocular, Meu Kamba Estrábico, Exercícios, Portal Clínico,
Contactos — nenhum leva a `/dashboard`. O único caminho é adivinhar o URL. Adicionar "O
meu painel" à Navbar — maior ganho de discoverability desta lista pelo menor esforço.

### UX-07 — `DashboardUser.tsx` mostra dados fixos · W+L

Linha 46: "Exercícios disponíveis" é sempre `"4"`, hardcoded. Linha 53: "Próxima
teleconsulta" é sempre `"—"`. Coincide com "Painel pessoal com dados reais" já marcado
como prioridade Alta no documento de roadmap de produto — ligar aos exercícios/pontuação
reais do utilizador quando essa base existir (depende de pontuação de exercícios ainda
não implementada — ver secções de produto anteriores).

### UX-08 — Polimento de UI directo, sem dependência de backend · L

Do relatório externo, confirmado por inspecção visual (não precisam de verificação de
código de negócio):
- Reordenar "Serviços"/"Produtos" para a ordem do menu ("A Nossa Visão" aparece antes de
  "Os Vossos Parceiros" — inverter).
- Scroll em falta no modal de "Últimas Referências" (conteúdo cortado).
- Links rápidos/âncoras não levam ao topo da página de destino.
- Link do Google Maps sem `target="_blank"`.
- Botão "Voltar" com contraste/posição pouco visíveis.
- Espaço insuficiente entre o botão de perfil e o logótipo na Navbar.
- "Terceiro link avariado" apontado no relatório sem especificar qual — pedir ao
  avaliador o link exacto antes de investir tempo a procurá-lo às cegas.

### UX-09 — "Vídeos não reproduzem" é provável mal-entendido, não bug · —

Os exercícios (`components/exercises/BaseExercise.tsx`, `pages/exercises/*.tsx`) usam
`canvas`/`requestAnimationFrame`, não ficheiros de vídeo. O único `<video>` num
exercício (`AmbliopiaExercise.tsx:459`) é o feed da câmara para eye-tracking,
propositadamente `sr-only`/oculto — não um vídeo demonstrativo. Não abrir tarefa de
correcção sem antes confirmar com o avaliador o que exactamente esperava ver.

### Kamba Social — proposta, não tarefa ainda

Levantado à parte da auditoria técnica: "Meu Kamba Estrábico" tem hoje só um
formulário de candidatura a voluntário — nada do espaço de apoio mútuo entre pessoas
estrábicas que o nome sugere. Proposta (fica registada, não entra em sprint sem decisão
do dono do produto): separar em dois produtos debaixo do mesmo nome — (1) voluntariado,
reparado por UX-04/UX-05; (2) "Kamba Social", testemunhos moderados + mural de
perguntas/respostas estruturado (não chat livre — mais seguro com público infantil,
mais fácil de moderar pelo mesmo padrão já usado em Publicações/Banners).

---

<sub>Actualizar este ficheiro à medida que as tarefas fecham. Uma tarefa fechada sai da lista com o commit que a fecha.</sub>
