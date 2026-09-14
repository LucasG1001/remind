# CLAUDE.md

Este arquivo orienta o Claude Code (claude.ai/code) ao trabalhar neste repositório.

## Visão geral

**RemindMe** é um app pessoal full-stack (usuário único, sem auth) com duas áreas que compartilham o mesmo design:

- **Lembretes** — avisos por **Web Push** no PWA (Android) com dois botões de ação (`Soneca 15 min` / `Concluir`) e recorrência. O backend envia com `web-push`/VAPID; o service worker (`frontend/public/sw.js`) exibe e executa as ações.
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

Pré-requisito local: PostgreSQL acessível (banco `remindme`) e um par VAPID (`npx web-push generate-vapid-keys`) para testar os avisos.

## Arquitetura

### Fluxo de dados

```
Browser → Caddy (proxy central, TLS) → Express (server :3333, serve SPA + API) → PostgreSQL
                                                  │
                                                  └──(só Lembretes)──▶ Web Push (VAPID) ──▶ FCM ──▶ PWA/sw.js
```

Em produção não há nginx: o Express serve os arquivos estáticos do build do frontend (`backend/public`, copiado na imagem) com fallback de SPA e expõe a API em `/api` na mesma porta 3333. Em dev o Vite (`:5173`) serve o frontend e faz proxy de `/api` para `:3333` — o Express só serve estáticos quando `backend/public` existe.

O backend roda `migrate()` no startup (criação idempotente de todas as tabelas — sem arquivos de migração).

### Backend (`backend/src/`)

Dois domínios, mesmo padrão em camadas: `types/` → `models/` (mapper `toX` snake→camel, queries parametrizadas) → `schemas/` (Zod) → `controllers/` (try/catch, valida com Zod, responde `{ error: "msg PT" }`) → `routes/` (Router + export nomeado).

- **`server.ts`** — Express, registra rotas (`/api/reminders`, `/api/habits`, `/api/projects`, `/api/flashcards`, `/api/flashcard-categories`, `/api/push`), roda `migrate()` e inicia o scheduler de lembretes.
- **`database/connection.ts`** — pool pg (usa `DATABASE_URL`). **`database/migrate.ts`** — DDL idempotente. **`database/transaction.ts`** — `withTransaction(fn)` e `updateById` (UPDATE dinâmico reutilizado pelos models).
- **`lib/validation.ts`** — `requireUuid`, `parseBody(res, schema, body)`, `respondValidationError` e as regex `DATE_RE`/`TIME_RE`, compartilhados pelos controllers. **`lib/sqlUpdate.ts`** — `buildUpdateSet` + `nextPositionSql`.
- **Reminders**: `models/reminderModel.ts`, `controllers/reminderController.ts`, `services/reminderScheduler.ts` (setInterval 60s) e `services/reminderStateMachine.ts` (lógica de fases, testada). `lib/dateUtils.ts` isola o fuso (America/Sao_Paulo, UTC-3).
- **Habits**: `models/habitModel.ts` (inclui conclusões + `CompletionLockedError`), `controllers/habitController.ts`. Sem scheduler/notificações.
- **Web Push**: `services/pushService.ts` (lib `web-push`) faz fan-out para todas as linhas de `push_subscriptions`, com `urgency: high`, `TTL` de 15 min e `topic` = id do lembrete. Todo o conteúdo vai no payload cifrado — o service worker nunca busca dados para montar a notificação. `404`/`410` do endpoint remove a subscription. Rotas em `/api/push` (`public-key`, `subscribe`, `unsubscribe`, `test`).
- **Soneca**: `POST /api/reminders/:id/snooze` grava `phase = "snoozed"` e um novo `next_notify_at` **sem tocar em `event_at`** — é o que separa soneca de remarcar. A fase `snoozed` retoma a trilha via `initialSchedule` quando o evento ainda está no futuro.

### Frontend (`frontend/src/`)

- **`App.tsx`** — BrowserRouter + `Sidebar`; rotas `/lembretes`, `/lembretes/novo`, `/lembretes/r/:id`, `/habitos` (`/` redireciona para `/lembretes`).
- **`components/Sidebar/`** — navegação Lembretes/Hábitos (bottom-nav no mobile).
- **`components/Timeline/`** + **`utils/agenda.ts`** — linha do tempo genérica (`TimelineItem`, `splitAgenda`, `groupByDay`, `groupByMonth`) usada pelas duas páginas.
- **Lembretes**: `pages/RemindersPage` (timeline na aba Ativos + cards nas demais), `pages/ReminderFormPage`, `components/ReminderCard`, `hooks/useReminders.ts`, `services/reminderService.ts`, `utils/format.ts`.
- **Push**: `public/sw.js` (service worker só de push — sem handler de `fetch` nem precache; registrado em `main.tsx`), `hooks/usePushNotifications.ts`, `services/pushService.ts`, `utils/push.ts` e `components/PushBanner` (opt-in no topo da página de Lembretes).
- **Hábitos**: `pages/HabitsPage` (`TodayHeader` + `TodayHabitList` com as `WeekBars` da semana, timeline de ocorrências, `SidePanel` e `HabitForm`), `hooks/useHabits.ts` (recalcula streak/level no cliente), `services/habitService.ts`, `utils/{dateUtils,streakUtils,levelUtils}.ts` e os componentes `CompletionGrid`, `DaySelector`.
- **`utils/iconLibrary.tsx`** — vocabulário único de ícones SVG (`ICON_LIBRARY`, `getIcon`, `DEFAULT_ICON_KEY`), usado por hábitos e pelas tags de projeto; persistido pela string `key`. `utils/colorTints.ts` (`tints`) é o tint compartilhado por tags e categorias de flashcard.
- **`styles/global.css`** — CSS custom properties (tema escuro púrpura, fonte Inter). Vocabulário único de tokens `--color-*`/`--radius-*`/`--level-1..8`; sempre usar essas variáveis (nunca hardcode de cor).

### Endpoints

- `GET/POST /api/reminders`; `GET/PUT/DELETE /api/reminders/:id`; `POST /api/reminders/:id/acknowledge`, `/cancel`, `/reschedule` e `/snooze` (body `{ minutes }`).
- `GET /api/push/public-key`; `POST /api/push/subscribe`, `/unsubscribe` e `/test`.
- `GET/POST /api/habits`; `PUT/DELETE /api/habits/:id`; `PATCH /api/habits/:id/completion/:date` (body `{ count: number }`).
- `POST /api/projects/:id/tags`; `PUT/DELETE /api/projects/tags/:tagId`. O `PUT /api/projects/cards/:cardId` aceita `tagIds` (substitui o conjunto inteiro; `[]` limpa).

### Schema do banco

- **`reminders`** — lembrete com `event_at`, `is_all_day`, recorrência (`recur_*`), `status`, `phase`, `next_notify_at`, `notify_count`, `max_notify`, etc.
- **`habits`** — `id`, `name`, `selected_days INTEGER[]` (0–6), `icon`, `target_count`, `position`, timestamps. Streak/nível são recalculados no cliente (não persistidos).
- **`habit_completions`** — `habit_id` (FK cascade), `date TEXT` (YYYY-MM-DD), `count`, `locked`, `UNIQUE(habit_id, date)`. O campo `completed` da API é derivado (`count >= target_count`).
- **`project_tags`** — tag de um projeto (`project_id` FK cascade, `name`, `color`, `icon`, `position`). A cor é restringida à paleta `TAG_COLORS` no Zod (`schemas/project.ts`, espelhada em `frontend/src/utils/tagPalette.ts`), não no banco.
- **`card_tags`** — vínculo N:N (`card_id`/`tag_id`, ambos FK cascade, PK composta). Editar uma tag reflete em todos os cartões porque o cartão guarda só o `id`; excluir a tag limpa os vínculos pelo cascade. `tagIds` chega ao board por uma query só (`loadCardTagIds`), agrupada em JS como os cartões.
- **`push_subscriptions`** — `endpoint UNIQUE` (identidade da subscription, chave do upsert), `p256dh`, `auth`, `user_agent`, `last_seen_at`. Uma linha por aparelho.

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

Backend (`backend/.env`): `DATABASE_URL`, `PORT` (3333), `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

Docker (`.env`): `POSTGRES_USER/PASSWORD/DB`, `VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT`, `REMINDME_DOMAIN`.

## Produção (Docker) e proxy

O domínio é roteado pelo **proxy reverso central Caddy** (`caddy-docker-proxy`, stack `../media/proxy`), **compartilhado por todos os projetos da VPS** — não há proxy próprio aqui. O serviço `server` entra na rede `proxy-net` e declara labels `caddy: ${REMINDME_DOMAIN}` / `caddy.reverse_proxy: "{{upstreams 3333}}"`; o Caddy descobre o container e termina o TLS (ACME DNS-01 via Cloudflare). Por isso o `server` não expõe porta no host. Não há container `web`/nginx: o próprio `server` (Express) serve o SPA e a API. A imagem é construída a partir da raiz do projeto (`build.context: .`, `dockerfile: backend/Dockerfile`), pois o Dockerfile builda frontend e backend juntos.

```bash
docker network create remindme-net   # rede compartilhada da VPS
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
