import { useMemo, useRef, useState } from "react";
import type { Habit } from "../../types/habit";
import { getToday, getTodayKey, isScheduledDay } from "../../utils/dateUtils";
import { moveRelativeTo } from "../../utils/reorder";
import { MOVE_THRESHOLD } from "../../hooks/useLongPress";
import { TodayHabitCard } from "../TodayHabitCard/TodayHabitCard";
import styles from "./TodayColumn.module.css";

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

  const startRef = useRef({ x: 0, y: 0 });
  const movedRef = useRef(false);
  const downOnCheckRef = useRef(false);
  const draggingRef = useRef(false);
  const draggingIdRef = useRef<string | null>(null);
  const dragOrderRef = useRef<string[] | null>(null);

  const entryById = new Map(entries.map((e) => [e.habit.id, e]));
  const visibleIds = entries.map((e) => e.habit.id);
  const renderIds = dragOrder ? dragOrder.filter((id) => visibleIds.includes(id)) : visibleIds;
  const canReorder = visibleIds.length > 1;

  const done = entries.filter((e) => e.completed).length;
  const dateLabel = dateFormatter.format(getToday()).replace("-feira", "");

  const resetDrag = () => {
    draggingRef.current = false;
    draggingIdRef.current = null;
    dragOrderRef.current = null;
    setDraggingId(null);
    setDragOrder(null);
  };

  const startDrag = (id: string, baseOrder: string[]) => {
    draggingRef.current = true;
    draggingIdRef.current = id;
    dragOrderRef.current = baseOrder;
    movedRef.current = true;
    setDraggingId(id);
    setDragOrder(baseOrder);

    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-drag-id]");
      const overId = el?.getAttribute("data-drag-id");
      if (!overId || overId === draggingIdRef.current) return;
      const rect = el!.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      const base = dragOrderRef.current ?? baseOrder;
      const next = moveRelativeTo(base, draggingIdRef.current!, overId, after);
      dragOrderRef.current = next;
      setDragOrder(next);
    };

    const blockScroll = (e: TouchEvent) => e.preventDefault();

    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      document.removeEventListener("touchmove", blockScroll);
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

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    document.addEventListener("touchmove", blockScroll, { passive: false });
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
                  if (draggingRef.current || movedRef.current) return;
                  onToggle(habit.id, todayKey, count >= target ? 0 : count + 1);
                }}
                onEdit={() => {
                  if (draggingRef.current || movedRef.current) return;
                  onEdit(habit);
                }}
                onPointerDown={(e) => {
                  movedRef.current = false;
                  draggingRef.current = false;
                  startRef.current = { x: e.clientX, y: e.clientY };
                  downOnCheckRef.current = Boolean(
                    (e.target as HTMLElement).closest("[data-role='habit-check']")
                  );
                }}
                onPointerMove={(e) => {
                  if (draggingRef.current) return;
                  if (
                    Math.abs(e.clientX - startRef.current.x) > MOVE_THRESHOLD ||
                    Math.abs(e.clientY - startRef.current.y) > MOVE_THRESHOLD
                  ) {
                    movedRef.current = true;
                    if (downOnCheckRef.current && canReorder) startDrag(habit.id, visibleIds);
                  }
                }}
                onPointerUp={() => undefined}
                onPointerCancel={() => undefined}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
