import { createElement, useEffect, useMemo, useRef, useState } from "react";
import type { Habit } from "../../types/habit";
import { getToday, getTodayKey, isScheduledDay } from "../../utils/dateUtils";
import { moveRelativeTo } from "../../utils/reorder";
import { getIcon } from "../../utils/iconLibrary";
import { LONG_PRESS_DRAG_MS, MOVE_THRESHOLD } from "../../hooks/useLongPress";
import { TodayHabitCard } from "../TodayHabitCard/TodayHabitCard";
import styles from "./TodayColumn.module.css";

const EDGE_SCROLL_PX = 48;
const EDGE_SCROLL_STEP = 14;

const sameOrder = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/** O scroller varia: documento no mobile, a coluna "Hoje" no desktop. */
function findScroller(from: Element | null): Element {
  for (let el = from; el; el = el.parentElement) {
    const overflow = getComputedStyle(el).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && el.scrollHeight > el.clientHeight) {
      return el;
    }
  }
  return document.scrollingElement ?? document.documentElement;
}

interface TodayColumnProps {
  habits: Habit[];
  onToggle: (habitId: string, dateKey: string, nextCount: number) => void;
  onEdit: (habit: Habit) => void;
  onReorder: (orderedVisibleIds: string[]) => void;
}

interface Entry {
  habit: Habit;
  count: number;
  target: number;
  completed: boolean;
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function TodayColumn({ habits, onToggle, onEdit, onReorder }: TodayColumnProps) {
  const todayKey = getTodayKey();

  const entries = useMemo<Entry[]>(() => {
    const date = getToday();
    return habits
      .filter((habit) => isScheduledDay(date, habit.selectedDays))
      .map((habit) => {
        const completion = habit.completions.find((c) => c.date === todayKey);
        const target = Math.max(1, habit.targetCount);
        const count = Math.min(completion?.count ?? 0, target);
        return { habit, count, target, completed: count >= target };
      });
  }, [habits, todayKey]);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const [ghost, setGhost] = useState<{ habit: Habit; width: number } | null>(null);

  const startRef = useRef({ x: 0, y: 0 });
  const movedRef = useRef(false);
  const downOnCheckRef = useRef(false);
  const draggingRef = useRef(false);
  const draggingIdRef = useRef<string | null>(null);
  const dragOrderRef = useRef<string[] | null>(null);
  const pressTimerRef = useRef<number | null>(null);
  const ghostOffsetRef = useRef({ x: 0, y: 0 });
  const ghostElRef = useRef<HTMLDivElement | null>(null);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const scrollerRef = useRef<Element | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // A aba inativa é desmontada no mobile: sem isto, desmontar no meio de um arraste
  // vaza os listeners de janela, o rAF e o timer de toque longo (que chamaria
  // startDrag num componente já morto).
  useEffect(
    () => () => {
      if (pressTimerRef.current !== null) clearTimeout(pressTimerRef.current);
      cleanupRef.current?.();
    },
    []
  );

  const clearPress = () => {
    if (pressTimerRef.current !== null) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const entryById = new Map(entries.map((e) => [e.habit.id, e]));
  const visibleIds = entries.map((e) => e.habit.id);
  const renderIds = dragOrder ? dragOrder.filter((id) => visibleIds.includes(id)) : visibleIds;
  const canReorder = visibleIds.length > 1;

  const done = entries.filter((e) => e.completed).length;
  const dateLabel = dateFormatter.format(getToday()).replace("-feira", "");

  const resetDrag = () => {
    clearPress();
    draggingRef.current = false;
    draggingIdRef.current = null;
    dragOrderRef.current = null;
    scrollerRef.current = null;
    setDraggingId(null);
    setDragOrder(null);
    setGhost(null);
  };

  const startDrag = (id: string, baseOrder: string[]) => {
    const sourceEl = document.querySelector(`[data-drag-id="${id}"]`);
    const habit = entryById.get(id)?.habit;
    if (!sourceEl || !habit) return;

    const rect = sourceEl.getBoundingClientRect();
    const { x: px, y: py } = lastPointRef.current;
    ghostOffsetRef.current = { x: px - rect.left, y: py - rect.top };
    scrollerRef.current = findScroller(sourceEl);

    draggingRef.current = true;
    draggingIdRef.current = id;
    dragOrderRef.current = baseOrder;
    movedRef.current = true;
    setDraggingId(id);
    setDragOrder(baseOrder);
    setGhost({ habit, width: rect.width });

    const applyMove = (x: number, y: number) => {
      lastPointRef.current = { x, y };

      const ghostEl = ghostElRef.current;
      if (ghostEl) {
        const off = ghostOffsetRef.current;
        ghostEl.style.transform = `translate(${x - off.x}px, ${y - off.y}px)`;
      }

      const el = document.elementFromPoint(x, y)?.closest("[data-drag-id]");
      const overId = el?.getAttribute("data-drag-id");
      if (!overId || overId === draggingIdRef.current) return;
      const overRect = el!.getBoundingClientRect();
      const after = y > overRect.top + overRect.height / 2;
      const base = dragOrderRef.current ?? baseOrder;
      const next = moveRelativeTo(base, draggingIdRef.current!, overId, after);
      // Sem este portão a lista inteira re-renderiza a cada pixel de movimento.
      if (sameOrder(next, base)) return;
      dragOrderRef.current = next;
      setDragOrder(next);
    };

    const autoScrollAtEdges = () => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const { y } = lastPointRef.current;
      const isDoc = scroller === document.scrollingElement || scroller === document.documentElement;
      const rect = isDoc ? null : scroller.getBoundingClientRect();
      const top = rect ? rect.top : 0;
      const bottom = rect ? rect.bottom : window.innerHeight;
      if (y < top + EDGE_SCROLL_PX) scroller.scrollTop -= EDGE_SCROLL_STEP;
      else if (y > bottom - EDGE_SCROLL_PX) scroller.scrollTop += EDGE_SCROLL_STEP;
    };

    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      // pointerup perdido (foco da janela, modal nativo) não mantém arraste vivo.
      if (e.pointerType === "mouse" && e.buttons === 0) {
        onUp();
        return;
      }
      applyMove(e.clientX, e.clientY);
    };

    const blockScroll = (e: TouchEvent) => e.preventDefault();

    const cleanup = () => {
      cleanupRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      document.removeEventListener("touchmove", blockScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const onUp = () => {
      cleanup();
      const finalOrder = dragOrderRef.current;
      const changed = !!finalOrder && finalOrder.some((x, i) => x !== baseOrder[i]);
      resetDrag();
      if (changed && finalOrder) onReorder(finalOrder);
    };

    const onCancel = () => {
      cleanup();
      resetDrag();
    };

    // Autoterminável: se o arraste acabou, o loop morre mesmo que o cleanup
    // tenha perdido o id do rAF.
    const loop = () => {
      if (draggingIdRef.current !== id) {
        rafRef.current = null;
        return;
      }
      autoScrollAtEdges();
      rafRef.current = requestAnimationFrame(loop);
    };

    cleanupRef.current = cleanup;
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    document.addEventListener("touchmove", blockScroll, { passive: false });
    rafRef.current = requestAnimationFrame(loop);
  };

  return (
    <div className={styles.column}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <span className={styles.date}>{dateLabel}</span>
          <h1 className={styles.title}>Hoje</h1>
        </div>
        <p className={styles.counter}>
          <span className={styles.counterValue}>{done}</span>
          <span className={styles.counterTotal}>/ {entries.length} feitos</span>
        </p>
      </header>

      {entries.length === 0 ? (
        <p className={styles.empty}>Nenhum hábito agendado para hoje.</p>
      ) : (
        <ul className={styles.list}>
          {renderIds.map((id) => {
            const entry = entryById.get(id);
            if (!entry) return null;
            const { habit, count, target, completed } = entry;
            return (
              <TodayHabitCard
                key={habit.id}
                habit={habit}
                count={count}
                target={target}
                completed={completed}
                dragging={draggingId === habit.id}
                onToggle={() => {
                  if (draggingRef.current) return;
                  onToggle(habit.id, todayKey, count >= target ? 0 : count + 1);
                }}
                onUndo={() => {
                  if (draggingRef.current) return;
                  onToggle(habit.id, todayKey, Math.max(0, count - 1));
                }}
                onEdit={() => {
                  if (draggingRef.current || movedRef.current) return;
                  onEdit(habit);
                }}
                onPointerDown={(e) => {
                  // Arraste em curso: quem encerra é o pointerup dele. Zerar
                  // draggingRef aqui esqueceria o arraste sem limpar os listeners.
                  if (draggingRef.current) return;
                  movedRef.current = false;
                  startRef.current = { x: e.clientX, y: e.clientY };
                  // startDrag sai do timer de 400ms, sem evento em mãos: o ponto
                  // de pega do fantasma vem daqui.
                  lastPointRef.current = { x: e.clientX, y: e.clientY };
                  downOnCheckRef.current = Boolean(
                    (e.target as HTMLElement).closest("[data-role='habit-check']")
                  );
                  clearPress();
                  // O check recebe toque repetido (metas > 1): nunca inicia arraste.
                  if (downOnCheckRef.current || !canReorder) return;
                  if (e.pointerType === "touch") {
                    pressTimerRef.current = window.setTimeout(() => {
                      pressTimerRef.current = null;
                      startDrag(habit.id, visibleIds);
                    }, LONG_PRESS_DRAG_MS);
                  }
                }}
                onPointerMove={(e) => {
                  if (draggingRef.current) return;
                  // Sem botão pressionado não há gesto: é só o cursor passeando.
                  // Sem isto o arraste renasce a cada mousemove depois de soltar.
                  if (e.buttons === 0) return;
                  if (
                    Math.abs(e.clientX - startRef.current.x) > MOVE_THRESHOLD ||
                    Math.abs(e.clientY - startRef.current.y) > MOVE_THRESHOLD
                  ) {
                    movedRef.current = true;
                    // Dedo que anda antes do tempo é rolagem; no mouse, arrastar é intencional.
                    clearPress();
                    if (!downOnCheckRef.current && canReorder && e.pointerType !== "touch") {
                      startDrag(habit.id, visibleIds);
                    }
                  }
                }}
                onPointerUp={clearPress}
                onPointerCancel={clearPress}
              />
            );
          })}
        </ul>
      )}

      {ghost && (
        <div
          // O transform inicial aqui evita um quadro pintado no canto da viewport.
          ref={(el) => {
            ghostElRef.current = el;
            if (!el) return;
            const { x, y } = lastPointRef.current;
            const off = ghostOffsetRef.current;
            el.style.transform = `translate(${x - off.x}px, ${y - off.y}px)`;
          }}
          className={styles.ghost}
          style={{ width: ghost.width }}
          aria-hidden="true"
        >
          {createElement(getIcon(ghost.habit.icon), { className: styles.ghostIcon })}
          <span className={styles.ghostName}>{ghost.habit.name}</span>
        </div>
      )}
    </div>
  );
}
