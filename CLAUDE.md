# CLAUDE.md

Este arquivo orienta o Claude Code (claude.ai/code) ao trabalhar neste repositório.

## Visão geral

**RemindMe** é um app pessoal full-stack (usuário único, sem auth) com duas áreas que compartilham o mesmo design:

- **Lembretes** — avisos por **Web Push** no PWA (Android) com dois botões de ação (`Soneca 15 min` / `Concluir`) e recorrência. O backend envia com `web-push`/VAPID; o service worker (`frontend/public/sw.js`) exibe e executa as ações.
- **Hábitos** — tracking de hábitos com sequência, níveis e heatmap de conclusões, mais avisos por **Web Push** em horários configuráveis (`Concluir` / `Pular`). (Domínio fundido do antigo projeto `done`, descontinuado.)

O frontend navega entre as duas por uma barra no topo (`components/TopNav`, que vira barra inferior no mobile). Lembretes usa a **lista em seções** (`components/Timeline`, agrupada em Atrasados/Hoje e depois um bloco por mês); Hábitos tem layout próprio.

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
                                                  └──(Lembretes e Hábitos)──▶ Web Push (VAPID) ──▶ FCM ──▶ PWA/sw.js
```

Em produção não há nginx: o Express serve os arquivos estáticos do build do frontend (`backend/public`, copiado na imagem) com fallback de SPA e expõe a API em `/api` na mesma porta 3333. Em dev o Vite (`:5173`) serve o frontend e faz proxy de `/api` para `:3333` — o Express só serve estáticos quando `backend/public` existe.

O backend roda `migrate()` no startup (criação idempotente de todas as tabelas — sem arquivos de migração).

### Backend (`backend/src/`)

Dois domínios, mesmo padrão em camadas: `types/` → `models/` (mapper `toX` snake→camel, queries parametrizadas) → `schemas/` (Zod) → `controllers/` (try/catch, valida com Zod, responde `{ error: "msg PT" }`) → `routes/` (Router + export nomeado).

- **`server.ts`** — Express, registra rotas (`/api/reminders`, `/api/habits`, `/api/projects`, `/api/flashcards`, `/api/flashcard-categories`, `/api/push`), roda `migrate()` e inicia o scheduler de lembretes.
- **`database/connection.ts`** — pool pg (usa `DATABASE_URL`). **`database/migrate.ts`** — DDL idempotente. **`database/transaction.ts`** — `withTransaction(fn)` e `updateById` (UPDATE dinâmico reutilizado pelos models).
- **`lib/validation.ts`** — `requireUuid`, `parseBody(res, schema, body)`, `respondValidationError` e as regex `DATE_RE`/`TIME_RE`, compartilhados pelos controllers. **`lib/sqlUpdate.ts`** — `buildUpdateSet` + `nextPositionSql`.
- **Reminders**: `models/reminderModel.ts`, `controllers/reminderController.ts`, `services/reminderScheduler.ts` (setInterval 60s) e `services/reminderStateMachine.ts` (lógica de fases, testada). `lib/dateUtils.ts` isola o fuso (America/Sao_Paulo, UTC-3).
- **Habits**: `models/habitModel.ts` (inclui conclusões + `CompletionLockedError` e `ReminderLimitError`), `controllers/habitController.ts`, `services/habitReminderState.ts` (decisão pura, testada) + `services/habitScheduler.ts`, chamado de dentro do tick de lembretes — não há um segundo `setInterval`, a guarda `inFlight` é por módulo.
- **Avisos de hábito**: cada horário insiste na grade `dueAt + k*5min` e a janela fecha em **+25 min** (as 5 insistências), cortada também pelo horário seguinte e pela meia-noite de SP. "Cumprido" é **derivado, nunca gravado** — o horário de índice `k` está cumprido se `k < min(count, targetCount, nº de horários)`, e é isso que faz desfazer um check reativar o aviso. Só o pendente mais antigo avisa. `count` pode exceder a meta (o clamp do banco só vale na escrita), daí o `min` triplo.
- **Web Push**: `services/pushService.ts` (lib `web-push`) faz fan-out para todas as linhas de `push_subscriptions`, com `urgency: high`, `TTL` de 15 min e `topic` derivado de `collapseKey` (limite de 32 chars do header). O `PushPayload` tem `kind: "reminder" | "habit"`; **o id do hábito nunca vai em `reminderId`** — é o contrato de compatibilidade: num aparelho com o service worker antigo em cache, a falta de `reminderId` cai no ramo de push de teste em vez de postar em `/api/reminders/<habitId>`. Todo o conteúdo vai no payload cifrado — o service worker nunca busca dados para montar a notificação. `404`/`410` do endpoint remove a subscription. Rotas em `/api/push` (`public-key`, `subscribe`, `unsubscribe`, `test`).
- **Soneca**: `POST /api/reminders/:id/snooze` grava `phase = "snoozed"` e um novo `next_notify_at` **sem tocar em `event_at`** — é o que separa soneca de remarcar. A fase `snoozed` retoma a trilha via `initialSchedule` quando o evento ainda está no futuro.

### Frontend (`frontend/src/`)

- **`App.tsx`** — BrowserRouter + `CalendarProvider` + `HeaderSlotProvider` + `TopNav`; rotas `/inicio`, `/lembretes` (com `novo` e `r/:id` aninhadas), `/habitos`, `/projetos`, `/flashcards` (`/` redireciona para `/lembretes`).
- **`components/TopNav/`** — header: marca, `SectionSwitcher` (dropdown das seções, em portal no `body`), o slot de contexto e os botões Calendário/`+`, só com ícone (o destino do `+` vem de `navItems.ts`). Abaixo de 768px o header continua, condensado (seção + contexto + calendário), e ganha a bottom-nav com FAB central. `components/Icon/icons.tsx` é a biblioteca de ícones SVG compartilhada.
- **Slot do header** — `context/HeaderSlotContext.tsx` + `useHeaderSlot()`: o TopNav publica o nó do slot e a página ativa injeta ali seu contexto por `createPortal`, sem espelhar estado. Hoje usam o slot: `FlashcardsPage` (abas Estudar/Gerenciar), `ProjectsPage` (`ProjectSwitcher` do quadro), `HabitsPage` (abas Hoje/Check-ins, só abaixo de 768px) e `RemindersPage` (resumo "N atrasados · N para hoje"). Quem não usa deixa vazio — o separador some via `:has(.slot:empty)`.
- **`components/Timeline/`** + **`utils/agenda.ts`** — lista de lembretes em seções (`TimelineItem`, `TimelineSection`, `splitReminders`, `groupByMonth`, `dayCellLabel`, `todayLabel`). Depois de Atrasados e Hoje vem um bloco por mês (`groupByMonth`, rótulo com o ano só quando não é o corrente). Cada linha é `data+hora | título+meta | ações`, e a meta abre com a contagem em dias — `há 3 dias` no atrasado, `faltam N dias`/`amanhã` no futuro, nada em Hoje; no mobile a coluna de ações vira um círculo de check e **Adiar** some (o toque abre o `ReminderActionsSheet`). `groupByDay`/`itemTime` continuam servindo a `DashboardPage`.
- **Lembretes**: `pages/RemindersPage` (coluna de 660px + `components/RemindersRail` — mini-calendário e próximos feriados — a partir de 1024px; `components/WeekStrip` no lugar do rail abaixo de 768px), `components/ReminderForm` (rotas `novo` e `r/:id`), `components/ReminderActionsSheet`, `hooks/useReminders.ts`, `services/reminderService.ts`, `utils/format.ts`. Não há `snooze` no frontend: **Adiar** usa `reschedule` pelos presets do sheet.
- **Push**: `public/sw.js` (service worker só de push — sem handler de `fetch` nem precache; registrado em `main.tsx`), `hooks/usePushNotifications.ts`, `services/pushService.ts`, `utils/push.ts` e `components/PushBanner` (opt-in no topo da página de Lembretes).
- **Avisos de hábito no app**: o `HabitForm` tem a seção "Horários de aviso" (lista de `input[type=time]`, adicionar/remover, excedentes da meta apagados com "não notifica" — salvos, não apagados). O `TodayHabitCard` tem o sino (desliga/reativa o próximo aviso de hoje) e o `−` (volta um check); ambos precisam de `pointer-events: auto` e `data-role="habit-check"`, senão o overlay de editar engole o toque e o toque longo abre arraste. `GET /api/habits` devolve `reminders` e o `nextReminderId` **resolvido no servidor** — o cliente escolhendo "o próximo" pelo relógio dele sobre uma lista velha pularia o horário errado. `useHabits` escuta `habit-updated` do service worker.
- **Hábitos**: `pages/HabitsPage` com duas zonas — `TodayColumn` (cabeçalho + `TodayHabitCard`, que traz o botão de check 44×44 e a `LevelStrip`) e `HistoryPanel` (`PeriodSwitcher` + setas + `HabitHistoryCard` > `HabitHeatmap`). Abaixo de 768px as duas viram abas `Hoje | Check-ins` no slot do header e só a ativa é renderizada (`hooks/useIsMobile.ts`); acima, split de 330px + painel. Estado de recorte em `hooks/usePeriodNav.ts`; dados em `hooks/useHabits.ts` (recalcula sequência/nível no cliente), `services/habitService.ts`, `utils/{dateUtils,streakUtils,levelUtils,heatmap,period}.ts` e `components/{DaySelector,HabitForm}`.
- **Nível de hábito** (`utils/levelUtils.ts`) — varredura de `createdAt` até hoje só nos dias agendados: `LEVEL_STEP` (30) concluídos seguidos sobem um nível e zeram o progresso; cada bloco de `LEVEL_DROP_MISSES` (3) agendados perdidos seguidos derruba um, com piso em 1. Hoje não conta como falta enquanto o dia não fecha. A faixa de 30 células do card de Hoje **é** esse progresso, não histórico.
- **Heatmap** (`utils/heatmap.ts`) — vocabulário único de estados `completed / missed / pending / notScheduled / future`, ciente de `selectedDays` e `createdAt`, e as grades de semana/mês/ano. O ano é estilo GitHub (`grid-auto-flow: column`, coluna = semana, linha = dia da semana). A semana começa no **domingo** em todo o app (`startOfWeek`, `WEEKDAY_LETTERS`, `useMonthGrid`).
- **`utils/iconLibrary.tsx`** — vocabulário único de ícones SVG (`ICON_LIBRARY`, `getIcon`, `DEFAULT_ICON_KEY`), usado por hábitos e pelas tags de projeto; persistido pela string `key`. `utils/colorTints.ts` (`tints`) é o tint compartilhado por tags e categorias de flashcard.
- **`styles/global.css`** — CSS custom properties (tema escuro azulado com acento lilás `#9184d9`, Inter em `px` nos pesos 400/500/600 — carregada no `index.html`), espelhando o sistema do projeto `carteira`. Vocabulário único de tokens `--color-*`/`--radius-*`/`--level-1..8` + as escalas `--color-neutral-100..900` e `--color-accent-100..900`; sempre usar essas variáveis (nunca hardcode de cor). O acento é claro: texto sobre preenchimento de acento usa `--color-on-accent` (escuro).

### Endpoints

- `GET/POST /api/reminders`; `GET/PUT/DELETE /api/reminders/:id`; `POST /api/reminders/:id/acknowledge`, `/cancel`, `/reschedule` e `/snooze` (body `{ minutes }`).
- `GET /api/push/public-key`; `POST /api/push/subscribe`, `/unsubscribe` e `/test`.
- `GET/POST /api/habits`; `PUT/DELETE /api/habits/:id`; `PATCH /api/habits/:id/completion/:date` (body `{ count: number }`).
- `POST /api/habits/:id/reminders` (body `{ time }`); `DELETE /api/habits/reminders/:reminderId`; `POST /api/habits/reminders/:reminderId/skip` (body `{ skipped, date }`); `POST /api/habits/:id/reminders/complete` (body `{ slotIndex, date }`, alvo do botão da notificação — **idempotente**, faz `GREATEST(atual, slotIndex+1)`, porque o push vai para todos os aparelhos). As rotas `/reminders/...` ficam **antes** das de `:id` no Router, senão "reminders" casa como id de hábito.
- `POST /api/projects/:id/tags`; `PUT/DELETE /api/projects/tags/:tagId`. O `PUT /api/projects/cards/:cardId` aceita `tagIds` (substitui o conjunto inteiro; `[]` limpa).

### Schema do banco

- **`reminders`** — lembrete com `event_at`, `is_all_day`, recorrência (`recur_*`), `status`, `phase`, `next_notify_at`, `notify_count`, `max_notify`, etc.
- **`habits`** — `id`, `name`, `selected_days INTEGER[]` (0–6), `icon`, `target_count`, `position`, timestamps. Sequência/nível são recalculados no cliente (não persistidos). `GET /api/habits` devolve o histórico completo de conclusões, sem janela de data — é o que sustenta a visão de ano.
- **`habit_reminders`** — horário de aviso de um hábito (`habit_id` FK cascade, `time` "HH:MM" de SP, `UNIQUE(habit_id, time)`). **Sem coluna de posição**: a ordem é o `time`, e o índice nessa ordem é a chave que decide se o aviso já foi cumprido — duas fontes de verdade aqui viram bug. A trava "nº de horários ≤ `target_count`" é no controller, não no Zod (o `PUT` é substituição total e rejeitaria o formulário inteiro).
- **`habit_reminder_runtime`** — estado do dia de um horário (`habit_reminder_id` FK cascade, `date`, `skipped`, `last_sent_at`, PK composta), criado **sob demanda**: ausência de linha É o estado limpo, então não existe rotina de reset nem corrida na virada do dia. `migrate()` apaga o que passou de 7 dias.
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
