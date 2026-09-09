# Janelas Para a Alma

> Plataforma angolana de saúde visual: rastreio de estrabismo por webcam, terapia visual
> gamificada e encaminhamento para uma rede de clínicas parceiras.
>
> **"Um Olhar Alinhado, Uma Vida Transformada"**

---

## Este repositório é uma reescrita de infraestrutura

O repositório anterior (`janelasparaalma`) construiu o produto sobre Supabase + Vercel.
Este monorepo é a mesma aplicação — mesmo frontend, mesmas regras de negócio, mesmas
lições de bugs reais — sobre infraestrutura própria: **FastAPI + Postgres + Cloudflare R2,
em containers no Google Cloud Run.** Ver [`CLAUDE.md`](./CLAUDE.md) secção 0 para o
detalhe de o que mudou e porquê.

Decisão explícita: **sem importação de dados do Supabase.** A base de dados nasce vazia,
com a mesma estrutura de tabelas, sem os dados. Ver `docs/BACKLOG.md` para o plano de
migração módulo-a-módulo do frontend (troca de chamadas directas ao Supabase por chamadas
à API própria).

---

## Estrutura

```
frontend/     React + Vite + TS + shadcn/ui — copiado do repositório antigo, a ser
              migrado módulo a módulo para falar com a API em vez do Supabase
api/          FastAPI, em camadas: routers/services/repositories/schemas/core
infra/
  docker/     Dockerfiles do frontend (build + NGINX) e da api
  nginx/      configuração do NGINX (serve o build, proxy para /api/)
docs/         BACKLOG.md (plano vivo) e histórico do projecto
docker-compose.yml   ambiente de desenvolvimento local (db + api + frontend)
```

---

## Correr localmente

### Com Docker (espelha produção)

```bash
docker compose up --build
```

- Frontend: http://localhost:8080
- API: http://localhost:8000 (docs automáticas em `/docs`)
- Postgres: `localhost:5432` (utilizador/password/bd: `jpa`/`jpa`/`jpa`)

### Sem Docker (ciclo de edição mais rápido)

**Frontend:**
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

**API** (requer Postgres a correr — `docker compose up db` é suficiente):
```bash
cd api
python -m venv .venv
.venv/Scripts/activate   # Windows; noutros SOs: source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
alembic upgrade head
python -m uvicorn app.main:app --reload
```

---

## Testes

| | Comando | Onde |
|---|---|---|
| Frontend | `npm run test` | dentro de `frontend/` |
| API | `pytest -v` | dentro de `api/`, com o venv activo |
| Lint frontend | `npm run lint` | dentro de `frontend/` |
| Lint API | `ruff check app tests` | dentro de `api/`, com o venv activo |

Regras completas de testes — o que é obrigatório, unitário vs integração — estão em
[`CLAUDE.md`](./CLAUDE.md) secção 8.

---

## Estado do projecto

O produto (páginas, exercícios, scanner, painel administrativo) é o mesmo que já existia
— ver o README do repositório antigo para o levantamento honesto do que funciona e do que
está partido a nível de produto. A novidade aqui é só a infraestrutura por baixo, ainda a
meio da migração:

- ✅ API própria com autenticação (registo, login, refresh token) — testada, 12/12 testes
- ✅ Esquema de dados espelhado (16 tabelas, ver `api/app/repositories/orm_models.py`)
- ✅ Containers (frontend + api + db) a correr localmente
- ⏳ Frontend ainda fala com o Supabase directamente — migração módulo a módulo em curso,
  ver `docs/BACKLOG.md`
- ⏳ Deploy no Cloud Run — ainda não feito

---

## Mapa da documentação

| Ficheiro | Para quem | O quê |
|---|---|---|
| `README.md` | Humanos | Este ficheiro |
| [`CLAUDE.md`](./CLAUDE.md) | Claude Code (automático) + humanos | Regras de desenvolvimento, checklist, armadilhas |
| [`docs/BACKLOG.md`](./docs/BACKLOG.md) | Equipa | Plano de tarefas — raciocínio e histórico |

---

<sub>Janelas Para a Alma · documentação viva — actualizar sempre que uma fase for concluída.</sub>
