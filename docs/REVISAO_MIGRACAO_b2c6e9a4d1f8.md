# Revisão da migração `b2c6e9a4d1f8` (exercícios sem webcam)

- **Ficheiro:** `api/alembic/versions/b2c6e9a4d1f8_exercicios_visao_sem_webcam.py`
- **Revisão anterior:** `f3c8a1e6b9d4` (anonimização de contas, W-03).
- **Condição de merge:** revisão humana obrigatória, porque toca no esquema de dados
  (CLAUDE.md §9, ponto 4). Depois do merge, a migração corre sozinha no job `deploy-api`
  (`infra/gcloud/05-migrate.sh`).
- **Ensaio com uma cópia dos dados reais:**
  `api/scripts/ensaio_migracao_copia_producao.sh` (ver a secção 5).

## 1. Colunas adicionadas

### `sessoes_exercicio`

| Coluna | Tipo | Nullable | Default | Constraint |
|---|---|---|---|---|
| `versao` | `SMALLINT` | **NOT NULL** | `1` (server default) | — |
| `olho` | `TEXT` | sim | — | `ck_sessoes_exercicio_olho`: `olho IS NULL OR olho IN ('direito','esquerdo','ambos')` |
| `segundos_activos` | `INTEGER` | sim | — | (a API valida 0 a 86 400) |
| `limiar` | `NUMERIC` | sim | — | (a API valida −10 000 a 10 000) |
| `unidade` | `TEXT` | sim | — | (a API aceita só `logmar`, `log_cs`, `arcsec`, `segundos`) |
| `distancia_mm` | `INTEGER` | sim | — | (a API valida 100 a 10 000) |
| `px_por_mm` | `NUMERIC` | sim | — | (a API valida 0,5 a 50) |
| `calibrado` | `BOOLEAN` | sim | — | — |
| `sinais` | `JSONB` | sim | — | (a API limita a ~2 000 caracteres) |

Índice novo: `ix_sessoes_exercicio_user_id_created_at (user_id, created_at)`, para o
`GET /sessoes-exercicio`, que filtra por utilizador e ordena por data.

### `utilizadores`

| Coluna | Tipo | Nullable | Default | Constraint |
|---|---|---|---|---|
| `px_por_mm` | `NUMERIC` | sim | — | (a API valida 0,5 a 50) |
| `olho_mais_fraco` | `TEXT` | sim | — | `ck_utilizadores_olho_mais_fraco`: `NULL` ou `direito`/`esquerdo`/`nao_sei` |
| `usa_oculos` | `BOOLEAN` | sim | — | — |
| `faixa_etaria` | `TEXT` | sim | — | `ck_utilizadores_faixa_etaria`: `NULL` ou `ate_5`/`6_12`/`13_17`/`18_39`/`40_59`/`60_mais` |

As colunas do `orm_models.py` (`Utilizador` e `SessaoExercicio`) espelham estas, com os
mesmos nomes de CHECK e de índice. O `alembic check` não mostra divergência nestas
tabelas.

## 2. Efeito nas linhas que já existem

- Todas as sessões existentes ficam com **`versao = 1`** e as colunas novas a `NULL`.
  Só as sessões gravadas pelo frontend novo têm `versao = 2`.
  - Porquê: os ids `figure8`, `cerebro`, `relax` e `sacadas-convergencia` passam a
    designar outros exercícios, e é a `versao` que separa "antes" de "depois".
- Todos os utilizadores ficam com o perfil visual a `NULL` (não preenchido).
- Nenhuma linha é alterada, apagada ou reescrita.
- Ensaiado num Postgres 16 com dados de exemplo:
  - as contagens ficam iguais antes e depois;
  - 100% das sessões antigas ficam com `versao = 1`;
  - não há campos novos preenchidos.

## 3. Bloqueios e tempo (Postgres 16, a versão do Cloud SQL)

O Cloud SQL é criado com `--database-version=POSTGRES_16` (`infra/gcloud/02-cloud-sql.sh:23`).
O CI e o `docker-compose` usam `postgres:16-alpine`. O ensaio correu num 16.2.

| Operação | Bloqueio | Custo | Notas |
|---|---|---|---|
| `ADD COLUMN` nullable, sem default (12 colunas) | `ACCESS EXCLUSIVE`, muito breve | Só catálogo, sem reescrita | — |
| `ADD COLUMN versao SMALLINT NOT NULL DEFAULT 1` | `ACCESS EXCLUSIVE`, muito breve | Só catálogo, sem reescrita: desde o PG 11, um default constante guarda-se como "valor em falta" | **Confirmado no ensaio:** o `pg_relation_filenode` das duas tabelas não mudou e `pg_attribute.attmissingval = {1}` |
| `ADD CONSTRAINT … CHECK` (3), **sem** `NOT VALID` | `ACCESS EXCLUSIVE` | **Valida todas as linhas existentes** com uma leitura completa da tabela | As colunas novas estão todas a `NULL` e o `NULL` passa sempre, por isso **não pode falhar**. Demora o tempo de uma leitura sequencial (milissegundos com os volumes actuais). |
| `CREATE INDEX` (não concorrente) | `SHARE` em `sessoes_exercicio`: bloqueia escritas (as leituras continuam) | Proporcional ao nº de sessões | Tabela pequena: segundos no pior caso |

**A migração inteira corre numa só transacção** (`alembic/env.py`, `context.begin_transaction()`).
Os bloqueios `ACCESS EXCLUSIVE` em `utilizadores` e `sessoes_exercicio` mantêm-se até ao
fim. Durante esse tempo, que é da ordem de segundos, os pedidos que leem utilizadores
(login, `/auth/eu`, `/perfil`) ficam à espera, sem falhar.

**Risco real:** a fila de bloqueios. Se houver uma transacção longa aberta sobre uma das
tabelas, o `ALTER TABLE` espera por ela e todos os pedidos seguintes ficam em fila atrás
dele. Com o tráfego actual isto é improvável. A mitigação opcional, que não faz parte do
PR, seria correr a migração com `SET lock_timeout = '5s'`: falha rápido e tenta-se de novo.

## 4. Downgrade: o que se perde

`alembic downgrade f3c8a1e6b9d4` remove os 3 CHECKs, o índice e **as 13 colunas**:

- As **linhas** de `sessoes_exercicio` e `utilizadores` ficam todas (ensaiado: as
  contagens mantêm-se).
- **Perdem-se definitivamente:**
  - todos os resultados por olho: `olho`, `limiar`, `unidade`, `distancia_mm`,
    `px_por_mm`, `calibrado`, `segundos_activos`, `sinais`;
  - a calibração e o perfil visual dos utilizadores;
  - **a própria `versao`**: as sessões novas passam a ser indistinguíveis das antigas
    com o mesmo id (`figure8` "Oito" ≠ `figure8` "Acuidade").
- A única forma de recuperar é o backup tirado antes da migração.
- Recomendação: **não fazer downgrade** como rollback. A API antiga funciona com as
  colunas novas presentes (ver `docs/DEPLOY_EXERCICIOS_SEM_WEBCAM.md`), por isso fazer
  rollback do código chega.

## 5. Ensaio com uma cópia dos dados reais

```bash
# 1. Uma base local descartável (ex.: docker compose up db, ou outro Postgres 16 local)
# 2. Um dump que o dono do projecto fornece (pg_dump -Fc, ou SQL simples)
ENSAIO_DATABASE_URL=postgresql://jpa:jpa@localhost:5432/jpa_ensaio \
ENSAIO_PYTHON=/caminho/para/venv/bin/python \
  api/scripts/ensaio_migracao_copia_producao.sh /caminho/para/producao.dump
```

O script:

1. recria a base local a partir do dump;
2. confirma que está na revisão `f3c8a1e6b9d4`;
3. conta as sessões e os utilizadores;
4. corre `upgrade head` e verifica as contagens, que todas as linhas antigas têm
   `versao = 1`, que as colunas novas estão vazias e que os 3 CHECKs estão validados;
5. corre `downgrade -1` e `upgrade head` outra vez e volta a verificar as contagens;
6. imprime um resumo com o tempo do upgrade.

**Recusa correr** contra:

- bases que não sejam locais;
- sockets `/cloudsql/…`;
- qualquer servidor que seja uma instância Cloud SQL (detecta o papel
  `cloudsqlsuperuser`; isto apanha o Cloud SQL Auth Proxy em `localhost`);

a não ser que a base se chame `*_descartavel` e `ENSAIO_CONFIRMO_DESCARTAVEL=sim`. Mesmo
nesse caso, nunca restaura um dump numa base remota.

Para um backup do Cloud SQL restaurado numa **instância separada**, criada só para isto,
passe o URL dessa instância com a base a terminar em `_descartavel`, confirme, e não
passe dump.

O script foi testado aqui com um dump de exemplo (3 utilizadores, 6 sessões) e com cada
caso de recusa.
