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

1. **Correr a migração Alembic contra um Postgres real** (`docker compose up -d db &&
   alembic upgrade head`) e confirmar com `alembic check` — foi escrita à mão porque o
   Docker Desktop não estava disponível no momento; validada só offline (`--sql`) até aqui.
   Continua bloqueado — Docker Desktop ainda não está a correr nesta máquina.
2. ~~**Storage:** endpoint na API para emitir URLs assinadas do Cloudflare R2 (avatares).~~
   Feito a 2026-09-10 (ver "Upload de avatar via R2" mais abaixo). O código está escrito
   e testado contra um `Presigner` falso; falta só ligar credenciais reais do R2 e
   `R2_PUBLIC_BASE_URL` quando o bucket existir.
3. **Deploy no Cloud Run** — build das imagens, Cloud SQL, variáveis de ambiente de
   produção, domínio.

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
| Deploy no Cloud Run | Conta GCloud, projecto, credenciais |
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

### W-01 · Remover o bypass do Premium
- **Onde:** `src/pages/Exercicios.tsx:152` (`temAcessoPremium = true`), `src/components/exercises/BaseExercise.tsx:96-97` (`locked = false`)
- **Fazer:** repor a verificação real de acesso; apagar o `// TODO: REMOVER BYPASS`
- **Pronto quando:** uma conta sem Premium é bloqueada nos 8 exercícios avançados, e uma com Premium entra
- ✅ **Desbloqueado:** confirmado que não há teste interno a decorrer

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

### W-04 · Scanner deixa de inventar diagnósticos
- **Onde:** `src/pages/Scanner.tsx` (`DIAGNOSES[Math.floor(Math.random() * ...)]`)
- **Fazer:** enquanto não houver análise real (Sprint 3), retirar o diagnóstico ou reclassificar o ecrã como *"sinais observados — sujeitos a confirmação clínica"*. Remover a percentagem de confiança fabricada
- **Pronto quando:** nenhum ecrã apresenta um resultado clínico que não tenha sido calculado a partir de medições reais

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

#### W-09 · Motor de análise — parte-se do zero
- **Assunção fixada:** não existe código nem base do scanner de IA. O `janelas-scanner-api`
  deixa de constar do plano. Nada do que se segue depende de recuperar seja o que for
- **O que já existe e conta:** a extracção de pontos faciais **já funciona**, em
  TypeScript, no browser — `src/hooks/useEyeTracking.ts` e `src/components/EyeLandmarkOverlay.tsx`
  usam FaceMesh, e `Scanner.tsx` já captura as 3 poses. O ponto de partida não é zero
  absoluto: é zero do lado do *cálculo clínico*
- **O que falta é a parte difícil:** transformar coordenadas de pontos faciais numa
  medição clinicamente defensável de desvio ocular. Ver Sprint 3

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

### W-11 · Confirmação de pagamento activa o Premium
- Endpoint na API — **o único ponto com `service_role`**, justificado e auditado
- Transacção: `status → aprovado` + `profiles.papel → premium` + regista quem aprovou e quando
- Hoje `AdminInbox.tsx` só marca "Contactado", que não activa nada
- **Testes obrigatórios:** é lógica de dinheiro e acesso

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

## SPRINT 4 — Rede clínica e agendamentos

O pitch deck afirma às clínicas que o agendamento com a Optiótica *"não é uma promessa de
roadmap"*. O formulário existe mas **não persiste nada**. Este sprint fecha essa distância.

- **L:** tabela `agendamentos` (migração aditiva, padrão de `sessoes_exercicio`)
- **W:** endpoints de criação e decisão
- **L:** ligar `ClinicalPartners.tsx` à API; página `AdminAgendamentos.tsx`
- **W:** notificação à equipa e à clínica

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

## O que NÃO fazer agora

Isto é tão importante como a lista acima. Somos duas pessoas, uma delas ainda a aprender.
O relatório UX perguntou, com toda a educação, *"quantas pessoas compõem a equipa de
desenvolvimento?"* — a resposta honesta condiciona o que cabe.

| Adiado | Porquê |
|---|---|
| Gateway de pagamento automático | Depende de contrato comercial (EMIS/AppyPay). O ciclo manual do Sprint 2 chega |
| Login com Google | Conveniência, não bloqueia ninguém |
| Versão em inglês | O público é angolano |
| Mapa de clínicas parceiras | Uma lista resolve, enquanto houver poucas clínicas |
| Notificações push e modo offline | Boa ideia, custo alto, nenhum utilizador bloqueado hoje |
| Migrar as 37 chamadas directas de uma vez | Migração por domínio, não big bang. É assim que as reescritas morrem |

---

## Bloqueios em aberto

| # | Bloqueio | Estado | Quem resolve |
|---|---|---|---|
| 1 | Motor de análise do scanner | ✅ **Assunção fixada** — não existe código nem base. Parte-se do zero (W-09, Sprint 3) | — |
| 2 | Bypass do Premium é teste interno? | ✅ **Resolvido** — não é. Fica como tarefa atribuída (W-01), não se remove fora do sprint | — |
| 3 | Existe algum utilizador com Premium pago? | ⏳ **Aberto** — decide se W-01 sai sozinho ou junto de W-11 | Wilson (verificar no Supabase) |
| 8 | Parceiro clínico disposto a validar o scanner com casos reais | ⏳ **Aberto** — bloqueia W-16, e sem ele não há produto clínico defensável | Wilson (parcerias) |
| 4 | Cloud Run exige cartão registado, mesmo sem cobrar | ⏳ Aberto | Wilson (administrativo) |
| 5 | Consentimento parental para menores — nunca abordado, nem no código nem nos documentos | ⏳ Aberto | Wilson + apoio jurídico |
| 6 | Recuperação de palavra-passe: falha de **configuração** no Supabase, não de código | ⏳ Aberto | Wilson (painel Supabase) |
| 7 | Data de expiração do crédito Google Cloud trial — anotar | ⏳ Aberto | Wilson |

---

<sub>Actualizar este ficheiro à medida que as tarefas fecham. Uma tarefa fechada sai da lista com o commit que a fecha.</sub>
