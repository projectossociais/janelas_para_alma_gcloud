# Deploy dos exercícios sem webcam

Ordem segura, compatibilidade entre versões, rollback e verificações pós-deploy. Aplica-se
ao merge da branch `frontend/exercicios-sem-webcam` no `main`.

> **Atenção: o merge dispara dois deploys ao mesmo tempo.**
> - O **Vercel** faz o deploy do frontend assim que o `main` muda: um build de cerca de
>   1 a 2 minutos.
> - O job **`deploy-api`** do CI (`.github/workflows/ci.yml`) só começa depois de os jobs
>   `api` e `imagem-api` passarem, o que leva vários minutos. Depois corre
>   `05-migrate.sh` e, a seguir, `04-deploy.sh`.
>
> **Na prática, o frontend novo vai ficar alguns minutos no ar com a API antiga.** A
> secção 2 explica o que isso significa. A ordem abaixo diz como o evitar, se se quiser.

## 1. Ordem segura

| Passo | O quê | Como | Porquê nesta ordem |
|---|---|---|---|
| 1 | **Backup** do Cloud SQL | `gcloud sql backups create --instance=$SQL_INSTANCE` e **esperar** que acabe (`gcloud sql backups list --instance=$SQL_INSTANCE`) | O `05-migrate.sh` também pede um backup, mas com `--async`: não espera por ele. Para esta migração, convém ter um backup confirmado antes. |
| 2 | **Migração** | Automática no `deploy-api` (`05-migrate.sh`), ou à mão antes do merge | Só acrescenta colunas opcionais: **a API antiga continua a funcionar** com o esquema novo. |
| 3 | **Deploy da API** | Automático no `deploy-api` (`04-deploy.sh`), logo a seguir à migração | A API nova **precisa** das colunas novas (ver 2.3). |
| 4 | **Deploy do frontend** | Vercel | Com a API nova no ar, o frontend novo funciona por completo. |

**Para garantir o passo 4 depois do 3** (opcional): suspender o deploy automático do
Vercel para este merge, com a opção "Ignored Build Step" ou fazendo o deploy e só
promovendo à produção à mão. Depois de o `deploy-api` ficar verde, faz-se "Promote to
Production". Se isto não for feito, a janela descrita em 2.2 dura alguns minutos.

## 2. Compatibilidade (verificada no código e nos testes)

### 2.1 API nova + frontend antigo — ✅ funciona

- O frontend antigo grava sessões sem os campos novos, e a API grava-as com `versao = 1`.
  Há um teste disso: `test_sessao_sem_campos_novos_fica_versao_1`.
- As rotas e o acesso são os mesmos.
- O frontend antigo continua a ter os exercícios com webcam até o Vercel actualizar.
  Não há conflito.

### 2.2 Frontend novo + API antiga (a janela do merge) — ⚠️ funciona, com limitações

A API antiga ignora os campos desconhecidos: os schemas Pydantic ignoram campos extra
por omissão. Com isto:

| O quê | O que acontece |
|---|---|
| Gravar sessões | Grava, mas **sem** os campos novos e **com `versao = 1`**, apesar de o conteúdo ser já o novo. **Estas sessões ficam mal classificadas.** Identificam-se por `created_at` dentro da janela do deploy e por `detalhes IS NULL`, porque o frontend novo não usa `detalhes`. |
| `GET /sessoes-exercicio` (histórico) | Não existe na API antiga (405). O Progresso e o Relatório mostram "Não foi possível carregar o histórico". Os treinos arrancam sem o limiar anterior (começam no nível mais fácil). |
| Perfil visual e calibração no perfil (`PATCH /perfil`) | São ignorados. O treino segue na mesma, com o olho escolhido nesse momento; a escolha só não fica guardada. A calibração fica guardada no aparelho (localStorage). |
| Acesso trial/Premium, login, pagamentos | Iguais. |

Nada parte, e o impacto limita-se aos minutos da janela.

### 2.3 API nova **sem** a migração — ❌ parte tudo

A API nova lê `Utilizador` e `SessaoExercicio` com as colunas novas (por exemplo,
`session.get(Utilizador, …)`). Sem a migração, o **login, o `/auth/eu` e o perfil dão
500**. É por isso que o `deploy-api` migra antes de fazer o deploy. **Nunca fazer deploy
da API à mão sem correr primeiro o `05-migrate.sh`.**

### 2.4 API antiga + esquema novo — ✅ funciona

Colunas opcionais que a API antiga não conhece não a afectam. É isto que torna o rollback
do código seguro sem descer a migração.

## 3. Se a ordem falhar

| Falha | Efeito | O que fazer |
|---|---|---|
| O Vercel faz o deploy antes da API (o caso normal, se não se fizer nada) | A janela de 2.2 | Aceitar os minutos, ou seguir a nota de 1. Depois, se se quiser, reclassificar as sessões da janela (ver 2.2). |
| A migração falha no CI | O `05-migrate.sh` pára e o `04-deploy.sh` **não corre**. A API antiga continua no ar, e o frontend novo fica em 2.2. | Ver o log do job e corrigir. A transacção única garante que o esquema fica como estava. Voltar a correr o `deploy-api`. |
| O deploy da API falha depois da migração | A API antiga continua no ar com o esquema novo (2.4 + 2.2) | Corrigir e voltar a fazer o deploy. Não é preciso mexer na base. |
| Deploy manual da API sem migrar | 2.3: login em baixo | Correr já o `05-migrate.sh`, ou fazer rollback da API (secção 4). |

## 4. Rollback, passo a passo

| Passo a desfazer | Como | Notas |
|---|---|---|
| Frontend | Vercel → Deployments → o deploy anterior → **Instant Rollback** / "Promote to Production" | Imediato. Os exercícios com webcam voltam. |
| API | `gcloud run services update-traffic jpa-api --region=$REGION --to-revisions=<REVISÃO_ANTERIOR>=100` (ver `gcloud run revisions list --service=jpa-api`) | Imediato. A API antiga funciona com o esquema novo (2.4). |
| Migração | **Não recomendado.** `alembic downgrade f3c8a1e6b9d4` via Cloud Run Job, só **depois** de o rollback da API estar feito | Perde todos os dados das colunas novas, incluindo a `versao` (ver `docs/REVISAO_MIGRACAO_b2c6e9a4d1f8.md`, secção 4). Em alternativa, repor o backup do passo 1. |

## 5. Verificações pós-deploy

1. **API a servir a revisão nova:** `gcloud run services describe jpa-api --region=$REGION` e
   `GET /api/exercicios/acesso` responde.
2. **Esquema:** `SELECT version_num FROM alembic_version;` → `b2c6e9a4d1f8`.
3. **Sessão com `versao = 2`:** com uma conta de teste com acesso, fazer o Teste de
   Astigmatismo (é o mais rápido) e confirmar:
   ```sql
   SELECT exercicio_id, versao, olho, sinais, created_at
     FROM sessoes_exercicio ORDER BY created_at DESC LIMIT 2;
   ```
   Esperado: 2 linhas `relax`, `versao = 2`, `olho` direito/esquerdo.
4. **Histórico:** `/exercicios/progresso` carrega sem erro. Na rede,
   `GET /api/sessoes-exercicio` → 200 e só com as sessões da própria conta.
5. **Redireccionamentos:** `/exercicios/tracking`, `/exercicios/cerebro`,
   `/exercicios/relaxamento`, `/exercicios/ambliopia`, `/exercicios/sacadas-convergencia`
   e `/exercicios/flexibilidade-acomodativa` levam todos a `/exercicios`.
6. **Perfil visual:** Editar Perfil → "Olho mais fraco" → guardar → recarregar → o valor
   mantém-se.
7. **Scanner a funcionar** (não foi tocado, mas convém confirmar): `/scanner` pede a
   câmara, mostra os landmarks e chega aos resultados. Os links para os exercícios nos
   resultados apontam para `/exercicios/acuidade`, `/contraste`, `/astigmatismo` e
   `/convergencia`.
8. **Login e acesso:** uma conta em trial vê os 4 do teste desbloqueados e os 4 Premium
   bloqueados. Uma conta Premium vê os 8.
9. **Consola do browser:** sem erros novos nas páginas dos exercícios.
