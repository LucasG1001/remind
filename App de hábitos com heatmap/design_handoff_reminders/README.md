# Handoff — Tela de Lembretes (redesign)

Pacote para o Claude Code implementar o redesign da tela de Lembretes no repo
`LucasG1001/remind`, branch `main`, escopo `frontend/src`.

Fonte do design: `Lembretes - Variações.dc.html` (opção **1a** = desktop, **1b** = mobile).
Prints: `screens/01-desktop.png`, `screens/02-mobile.png`.

Tudo aqui é descrito em **tokens existentes** de `frontend/src/styles/global.css`.
Não introduzir hex novo: onde o mock tem um hex, a tabela abaixo dá o token equivalente.

---

## 1. O que muda, em uma frase

A lista deixa de ser uma timeline esticada de 1600px com um cabeçalho "Hoje" por item,
e passa a ser: **três grupos semânticos (Atrasados / Hoje / Próximos dias)** numa coluna
de largura fixa, com **dia da semana + data** em cada linha, **ações inline**, e um
**painel lateral** (só desktop) com mini-calendário e próximos feriados.

---

## 2. Bugs de dados a corrigir primeiro

### 2.1 "Hoje" repetido (bug real, visível no print do usuário)

`utils/agenda.ts` → `dayLabel()`:

```ts
const diff = diffDaysFromToday(when, Date.now());
if (diff <= 0) return "Hoje";     // ← todo item atrasado vira um grupo chamado "Hoje"
```

`groupByDay()` agrupa por `spDateKey`, então 4 atrasados em 4 datas distintas geram
4 grupos — e `diff <= 0` rotula todos como "Hoje".

**Correção:** separar os atrasados **antes** de agrupar, e rotular grupos passados pela
data real. Sugestão de assinatura nova em `agenda.ts`:

```ts
export function splitOverdue(items: TimelineItem[], nowMs: number) {
  const overdue: TimelineItem[] = [];
  const upcoming: TimelineItem[] = [];
  for (const item of items) {
    (diffDaysFromToday(item.when, nowMs) < 0 ? overdue : upcoming).push(item);
  }
  return { overdue, upcoming };   // overdue: um único grupo "Atrasados", sem groupByDay
}
```

e em `dayLabel()` trocar `diff <= 0` por `diff === 0`.

### 2.2 Texto de atraso preciso demais

`utils/format.ts` → `remainingLabel()` produz `"atrasado 58 dias 22 horas 19 minutos"`.
Na lista isso ocupa a linha inteira e, repetido 4×, vira ruído.

**Adicionar** (manter `remainingLabel` como está para o `ReminderActionsSheet`, onde a
precisão é útil):

```ts
/** Rótulo curto de atraso para a lista: "há 2 meses", "há 27 dias", "há 3 horas". */
export function shortOverdueLabel(targetMs: number, nowMs: number): string {
  const days = -diffDaysFromToday(targetMs, nowMs);
  if (days >= 60) return `há ${Math.floor(days / 30)} meses`;
  if (days >= 30) return "há 1 mês";
  if (days >= 1) return `há ${days} ${days === 1 ? "dia" : "dias"}`;
  const hours = Math.floor((nowMs - targetMs) / 3_600_000);
  if (hours >= 1) return `há ${hours} ${hours === 1 ? "hora" : "horas"}`;
  return "atrasado";
}
```

Subtítulo da linha atrasada = `` `${hora} · ${shortOverdueLabel(...)}` `` no mobile, e
`` `${shortOverdueLabel(...)} · ${recurrenceLabel(r)}` `` no desktop.

### 2.3 Recorrência em voz ativa

`recurrenceLabel()` retorna `"A cada semana, domingo"`. O mock usa **"Toda semana, domingo"**,
**"Todo mês, segunda"**, **"Todo ano"**, **"Todos os dias"**, **"A cada 3 dias"**.
Regra: intervalo 1 → `Toda semana` / `Todo mês` / `Todo ano` / `Todos os dias`;
intervalo > 1 → mantém `A cada N dias|semanas|meses|anos`. Sufixo de weekday inalterado.

---

## 3. Mapa de cores (mock → token)

Nenhum hex do mock entra no código. Equivalências:

| Hex no mock | Token a usar | Onde |
| --- | --- | --- |
| `#161826` | `--color-bg` | fundo da página |
| `#1c1e2c` | `--color-bg-secondary` | fundo de linha/card de item |
| `#232532` | `--color-surface` | divisórias/tag de recorrência |
| `#292b31` | `--color-border-subtle` | contorno 1px (`--shadow-sm`) |
| `#e9e9ed` | `--color-text-primary` | título do item, número do dia |
| `#b2b6ca` | `--color-text-secondary` | hora, dia da semana, metadados, contagens |
| `#5c5f70` | `--color-neutral-700` | dias passados do mini-calendário |
| `#9184d9` | `--color-accent` | hoje no calendário, borda dos botões primários |
| `#d2cefd` | `--color-accent-300` | texto sobre outline de accent, links |
| `#b5abfc` | `--color-accent-400` | dia da semana de "hoje", números em destaque |
| `#22203a` | `--color-accent-tint` sobre `--color-bg` | célula "hoje" da faixa semanal |
| `#c99aa4` / `#e6b9c2` | `--color-error` / `--color-error-hover` | texto de atraso, rótulo "Atrasados" |
| `#a8566a` | `--color-error-outline` | barra de 2px na borda esquerda do item atrasado |
| `#2a1c22` / `#22161c` | `--color-error-bg-faint` | fundo do item em swipe aberto |
| `#3a2730` | `--color-error-border` | contorno do badge "4 atrasados" |

`--color-error` já é `--color-warn` = `oklch(0.68 0.13 12)`. **Não criar role novo.**

Espaçamentos do mock são a escala Nocturne 0.7× (5.6 / 8.4 / 11.2 / 16.8 / 22.4 / 33.6);
no código use os tokens mais próximos: `--spacing-xs` (4) · `--spacing-sm` (8) ·
`--spacing-md` (12) · `--spacing-base` (16) · `--spacing-xl` (24) · `--spacing-2xl` (32).
Raios: 8px = `--radius-md`; pílula = `--radius-full`.
Tamanhos de fonte: 14.5→`--font-size-md`, 13→`--font-size-base`, 12→`--font-size-sm`,
11/10.5→`--font-size-xs`, 22→`--font-size-xl`.

---

## 4. Desktop (1a) — `screens/01-desktop.png`

Arquivos: `pages/RemindersPage/RemindersPage.tsx` + `.module.css`,
`components/Timeline/Timeline.tsx` + `.module.css`.

### 4.1 Grid da página

```
.page   → display: grid; grid-template-columns: minmax(0,1fr) 320px;
          (o rail só existe acima de 1024px; abaixo disso, 1 coluna)
.list   → max-width: 660px;  (a lista NÃO acompanha a largura da janela)
.rail   → border-left: 1px solid var(--color-border-subtle);
          padding: var(--spacing-2xl) var(--spacing-xl);
```

Barra superior: 34px de altura nos controles, `padding: var(--spacing-md) var(--spacing-xl)`,
`border-bottom: 1px solid var(--color-border-subtle)`. Contém, à esquerda, o botão de sino
(34×34, fundo `--color-accent-tint`, ícone `--color-accent-300`) e o seletor de seção com o
badge de atrasados; à direita, ícone de calendário e o botão **Novo** (outline de accent —
o sistema não usa botão preenchido).

### 4.2 Linha da lista (substitui `.item` do Timeline)

Grid atual: `24px 96px 1fr auto`. Novo grid:

```
grid-template-columns: 62px minmax(0,1fr) auto;
gap: 14px;
padding: var(--spacing-md);
```

- **Coluna 1 (62px)** — duas linhas empilhadas:
  - dia da semana + data, `--font-size-xs`, `font-weight: 500`, `letter-spacing: .08em`,
    `text-transform: uppercase`, ex. `dom 19/7`
    (`WEEKDAY_ABBR_PT[d.getDay()].toLowerCase()` + `d/M`);
    cor `--color-error` se atrasado, `--color-accent-400` se hoje, senão `--color-text-secondary`.
  - hora `--font-size-base`, `--color-text-secondary`, `font-variant-numeric: tabular-nums`;
    item de dia inteiro mostra **"dia todo"**.
- **Coluna 2** — título `--font-size-md` peso 500; abaixo, meta `--font-size-sm`
  (`--color-error` quando atrasado, senão `--color-text-secondary`).
- **Coluna 3** — ações: **Adiar** (ghost: `box-shadow: 0 0 0 1px var(--color-border-subtle)`)
  e **Concluir** (outline de accent). Altura 28px, raio 6px, `--font-size-sm`.
  Nos itens de "Próximos dias" não há ações.
- O ícone de sino sai da linha (era redundante em uma tela que só tem lembretes).
- Item atrasado ganha `border-left: 2px solid var(--color-error-outline)` e
  `border-radius: 0 8px 8px 0`; o primeiro da lista tem fundo `--color-bg-secondary`.
- Separador entre linhas: `1px` de `--color-surface`, com `margin-left: var(--spacing-md)`.

### 4.3 Cabeçalhos de grupo

`--font-size-xs`, peso 500, `letter-spacing: .12em`, uppercase, `--color-text-secondary`.
Três grupos, nesta ordem:

1. **Atrasados** — ponto de 5px `--color-error` antes do rótulo, rótulo em `--color-error-hover`,
   contagem ao lado em `--color-text-secondary`.
2. **Hoje** — seguido, em texto normal, da data por extra­nso: `domingo, 20 de setembro`.
3. **Próximos dias** — sem subcabeçalho por dia (a coluna de data já resolve).

### 4.4 Rail direito

**Mini-calendário do mês** — reaproveitar `components/ReminderCalendar` em modo compacto
(célula 28px, `--font-size-sm`, raio 6px). Estados:
hoje → fundo `--color-accent` + texto `--color-on-accent`;
dia com lembrete futuro → fundo `--color-surface`, texto `--color-accent-300`;
dia com lembrete passado → tinta de erro (`--color-error-bg-faint` + `--color-error`);
dia vazio passado → `--color-neutral-700`. Cabeçalho: mês/ano + setas.

**Próximos feriados** — lista de 5, alimentada por `utils/holidays.ts`:

```ts
const year = getToday().getFullYear();
const upcoming = [...getHolidays(year), ...getHolidays(year + 1)]
  .filter(h => h.dateKey >= getTodayKey())
  .slice(0, 5);
```

Cada linha: coluna de 44px com `dow` (`--font-size-xs`, uppercase) + `d/M`
(`--font-size-base`, `--color-text-primary`), nome do feriado `--font-size-base` flexível,
e contagem `"N dias"` à direita em `--font-size-xs` / `--color-text-secondary`
(`diffDaysFromToday(parseDate(h.dateKey).getTime(), Date.now())`).
Separador de 1px `--color-surface` entre linhas.
Feriado que cai em sexta ou segunda (feriadão) tem o `dow` em `--color-accent-400`.
`getHolidays` já retorna estaduais e municipais de Indaiatuba — o mock mostra só nacionais;
decidir se filtra por `type === "nacional"` ou mostra todos (recomendo mostrar todos, o
`type` pode virar um sufixo discreto).

### 4.5 PushBanner

O `<PushBanner />` sai do corpo da página (ocupava a largura toda e competia com a lista).
Ele **não** foi reposicionado no design — decidir com o time: sugestão é virar um item no
menu do sino da barra superior, mantendo o componente e o hook intactos.

---

## 5. Mobile (1b) — `screens/02-mobile.png`

Breakpoint `max-width: 768px`. O rail não existe; **não há bloco de feriados no mobile**.

Ordem vertical, `gap: var(--spacing-base)`, `padding: var(--spacing-base)`:

1. **Cabeçalho** — "Lembretes" `--font-size-xl` peso 500; abaixo,
   `"4 atrasados · 2 para hoje"` em `--font-size-sm` / `--color-error`.
   À direita, dois alvos de 44×44: calendário (ghost) e **+** (outline de accent).
2. **Faixa da semana** — 7 colunas iguais (`display:grid; grid-template-columns:repeat(7,1fr); gap:4px`).
   Cada célula: `dow` 10px uppercase, número 15px peso 500, e um ponto de 4px
   (`--color-accent` se for hoje, `--color-neutral-800` se houver lembrete, transparente se vazio).
   Célula de hoje: fundo `--color-accent-tint` + contorno 1px `--color-accent-line`, raio 8px.
   **Atenção:** `dateUtils.startOfWeek()` começa na **segunda**; o mock mostra os 7 dias a
   partir de hoje. Usar `Array.from({length:7}, (_,i) => addDays(getToday(), i))` evita o
   conflito e mantém "hoje" sempre na primeira coluna.
3. **Atrasados** — mesmo cabeçalho de grupo do desktop. Linhas: `min-height: 56px`,
   `border-radius: var(--radius-md)`, fundo `--color-bg-secondary`,
   `border-left: 2px solid var(--color-error-outline)`, `gap: var(--spacing-md)`.
   Colunas: data (52px, `dow` + `d/M`) · título + `"13:52 · há 2 meses"` · círculo de check
   de 24px (`box-shadow: 0 0 0 1.5px var(--color-accent-700)`).
4. **Swipe** — o último item do print está com o swipe aberto: fundo muda para
   `--color-error-bg-faint` e aparecem dois ícones de 18px em `--color-accent-300`
   (relógio = adiar, check = concluir). Gesto: arrastar à esquerda revela as ações;
   `useLongPress` continua valendo para abrir o `ReminderActionsSheet`.
   Legenda abaixo do grupo: **"Arraste um item para adiar ou concluir"**, `--font-size-xs`.
5. **Hoje** — mesmas linhas, sem a barra vermelha; `dow` em `--color-accent-400`;
   coluna de data mostra `dow` + **hora** (não a data, já que é hoje).
6. **Próximos dias** — sem círculo de check; meta traz `"21/9 · toda semana"`.

Alvos de toque: nada abaixo de 44px; linhas de lista com 56px.

---

## 6. Strings literais (pt-BR, copiar exatamente)

```
Lembretes
Atrasados
Hoje
Próximos dias
Novo            (desktop)          Novo lembrete   (vazio/mobile FAB)
Adiar
Concluir
dia todo
domingo, 20 de setembro            ← data por extenso do grupo "Hoje"
4 atrasados · 2 para hoje          ← subtítulo do cabeçalho mobile
Arraste um item para adiar ou concluir
Próximos feriados
Ver todos
há 2 meses / há 27 dias / há 13 dias
Toda semana, domingo / Todo mês, segunda / Todo ano / Todos os dias / A cada 3 dias
```

---

## 7. Checklist de implementação

- [ ] `agenda.ts`: `splitOverdue()` + `dayLabel()` com `diff === 0`
- [ ] `format.ts`: `shortOverdueLabel()` + recorrência em voz ativa
- [ ] `Timeline.module.css`: grid `62px minmax(0,1fr) auto`, coluna de data/hora, borda de atraso
- [ ] `Timeline.tsx`: props de ações inline (`onSnooze`, `onComplete`) e supressão do ícone
- [ ] `RemindersPage.tsx`: três grupos, largura máx. 660px, rail de 320px em ≥1024px
- [ ] Rail: `ReminderCalendar` compacto + lista de feriados de `holidays.ts`
- [ ] Mobile: faixa da semana, linhas de 56px, swipe de adiar/concluir
- [ ] `PushBanner` removido do corpo — definir novo lugar
- [ ] Verificar contraste: todo texto de apoio em `--color-text-secondary` (≈7.6:1),
      `--color-text-tertiary` só para estados desabilitados
