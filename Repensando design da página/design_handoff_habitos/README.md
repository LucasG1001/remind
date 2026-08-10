# Handoff: Redesenho da tela de Hábitos (RemindMe)

Repositório alvo: **LucasG1001/remind**, branch `main`, app em `frontend/` (React 19 + Vite + TypeScript, CSS Modules, sem libs de UI).

## Overview

A tela `/habitos` hoje tem três problemas:

1. Dois cards de estatística no topo consomem ~20% da altura útil.
2. A informação está **duplicada**: uma grade de quadrados com ícones (`TodayHabits`) para marcar e, abaixo, uma `Timeline` com os mesmos hábitos por nome. O usuário não sabe onde agir.
3. Hierarquia confusa: o que falta fazer não fica evidente.

O redesenho resolve os três: cabeçalho de uma faixa (barra de progresso + números), **uma única lista** que é ao mesmo tempo leitura e ação (um toque marca), e concluídos agrupados no fim em “Feitos”. A `CompletionGrid` existente é reaproveitada sem mudanças visuais.

Escopo: 3 telas — home de hábitos (**1a**), detalhe do hábito (**1d**), folha de criar/editar hábito (**1e**).

## About the Design Files

`design/Habitos - Redesign.dc.html` é uma **referência de design em HTML** — um protótipo que mostra aparência e comportamento pretendidos, **não código de produção para copiar**. Abra no navegador: as três telas aparecem lado a lado, em molduras de 390×844, com uma legenda explicando cada uma. `design/support.js` é apenas o runtime que renderiza esse arquivo. `design/tela-atual.jpeg` é a tela de hoje, para comparação.

A tarefa é **recriar esses designs dentro do ambiente já existente do repositório**: React + TypeScript, CSS Modules (`*.module.css`), variáveis do `frontend/src/styles/global.css`, ícones de `frontend/src/utils/habitIcons.tsx` e `frontend/src/components/Sidebar/Sidebar.icons.tsx`, hooks existentes (`useHabits`). Nenhuma dependência nova. Nada de estilo inline: o protótipo usa inline por ser HTML solto; no repo tudo vira classe em CSS Module com as variáveis (`var(--color-accent)`, `var(--radius-lg)`, `var(--spacing-*)`).

## Fidelity

**Alta fidelidade.** Cores, tipografia, espaçamentos e raios são finais e foram tirados do próprio `global.css`. Onde o protótipo tem um hex literal, use a variável equivalente (tabela em *Design Tokens*). Recriar fielmente, mas com as classes e padrões do repositório.

---

## Screens / Views

### 1a — Home de hábitos (`/habitos`)

**Purpose:** ver o que falta hoje e marcar com um toque.

**Layout** (coluna, largura total da página; no desktop mantém `max-width:960px` e `margin:0 auto` como hoje):

1. **Cabeçalho do dia** — `padding: var(--spacing-lg) var(--spacing-base) var(--spacing-base)`, `display:flex; flex-direction:column; gap:12px`, `border-bottom:1px solid #17172a` (≈ `--color-bg-hover`/`--color-border-subtle`).
   - Linha 1: título do dia à esquerda (“Hoje, 10 de agosto” — `date-fns`/`Intl` com locale pt-BR; 16px/600, `--color-text-primary`) e, à direita, sequência combinada: `FlameIcon` 15px + número, `--color-accent-light` (`#a78bfa`), 15px/700.
   - Linha 2: barra de progresso `flex:1; height:6px; border-radius:var(--radius-full); background:#1b1b2b` com preenchimento `width:<pct>%; background:var(--color-success)`; à direita o rótulo `2/12` — o `2` em 13px/700 `--color-text-primary`, o `/12` em `--color-text-tertiary` 600.
   - Linha 3: caption 12.5px `--color-text-secondary`: `“{pendentes} pendentes · recorde {longest} dias”`. Sem hábitos agendados: `“Nada agendado para hoje”`. Tudo feito: `“Tudo feito hoje! 🎉”` (mantém a string atual de `HabitsStats`).
   - **Remover** os cards de `HabitsStats` desta tela (o componente pode ser apagado ou reduzido a este cabeçalho — sugestão: renomear para `TodayHeader`).

2. **Lista de hoje** — `padding: 12px 14px 0`, `display:flex; flex-direction:column; gap:6px`. **Substitui tanto a grade de quadrados (`TodayHabits`) quanto a `Timeline` da página.** A `Timeline` continua existindo para `/lembretes`; só sai da HabitsPage.

   **Linha pendente** (`<button>`, alvo ≥ 68px de altura):
   - `display:flex; align-items:center; gap:14px; padding:12px; border-radius:var(--radius-lg) (14px→16px); background:#12121c` (≈ `--color-bg-secondary`).
   - Ícone: quadrado `44×44`, `border-radius:14px`, `background:var(--color-accent-subtle)`, glifo 22px `--color-accent-light`, `flex:none`. Ícone vem de `getHabitIcon(habit.icon)`.
   - Miolo (`flex:1; min-width:0`): nome 16px/600, `letter-spacing:-.01em`; subtítulo 12.5px `--color-text-secondary`.
     - `targetCount === 1` → subtítulo textual: `“Nível {level} · {currentStreak} dias seguidos”`; com streak 0: `“Nível {level} · sem sequência”`.
     - `targetCount > 1` → subtítulo com traços de progresso: N barrinhas `14×5`, `border-radius:3px`, feitas em `--color-accent`, restantes em `#26263c`, seguidas de `“{count} de {target}”`. Acima de 8 traços, caia para o formato textual `“{count} de {target}”`.
   - Direita: círculo vazio `32×32`, `border-radius:var(--radius-full)`, `border:1.5px solid #2f2f4a`, `flex:none`.

   **Cabeçalho “Feitos”** (só se houver concluídos): `padding:18px 12px 8px`, `display:flex; justify-content:space-between`; à esquerda `“Feitos · {n}”` 12px/600 uppercase `letter-spacing:.12em` cor `#4e4e63`; à direita ação de texto `“esconder”` (12px, mesma cor) que colapsa a seção — estado local, persistido em `localStorage`.

   **Linha concluída:** `background:#0e1216` (verde muito escuro), ícone em `var(--color-success-subtle)` com glifo `--color-success`, nome 16px/500 `#6f6f86` com `text-decoration:line-through`, e à direita círculo `32×32` preenchido `--color-success` com check `stroke-width:3` na cor `#06281e`.

3. **Barra inferior** — sem mudança: é a `mobileNav` do `Sidebar` (Lembretes, Hábitos, +, Projetos, Flashcards). O **FAB de calendário sobreposto à lista sai desta tela** (ele cobria a última linha); o calendário continua acessível pelo item da sidebar no desktop — no mobile, mova-o para um ícone na linha 1 do cabeçalho, à esquerda da chama.

**Vazio (0 hábitos):** manter o bloco `.empty` atual, sem alterações.

### 1d — Detalhe do hábito

**Purpose:** ver constância, completar o dia, editar/excluir. Hoje é o `SidePanel`; no mobile deve ser tela cheia (ou drawer 100%), no desktop pode continuar painel lateral.

**Layout** (coluna):

1. **Barra de ações** — `padding:12px 20px; display:flex; justify-content:space-between`: à esquerda `ChevronIcon` 22px (voltar/fechar) `--color-text-secondary`; à direita, gap 16px, ícone de editar (`edit`, 20px, `--color-text-secondary`) e `TrashIcon` 20px em `--color-error`.
2. **Identidade** — `padding:8px 22px 20px; gap:16px`: ícone `56×56`, `border-radius:18px`, `background:var(--color-accent-subtle)`, glifo 28px `#c4b5fd`; ao lado, nome 24px/700 `letter-spacing:-.02em; line-height:1.15` e caption 13px `--color-text-secondary`: `“{dias} · meta {target}×/dia”` (dias como “Todos os dias”, “Seg a Sex”, ou letras).
3. **Três números** — `display:flex; gap:10px`; cada card `flex:1; padding:14px; border-radius:16px; background:#12121c`: valor 22px/700 e rótulo 11.5px `#8686a0`.
   - `currentStreak` em `--color-accent-light` — “sequência atual”
   - `longestStreak` em `--color-text-primary` — “recorde”
   - taxa de 30 dias em `#4ade80` (`--level-2`) — “30 dias”
4. **Hoje** — cabeçalho `“Hoje”` (12px/600 uppercase `#4e4e63`) com `“{count} de {target}”` à direita; abaixo, `target` blocos `flex:1; height:44px; border-radius:12px`, feitos em `rgba(139,92,246,.9)`, restantes `background:#15152a; border:1px dashed #2f2f4a`. Tocar um bloco define a contagem (blocos são a forma de marcar/desmarcar). Com `target === 1`, um bloco só, largura total. Com `target > 10`, use o stepper `− n +` em vez dos blocos.
5. **Calendário** — **reutilizar `CompletionGrid` como está** (`components/CompletionGrid/`), com navegação de mês, letras `WEEKDAY_LETTERS`, células circulares e a legenda. Nenhuma mudança de CSS nele. No protótipo ele aparece redesenhado só para contexto: vale o componente real.
6. **Rodapé fixo** — `margin-top:auto; padding:18px 22px 26px; border-top:1px solid var(--color-border-subtle); background:#0c0c14`: botão `height:52px; border-radius:16px; background:var(--color-accent); color:var(--color-on-accent)`, 16px/600, com check 19px: `“Marcar +1 ({restantes} restantes)”`. Com `target === 1`: `“Marcar como feito”`. Já completo: `“Desmarcar”`, fundo transparente + `border:1px solid var(--color-border)`, texto `--color-text-secondary`.

### 1e — Criar / editar hábito

**Purpose:** criar hábito, e a **mesma folha** serve para editar. Substitui o `Modal`+`HabitForm` no mobile; no desktop pode continuar `Modal` centralizado com o mesmo conteúdo.

**Layout:** bottom sheet sobre overlay `rgba(0,0,0,.5)`; folha `background:var(--color-bg-drawer) (#0e0e16)`, cantos superiores 28px, `border-top:1px solid #262640`, `padding:20px 22px 26px`, `gap:22px`. “Puxador” `38×4`, `border-radius:full`, `#2a2a40`, centralizado.

- **Título** 20px/700 (`“Novo hábito”` / `“Editar hábito”`) e ícone de fechar 20px `--color-text-tertiary`. Em modo edição, o `TrashIcon` (`--color-error`) aparece à esquerda do fechar.
- **Nome** — rótulo 12px/600 uppercase `letter-spacing:.1em` `--color-text-tertiary`; campo `height:52px; border-radius:14px; background:#15152a; border:1px solid var(--color-border)`, `padding:0 16px`, 16px; foco → `border-color:var(--color-accent)`. `maxLength=60`, autofoco (comportamento atual).
- **Ícone** — grid `repeat(7,1fr)`, `gap:8px`, células `aspect-ratio:1; border-radius:12px; background:#15152a`, glifo 19px `#8b8ba4`. Selecionada: `background:var(--color-accent-subtle); border:1px solid var(--color-accent); color:#c4b5fd`. São 14 ícones: mostre 6 + célula `“+7”` que expande para todos (ou role horizontalmente) — a grade inteira aberta empurra o resto do formulário para fora da folha no mobile.
- **Dias** — rótulo `“Dias”` e, à direita, atalho `“Todos os dias”` (12.5px/600 `--color-accent-light`) que marca os 7. Sete chips `flex:1; height:44px; border-radius:12px`: inativo `background:#15152a; color:#8686a0` 13px/600; ativo `background:var(--color-accent); color:var(--color-on-accent)` 13px/700. Letras de `WEEKDAY_LETTERS` (D S T Q Q S S). Substitui o `DaySelector` atual (ou reestiliza-o).
- **Vezes por dia** — linha `space-between`: à esquerda label 15px/600 `“Vezes por dia”` + ajuda 12.5px `#6f6f86` `“quantas conclusões contam como feito”`; à direita stepper: dois botões `40×40; border-radius:12px; background:#15152a` (− em `#8686a0`, + em `#c4b5fd`) com o valor 18px/700 entre eles. Limites 1–50 (como hoje). Substitui o `<input type="number">`.
- **Ação** — botão largura total `height:52px; border-radius:16px; background:var(--color-accent)`, 16px/600: `“Criar hábito”` / `“Salvar”`. Desabilitado (`opacity:.4`) enquanto nome vazio ou nenhum dia marcado. Erro de dias e erro de API: manter as mensagens atuais em `--color-error`.

---

## Interactions & Behavior

- **Marcar (1a):** toque na linha → `setCompletion(habit.id, todayKey, next)`, com `next = count >= target ? 0 : count + 1` (regra atual de `TodayHabits`). Otimista: pinte a linha imediatamente e reverta no `catch` com `alertApiError`.
- **Ir ao detalhe:** o toque na linha marca — então abra o detalhe pelo **toque no ícone 44×44** à esquerda (ou long-press na linha, se preferir manter só um gesto). Documente na UI com nada: o ícone já é um alvo óbvio; só garanta `aria-label`.
- **Reordenar:** manter o long-press + drag existente (`useLongPress`, `LONG_PRESS_DRAG_MS`, `MOVE_THRESHOLD`, `moveRelativeTo`) — agora vertical: comparar `clientY` com o meio do retângulo (`rect.top + rect.height/2`) em vez de `clientX`. Linha arrastada: `opacity:.6` e `transform:scale(1.02)`.
- **Reordenação de linhas concluídas:** hábitos feitos vão para “Feitos” e **não** participam do drag.
- **Transição para “Feitos”:** ao marcar, a linha anima para a seção (200–250ms, `--transition-base`). Se preferir simples: `fadeIn`/`cardEnter` já existentes em `global.css`, sem reordenar antes do próximo render.
- **Detalhe:** tocar um bloco de meta define a contagem naquele valor; botão do rodapé faz `+1`. Excluir pede confirmação (padrão atual).
- **Folha 1e:** fecha por overlay, por “X” e por arrastar o puxador para baixo. Sem mudança nas rotas: `?novo=1` continua abrindo a criação.
- **Responsivo:** mesma lista de 360px a 768px; acima disso a página mantém `max-width:960px` e o detalhe volta a ser `SidePanel`.
- **Estados:** `“Carregando…”` e erro como hoje; lista vazia do dia → `“Nenhum hábito agendado para hoje.”`.
- **Toques:** nenhum alvo abaixo de 44px.

## State Management

Nada novo no servidor. Reaproveite `useHabits` (`habits`, `loading`, `error`, `createHabit`, `updateHabit`, `deleteHabit`, `reorderHabits`, `setCompletion`).

Local:
- `doneCollapsed: boolean` (seção “Feitos”), em `localStorage`.
- `selected: Habit | null` (detalhe), `editing: Habit | null` e `formMode` — como já existem em `HabitsPage`.
- `dragOrder`/`draggingId` — como em `TodayHabits`, adaptados para vertical.
- Derivados por render: `pendentes`, `feitos`, `progressPct`, `calculateCombinedStreak(habits)`.

## Design Tokens

Todos já existem em `frontend/src/styles/global.css` — use as variáveis:

| Uso | Valor | Variável |
| --- | --- | --- |
| Fundo da tela | `#0a0a0f` | `--color-bg-primary` |
| Fundo da linha | `#12121c` | ≈ `--color-bg-secondary` (`#12121a`) |
| Fundo da linha concluída | `#0e1216` | novo (verde escuríssimo) — ou `--color-success-subtle` sobre o fundo |
| Campo/chip inativo | `#15152a` | ≈ `--color-bg-tertiary` (`#1a1a28`) |
| Trilha de barra/progresso | `#1b1b2b` | ≈ `--color-bg-tertiary` |
| Borda de checkbox | `#2f2f4a` | ≈ `--color-border` (`#2a2a40`) |
| Texto primário | `#e8e8f0` | `--color-text-primary` |
| Texto secundário | `#9090a8` | `--color-text-secondary` |
| Texto terciário / labels | `#606078`, `#4e4e63` | `--color-text-tertiary` |
| Acento | `#8b5cf6` | `--color-accent` |
| Acento claro (streak, glifos) | `#a78bfa` / `#c4b5fd` | `--color-accent-light` |
| Acento sutil (fundo de ícone) | `rgba(139,92,246,.12)` | `--color-accent-subtle` |
| Sucesso (progresso, feito) | `#10b981` | `--color-success` |
| Taxa 30 dias | `#4ade80` | `--level-2` |
| Erro (excluir) | `#ef4444` | `--color-error` |
| Raios | 12 / 14 / 16 / 18 / 999px | `--radius-md/lg/xl/full` |
| Fonte | Inter 400–800 | `--font-family` |
| Transições | 150 / 250ms | `--transition-fast/base` |

Tipografia usada: 24/700 (título do detalhe), 22/700 (números), 20/700 (título da folha), 16/600 (nome do hábito, título do dia), 15/700 (streak), 13/700 (2/12), 12.5–13/400 (captions), 12/600 uppercase `.12em` (rótulos de seção), 11.5/400 (rótulos dos cards).

## Assets

Nenhum arquivo novo. Ícones de hábito: `frontend/src/utils/habitIcons.tsx` (`getHabitIcon`). Ícones de UI: `frontend/src/components/Sidebar/Sidebar.icons.tsx` (`FlameIcon`, `ChevronIcon`, `TrashIcon`, `PlusIcon`, `CheckIcon`, `BellIcon`, `BoardIcon`, `LayersIcon`, `CalendarIcon`). Todos `stroke` 1.6–1.8, `fill:none`, via `SvgIcon`.

## Arquivos do repositório afetados

| Arquivo | Ação |
| --- | --- |
| `frontend/src/pages/HabitsPage/HabitsPage.tsx` | remover `<Timeline>` e `buildOccurrences`; renderizar cabeçalho + `TodayHabitList` |
| `frontend/src/pages/HabitsPage/HabitsPage.module.css` | ajustar paddings; `.newButton` continua oculto no mobile |
| `frontend/src/components/TodayHabits/` | substituir a grade de quadrados pela lista (renomear para `TodayHabitList`); manter a lógica de drag, agora vertical |
| `frontend/src/components/HabitsStats/` | reduzir ao cabeçalho de uma faixa (`TodayHeader`) |
| `frontend/src/components/SidePanel/SidePanel.tsx` (+ CSS) | novo layout do detalhe; usar `CompletionGrid` |
| `frontend/src/components/HabitForm/` (+ `Modal`, `DaySelector`) | bottom sheet no mobile, chips de dias, stepper, grade de ícones colapsada |
| `frontend/src/components/CompletionGrid/` | **não mexer** |
| `frontend/src/components/Timeline/` | **não mexer** (segue em `/lembretes`) |
| `frontend/src/components/Sidebar/Sidebar.module.css` | remover/mover o `mobileCalendarFab` na rota de hábitos |

## Checklist de teste manual

- [ ] Marcar e desmarcar um hábito de `target 1`; a linha vai para “Feitos” e volta.
- [ ] Hábito com `target 5`: cinco toques enchem os traços; o sexto zera.
- [ ] Cabeçalho: barra, `2/12`, pendentes e recorde batem com os dados.
- [ ] Sequência combinada igual ao valor antigo de `HabitsStats`.
- [ ] Long-press + arrastar reordena e persiste (`reorderHabits`).
- [ ] Colapsar “Feitos” sobrevive a recarregar a página.
- [ ] Dia sem hábitos agendados → mensagem correta; 0 hábitos → estado vazio.
- [ ] Detalhe: blocos de meta, botão do rodapé, editar, excluir, `CompletionGrid` navegando meses.
- [ ] Criar hábito sem dias → erro; criar com “Todos os dias”; editar salva.
- [ ] 360px, 390px e desktop ≥768px sem sobreposição; nenhum alvo <44px.
- [ ] `npm run build` (tsc) sem erros e sem imports órfãos após remover a `Timeline` da página.

## Files

- `design/Habitos - Redesign.dc.html` — as três telas (1a, 1d, 1e). Abra no navegador.
- `design/support.js` — runtime necessário para o HTML acima.
- `design/tela-atual.jpeg` — tela em produção hoje, para comparação.
