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
2. **Migração módulo-a-módulo do frontend**, Supabase → API própria. Ordem sugerida, do
   mais isolado ao mais entrelaçado: autenticação (`AuthContext.tsx`, `Auth.tsx`) primeiro
   — sem sessão não há nada para testar a sério a seguir — depois perfil
   (`Configuracoes.tsx`, `EditarPerfil.tsx`), depois os fluxos de negócio (doações,
   Premium, scanner).
3. **Storage:** endpoint na API para emitir URLs assinadas do Cloudflare R2 (avatares) —
   ainda não construído.
4. **Deploy no Cloud Run** — build das imagens, Cloud SQL, variáveis de ambiente de
   produção, domínio.

O que se segue abaixo desta secção é o backlog de produto herdado do repositório antigo —
continua válido *depois* de a API existir para o suportar.

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
