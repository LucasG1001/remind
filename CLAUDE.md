# CLAUDE.md

Este arquivo orienta o Claude Code (claude.ai/code) ao trabalhar neste repositório.

## Visão geral

**RemindMe** é um app pessoal full-stack (usuário único, sem auth) com duas áreas que compartilham o mesmo design:

- **Lembretes** — avisos no Telegram com botões de ação e recorrência. Notificações enviadas via **notify-api** (gateway do Telegram); o RemindMe nunca fala com o Telegram diretamente.
- **Hábitos** — tracking de hábitos com streak, níveis e grade de conclusões. **Sem notificações.** (Domínio fundido do antigo projeto `done`, descontinuado.)

O frontend navega entre as duas por uma Sidebar (vira barra inferior no mobile) e ambas usam o mesmo componente de **linha do tempo** (`components/Timeline`, agrupada por dia/mês).

## Comandos de desenvolvimento

```bash
# backend (hot-reload via tsx)
cd backend && npm run dev        # http://localhost:3333
cd backend && npm run build      # tsc → dist/
cd backend && npm start          # node dist/server.js
cd backend && npm test           # vitest

# frontend (Vite)
cd frontend && npm run dev       # http://localhost:5173 (proxy /api → :3333)
cd frontend && npm run build     # tsc -b + vite build
cd frontend && npm run lint      # ESLint
```

Pré-requisito local: PostgreSQL acessível (banco `remindme`). A notify-api só é necessária para testar os avisos dos Lembretes.

## Arquitetura

### Fluxo de dados

```
Browser → Caddy (proxy central, TLS) → Express (server :3333, serve SPA + API) → PostgreSQL
                                                  │
                                                  └──(só Lembretes)──▶ notify-api :3334 ──▶ Telegram
```

Em produção não há nginx: o Express serve os arquivos estáticos do build do frontend (`backend/public`, copiado na imagem) com fallback de SPA e expõe a API em `/api` na mesma porta 3333. Em dev o Vite (`:5173`) serve o frontend e faz proxy de `/api` para `:3333` — o Express só serve estáticos quando `backend/public` existe.

O backend roda `migrate()` no startup (criação idempotente de `reminders`, `habits`, `habit_completions` — sem arquivos de migração).

### Backend (`backend/src/`)

Dois domínios, mesmo padrão em camadas: `types/` → `models/` (mapper `toX` snake→camel, queries parametrizadas) → `schemas/` (Zod) → `controllers/` (try/catch, valida com Zod, responde `{ error: "msg PT" }`) → `routes/` (Router + export nomeado).

- **`server.ts`** — Express, registra rotas (`/api/reminders`, `/api/habits`, `/api/projects`, `/api/flashcards`, `/api/flashcard-categories`), roda `migrate()` e inicia o scheduler de lembretes.
- **`database/connection.ts`** — pool pg (usa `DATABASE_URL`). **`database/migrate.ts`** — DDL idempotente. **`database/transaction.ts`** — `withTransaction(fn)` e `updateById` (UPDATE dinâmico reutilizado pelos models).
- **`lib/validation.ts`** — `requireUuid`, `parseBody(res, schema, body)` e `respondValidationError`, compartilhados pelos controllers. **`lib/sqlUpdate.ts`** — `buildUpdateSet` + `nextPositionSql`.
- **Reminders**: `models/reminderModel.ts`, `controllers/reminderController.ts`, `services/reminderScheduler.ts` (setInterval 60s) e `services/reminderStateMachine.ts` (lógica de fases, testada). `lib/dateUtils.ts` isola o fuso (America/Sao_Paulo, UTC-3).
- **Habits**: `models/habitModel.ts` (inclui conclusões + `CompletionLockedError`), `controllers/habitController.ts`. Sem scheduler/notificações.
- **notify-api**: `services/notifyService.ts` envia notificações (só texto) via gateway. Sem fluxo de callback do Telegram.

### Frontend (`frontend/src/`)

- **`App.tsx`** — BrowserRouter + `Sidebar`; rotas `/lembretes`, `/lembretes/novo`, `/lembretes/r/:id`, `/habitos` (`/` redireciona para `/lembretes`).
- **`components/Sidebar/`** — navegação Lembretes/Hábitos (bottom-nav no mobile).
- **`components/Timeline/`** + **`utils/agenda.ts`** — linha do tempo genérica (`TimelineItem`, `splitAgenda`, `groupByDay`, `groupByMonth`) usada pelas duas páginas.
- **Lembretes**: `pages/RemindersPage` (timeline na aba Ativos + cards nas demais), `pages/ReminderFormPage`, `components/ReminderCard`, `hooks/useReminders.ts`, `services/reminderService.ts`, `utils/format.ts`.
- **Hábitos**: `pages/HabitsPage` (timeline de ocorrências + `SidePanel` + `HabitForm`), `hooks/useHabits.ts` (recalcula streak/level no cliente), `services/habitService.ts`, `utils/{dateUtils,streakUtils,levelUtils}.ts`, componentes `CompletionGrid`, `SidePanel`, `HabitForm`, `DaySelector`, `LevelBadge`.
- **`styles/global.css`** — CSS custom properties (tema escuro púrpura, fonte Inter). Vocabulário único de tokens `--color-*`/`--radius-*`/`--level-1..8`; sempre usar essas variáveis (nunca hardcode de cor).

### Endpoints

- `GET/POST /api/reminders`; `GET/PUT/DELETE /api/reminders/:id`; `POST /api/reminders/:id/acknowledge` e `/cancel`.
- `GET/POST /api/habits`; `PUT/DELETE /api/habits/:id`; `PATCH /api/habits/:id/completion/:date` (body `{ count: number }`).

### Schema do banco

- **`reminders`** — lembrete com `event_at`, `is_all_day`, recorrência (`recur_*`), `status`, `phase`, `next_notify_at`, `notify_count`, `max_notify`, etc.
- **`habits`** — `id`, `name`, `selected_days INTEGER[]` (0–6), `icon`, `target_count`, `position`, timestamps. Streak/nível são recalculados no cliente (não persistidos).
- **`habit_completions`** — `habit_id` (FK cascade), `date TEXT` (YYYY-MM-DD), `count`, `locked`, `UNIQUE(habit_id, date)`. O campo `completed` da API é derivado (`count >= target_count`).

## Convenções

- **Idioma**: código (variáveis, tipos, arquivos) em inglês; textos ao usuário (erros de API, UI) em português.
- **TypeScript** strict nos dois lados. Backend `module: NodeNext` → **imports com extensão `.js`**. Frontend `moduleResolution: bundler` → sem extensão.
- **Estilo**: CSS Modules por componente, sem libs de UI. Sempre usar as variáveis do `global.css`, nunca hardcode de cores/tamanhos.
- **Estado**: só hooks do React (`useState`/`useEffect`/etc.) — sem Redux/Zustand.
- **Sem comentários** no código, exceto quando registram uma restrição não óbvia.
- **HTTP**: `201` create, `204` delete, `400` validação, `404` not found, `409` conflito (`CompletionLockedError`), `500` erro.

## Fuso horário

Lembretes usam fuso fixo America/Sao_Paulo isolado em `backend/src/lib/dateUtils.ts`. No frontend, `utils/dateUtils.ts` (`spCalendarDay`/`spDateKey`/`diffDaysFromToday`) espelha esse fuso fixo (UTC-3): tanto a timeline de lembretes quanto os hábitos usam o dia-calendário de SP, gravando a chave `YYYY-MM-DD`.

## Variáveis de ambiente

Backend (`backend/.env`): `DATABASE_URL`, `PORT` (3333), `NOTIFY_API_URL`, `NOTIFY_API_KEY`.

Docker (`.env`): `POSTGRES_USER/PASSWORD/DB`, `NOTIFY_API_KEY`, `REMINDME_DOMAIN`.

## Produção (Docker) e proxy

O domínio é roteado pelo **proxy reverso central Caddy** (`caddy-docker-proxy`, stack `../media/proxy`), **compartilhado por todos os projetos da VPS** — não há proxy próprio aqui. O serviço `server` entra na rede `proxy-net` e declara labels `caddy: ${REMINDME_DOMAIN}` / `caddy.reverse_proxy: "{{upstreams 3333}}"`; o Caddy descobre o container e termina o TLS (ACME DNS-01 via Cloudflare). Por isso o `server` não expõe porta no host. Não há container `web`/nginx: o próprio `server` (Express) serve o SPA e a API. A imagem é construída a partir da raiz do projeto (`build.context: .`, `dockerfile: backend/Dockerfile`), pois o Dockerfile builda frontend e backend juntos.

```bash
docker network create remindme-net   # compartilhada com a notify-api
docker network create proxy-net       # compartilhada com o proxy central
docker compose up --build             # https://${REMINDME_DOMAIN} pela VPN
```

Migração de dados do antigo `done`: `backend/scripts/migrate-habits-from-done.mjs` (ver README).

## Fluxo de trabalho

- Para tarefas que envolvam mais de um arquivo, apresente um plano e aguarde aprovação antes de editar.
- Tarefas simples (1 arquivo, mudança pequena) pode executar direto.

## Manutenção deste arquivo

- Quando uma mudança tornar algo aqui factualmente incorreto (módulo/arquivo renomeado ou
  removido, comando alterado, nova integração, novo invariante ou gotcha), atualize a linha
  afetada na mesma tarefa.
- Edite no lugar e remova o que ficou obsoleto — este arquivo não cresce sem contrapartida.
  Prefira descrever padrões/invariantes estáveis a listar arquivos.
- Documente fatos, não preferências. Não adicione convenções ou "boas práticas" novas por conta
  própria: proponha e deixe a decisão de estilo comigo.
- Mantenha conciso e em português.
