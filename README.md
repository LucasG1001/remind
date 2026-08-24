# RemindMe

App pessoal (usuário único, sem auth) com duas áreas que compartilham o mesmo design:

- **Lembretes** — notificações push no celular (PWA) com botões de ação, e recorrência (fixa ou relativa à conclusão).
- **Hábitos** — tracking de hábitos com sequência (streak), níveis e grade de conclusões. **Sem notificações** (só acompanhamento).

A navegação entre as duas é feita por uma Sidebar (vira barra inferior no mobile). As duas páginas usam o mesmo visual de **linha do tempo** (agenda agrupada por dia/mês).

## Lembretes — como funcionam

- **Evento com hora** (ex: "Reunião 18/06 14:00"): avisa **30 min antes → 5 min antes → no horário** e depois de 10 em 10 min, até ~10 avisos no total (senão cancela sozinho). Criou perto do horário? Os marcos já vencidos são pulados — nada de avisos acumulados.
- **Evento sem hora = dia inteiro** (ex: "Dentista 14/06"): avisa **na véspera às 08:00** e **no dia às 08:00**.
- **Recorrência** — definida na criação/edição: **fixa** (sempre na mesma grade, ex: "toda segunda 10h") ou **relativa à conclusão** (ex: "a cada 6 meses aos sábados", recalculada a partir de quando você confirma). Ao concluir/encerrar uma ocorrência, a próxima é agendada.

As notificações chegam por **Web Push** no PWA instalado e trazem **dois botões** — `Soneca 15 min` e
`Concluir` (o Chrome no Android renderiza no máximo dois). Tocar no corpo da notificação abre o app já
no lembrete. Dentro do app há mais opções:

- **Toque** num lembrete abre uma folha de ações: **Concluir**, **Remarcar** (+1h/+3h/+1d/+1sem ou "Personalizado…") e **Cancelar**.
- **Pressionar e segurar (~500ms)** abre o formulário de **edição**.
- **Remarcar** move só **aquela ocorrência** (não desloca a série recorrente). Não dá para agendar no passado, nem remarcar um recorrente fixo para depois do próximo agendamento.
- **Soneca ≠ remarcar**: a soneca adia só o **aviso** (`phase = snoozed`, novo `next_notify_at`) e **não move o `event_at`** — se o evento ainda está no futuro, o aviso da hora continua caindo no horário certo.

## Início (dashboard)

A rota `/inicio` é a tela inicial: saudação, resumo do dia e cartões de **Esta semana** (lembretes dos próximos 7 dias) e **Hábitos de hoje** (com nível e streak). No canto da saudação, um ícone de **calendário** abre um calendário mensal que mostra, em cada dia, um **badge** com a quantidade de lembretes agendados e destaca os **feriados** (nacionais, estadual SP e municipais de Indaiatuba), com a lista do mês embaixo. Os feriados são calculados no cliente em `utils/holidays.ts` (Páscoa/Computus + offsets), sem banco.

## Hábitos — como funcionam

- Cada hábito tem dias da semana agendados (`selectedDays`; o formulário tem o atalho **"Todos os dias"**). A página de Hábitos mostra os hábitos de **hoje**: quadradinhos para marcar a conclusão e, abaixo, a lista do dia (com o **nível** ao lado e um **risco** quando concluído).
- O clique no item abre um painel lateral com a grade mensal de conclusões, sequência atual/maior e ações de editar/excluir.
- `currentStreak`, `longestStreak` e `level` são **recalculados no cliente** (`utils/streakUtils.ts`, `utils/levelUtils.ts`); o backend só persiste hábitos e conclusões.

> Hábitos vieram do antigo projeto `done`, que foi descontinuado e fundido aqui. As notificações/worker daquele projeto foram descartadas.

## Arquitetura

```
Browser → Caddy (proxy central, TLS) → Express (server :3333, serve SPA + API) → PostgreSQL
                                                  │
                                                  └──(só Lembretes)──▶ Web Push (VAPID) ──▶ FCM ──▶ PWA no Android
```

> O service worker (`frontend/public/sw.js`) recebe o push e mostra a notificação. Os botões chamam
> `POST /api/reminders/:id/snooze` e `/acknowledge` direto do service worker, o que exige que o
> aparelho alcance a API (VPN always-on).

- **Domínios do backend** (mesmo padrão `types → models → schemas → controllers → routes`):
  - `reminders` — `/api/reminders` (+ scheduler de notificações).
  - `habits` — `/api/habits` (CRUD + `/:id/completion/:date`). Sem scheduler.
- O **push** sai de `services/pushService.ts` (lib `web-push`, chaves VAPID). Todo o conteúdo vai no payload cifrado: o service worker nunca busca dados para montar a notificação, então a notificação aparece mesmo sem alcançar a API.
- O **scheduler** (`setInterval` de 60s) varre lembretes vencidos; a lógica de transição fica em `services/reminderStateMachine.ts` (testada). Hábitos não passam pelo scheduler.
- O `migrate()` roda no startup e cria as tabelas de forma idempotente (`reminders`, `habits`, `habit_completions`, `push_subscriptions`).

## Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET/POST` | `/api/reminders` | listar / criar lembrete |
| `GET/PUT/DELETE` | `/api/reminders/:id` | ler / atualizar / remover |
| `POST` | `/api/reminders/:id/acknowledge` `\|` `/cancel` | concluir / cancelar |
| `POST` | `/api/reminders/:id/reschedule` | remarcar (move só a ocorrência atual) |
| `POST` | `/api/reminders/:id/snooze` | adiar só o aviso (body `{ minutes }`), sem mover o evento |
| `GET` | `/api/push/public-key` | chave VAPID pública para o PWA se inscrever |
| `POST` | `/api/push/subscribe` `\|` `/unsubscribe` | registrar / remover o aparelho |
| `POST` | `/api/push/test` | dispara uma notificação de teste nos aparelhos inscritos |
| `GET/POST` | `/api/habits` | listar / criar hábito |
| `PUT/DELETE` | `/api/habits/:id` | atualizar / remover |
| `PATCH` | `/api/habits/:id/completion/:date` | define a contagem do dia (body `{ count }`) |

## Desenvolvimento local

Pré-requisitos: PostgreSQL acessível (banco `remindme`) e um par de chaves VAPID (`npx web-push generate-vapid-keys`).

```bash
# backend
cd backend && cp .env.example .env   # ajuste DATABASE_URL e as chaves VAPID_*
npm install && npm run dev            # http://localhost:3333

# frontend
cd frontend && npm install && npm run dev   # http://localhost:5173 (proxy /api → :3333)

# testes do backend
cd backend && npm test
```

## Migrar hábitos do antigo projeto `done` (uma vez)

Copia `habits` + `habit_completions` do banco do `done` para o do RemindMe (idempotente, preserva UUIDs):

```bash
cd backend
DONE_DATABASE_URL="postgresql://user:senha@host:5432/done" \
DATABASE_URL="postgresql://user:senha@host:5432/remindme" \
node scripts/migrate-habits-from-done.mjs
```

## Ativar as notificações num aparelho

1. Gere o par VAPID uma única vez e coloque em `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`
   (mais `VAPID_SUBJECT=mailto:...`):

   ```bash
   npx web-push generate-vapid-keys
   ```

2. Abra o app pelo **HTTPS** (`https://${REMINDME_DOMAIN}`, pela VPN) e **instale na tela de início**.
3. Na página de Lembretes, toque em **Ativar** no banner de notificações e conceda a permissão.
4. Confira com `POST /api/push/test` — a notificação de teste deve aparecer com os dois botões.

> **Android**: libere o Chrome da otimização de bateria. Sem isso o FCM atrasa a entrega e os avisos
> de 15 em 15 min chegam fora de hora. Trocar as chaves VAPID invalida as inscrições existentes:
> é preciso reativar em cada aparelho.

## Produção (Docker)

O domínio é roteado pelo **proxy reverso central Caddy** (`caddy-docker-proxy`, stack `../media/proxy`), compartilhado por todos os projetos da VPS — não há um proxy próprio aqui. O `server` entra na rede `proxy-net` e declara labels `caddy`; o Caddy descobre o container e termina o TLS (ACME DNS-01 via Cloudflare). Por isso o `server` **não expõe porta no host**. Não há nginx: o próprio Express serve o SPA (build do frontend copiado para `backend/public` na imagem) e a API na porta 3333.

```bash
docker network create remindme-net      # uma vez (rede compartilhada da VPS)
docker network create proxy-net         # uma vez (compartilhada com o proxy central)
cp .env.example .env                     # preencha senha, VAPID_*, REMINDME_DOMAIN
docker compose up --build                # acesse https://${REMINDME_DOMAIN} pela VPN
```

Crie o registro DNS de `REMINDME_DOMAIN` no Cloudflare apontando para a VPN.

## Variáveis de ambiente

| Var | Onde | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | backend | conexão PostgreSQL (banco `remindme`) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | backend | par VAPID do Web Push (`npx web-push generate-vapid-keys`) |
| `VAPID_SUBJECT` | backend | contato exigido pelo VAPID (ex: `mailto:voce@exemplo.com`) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | compose | credenciais do container do banco |
| `REMINDME_DOMAIN` | compose | domínio servido pelo proxy Caddy (ex: `remind.gomeslab.tech`) |
