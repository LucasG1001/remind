import { useMemo, useRef, useState } from "react";
import type { Habit } from "../../types/habit";
import { getToday, getTodayKey, isScheduledDay } from "../../utils/dateUtils";
import { getHabitIcon } from "../../utils/habitIcons";
import { moveRelativeTo } from "../../utils/reorder";
import { LONG_PRESS_DRAG_MS, MOVE_THRESHOLD } from "../../hooks/useLongPress";
import { CheckMarkIcon } from "../Sidebar/Sidebar.icons";
import styles from "./TodayHabitList.module.css";

interface TodayHabitListProps {
  habits: Habit[];
  onToggle: (habitId: string, dateKey: string, nextCount: number) => void;
  onOpen: (habit: Habit) => void;
  onReorder: (orderedPendingIds: string[]) => void;
}

interface Entry {
  habit: Habit;
  count: number;
  target: number;
  completed: boolean;
}

const DONE_COLLAPSED_KEY = "habits-done-collapsed";
const MAX_DASHES = 8;

function readCollapsed(): boolean {
  return localStorage.getItem(DONE_COLLAPSED_KEY) === "true";
}

function streakLabel(habit: Habit): string {
  if (habit.currentStreak === 0) return `Nível ${habit.level} · sem sequência`;
  const unit = habit.currentStreak === 1 ? "dia seguido" : "dias seguidos";
  return `Nível ${habit.level} · ${habit.currentStreak} ${unit}`;
}

export function TodayHabitList({ habits, onToggle, onOpen, onReorder }: TodayHabitListProps) {
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

  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const movedRef = useRef(false);
  const draggingRef = useRef(false);
  const draggingIdRef = useRef<string | null>(null);
  const dragOrderRef = useRef<string[] | null>(null);

  const entryById = new Map(entries.map((e) => [e.habit.id, e]));
  const pendingIds = entries.filter((e) => !e.completed).map((e) => e.habit.id);
  const doneEntries = entries.filter((e) => e.completed);

  const renderIds = dragOrder
    ? dragOrder.filter((id) => pendingIds.includes(id))
    : pendingIds;
  const canReorder = pendingIds.length > 1;

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(DONE_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

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

    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
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
  };

  if (entries.length === 0) {
    return <p className={styles.empty}>Nenhum hábito agendado para hoje.</p>;
  }

  const renderRow = (entry: Entry, draggable: boolean) => {
    const { habit, count, target, completed } = entry;
    const Icon = getHabitIcon(habit.icon);
    const isDragging = draggingId === habit.id;
    const showDashes = !completed && target > 1 && target <= MAX_DASHES;

    return (
      <li
        key={habit.id}
        data-drag-id={draggable ? habit.id : undefined}
        className={`${styles.row} ${completed ? styles.rowDone : ""} ${
          isDragging ? styles.dragging : ""
        }`}
        onPointerDown={(e) => {
          clearTimer();
          movedRef.current = false;
          draggingRef.current = false;
          startRef.current = { x: e.clientX, y: e.clientY };
          if (draggable && canReorder) {
            const base = pendingIds;
            timerRef.current = setTimeout(() => startDrag(habit.id, base), LONG_PRESS_DRAG_MS);
          }
        }}
        onPointerMove={(e) => {
          if (draggingRef.current) return;
          if (
            Math.abs(e.clientX - startRef.current.x) > MOVE_THRESHOLD ||
            Math.abs(e.clientY - startRef.current.y) > MOVE_THRESHOLD
          ) {
            movedRef.current = true;
            clearTimer();
          }
        }}
        onPointerCancel={() => {
          if (draggingRef.current) return;
          clearTimer();
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <button
          type="button"
          className={styles.iconButton}
          aria-label={`Detalhes de ${habit.name}`}
          onClick={() => {
            if (draggingRef.current || movedRef.current) return;
            onOpen(habit);
          }}
        >
          <Icon className={styles.icon} />
        </button>

        <button
          type="button"
          className={styles.main}
          aria-pressed={completed}
          aria-label={
            target > 1 ? `${habit.name} — ${count} de ${target}` : habit.name
          }
          onPointerUp={() => {
            if (draggingRef.current) return;
            clearTimer();
            if (!movedRef.current) {
              onToggle(habit.id, todayKey, count >= target ? 0 : count + 1);
            }
            movedRef.current = false;
          }}
        >
          <span className={styles.text}>
            <span className={styles.name}>{habit.name}</span>
            {!completed && (
              <span className={styles.subtitle}>
                {showDashes && (
                  <span className={styles.dashes} aria-hidden="true">
                    {Array.from({ length: target }, (_, i) => (
                      <span
                        key={i}
                        className={`${styles.dash} ${i < count ? styles.dashFilled : ""}`}
                      />
                    ))}
                  </span>
                )}
                {target > 1 ? `${count} de ${target}` : streakLabel(habit)}
              </span>
            )}
          </span>

          <span className={styles.check} aria-hidden="true">
            {completed && <CheckMarkIcon className={styles.checkIcon} />}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className={styles.wrapper}>
      <ul className={styles.list}>
        {renderIds.map((id) => {
          const entry = entryById.get(id);
          return entry ? renderRow(entry, true) : null;
        })}
      </ul>

      {doneEntries.length > 0 && (
        <>
          <div className={styles.doneHeader}>
            <span className={styles.doneTitle}>Feitos · {doneEntries.length}</span>
            <button type="button" className={styles.doneToggle} onClick={toggleCollapsed}>
              {collapsed ? "mostrar" : "esconder"}
            </button>
          </div>
          {!collapsed && (
            <ul className={styles.list}>{doneEntries.map((entry) => renderRow(entry, false))}</ul>
          )}
        </>
      )}
    </div>
  );
}
