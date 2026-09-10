import { useRef, useState } from "react";
import type { Habit } from "../../types/habit";
import type { HabitEntry } from "../../utils/agendaGrid";
import { habitState } from "../../utils/agendaGrid";
import { getHabitIcon } from "../../utils/habitIcons";
import { moveRelativeTo } from "../../utils/reorder";
import { LONG_PRESS_DRAG_MS, MOVE_THRESHOLD } from "../../hooks/useLongPress";
import { useDismiss } from "../../hooks/useDismiss";
import { CheckMarkIcon } from "../Sidebar/Sidebar.icons";
import styles from "./AnytimeTray.module.css";

interface AnytimeTrayProps {
  entries: HabitEntry[];
  onToggle: (entry: HabitEntry) => void;
  onOpen: (habit: Habit) => void;
  onReorder: (orderedIds: string[]) => void;
}

const OPEN_KEY = "habits-anytime-open";
const TargetIcon = getHabitIcon("target");
const CLOSE_DRAG_PX = 90;

function readOpen(): boolean {
  return localStorage.getItem(OPEN_KEY) === "true";
}

function metaLabel(entry: HabitEntry): string {
  const { habit, count, target, completed } = entry;
  if (target > 1 && !completed) return `${count} de ${target}`;
  if (habit.currentStreak === 0) return "sem sequência";
  return `${habit.currentStreak} ${habit.currentStreak === 1 ? "dia" : "dias"}`;
}

export function AnytimeTray({ entries, onToggle, onOpen, onReorder }: AnytimeTrayProps) {
  const [open, setOpen] = useState(readOpen);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const [dragY, setDragY] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const movedRef = useRef(false);
  const longPressRef = useRef(false);
  const downOnIconRef = useRef(false);
  const draggingRef = useRef(false);
  const draggingIdRef = useRef<string | null>(null);
  const dragOrderRef = useRef<string[] | null>(null);
  const sheetDragRef = useRef<number | null>(null);
  const dragYRef = useRef(0);

  const setOpenState = (next: boolean) => {
    setOpen(next);
    localStorage.setItem(OPEN_KEY, String(next));
  };

  const close = () => {
    setDragY(0);
    dragYRef.current = 0;
    setOpenState(false);
  };

  useDismiss(close, undefined, open);

  const pending = entries.filter((e) => !e.completed);
  const done = entries.filter((e) => e.completed);
  const pendingIds = pending.map((e) => e.habit.id);
  const canReorder = pendingIds.length > 1;

  const entryById = new Map(entries.map((e) => [e.habit.id, e]));
  const renderIds = dragOrder ? dragOrder.filter((id) => pendingIds.includes(id)) : pendingIds;

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

  const renderItem = (entry: HabitEntry, draggable: boolean) => {
    const { habit, count, target, completed } = entry;
    const Icon = getHabitIcon(habit.icon);

    return (
      <li
        key={habit.id}
        data-drag-id={draggable ? habit.id : undefined}
        data-state={habitState({ completed, endMin: null }, 0)}
        className={`${styles.item} ${draggingId === habit.id ? styles.dragging : ""}`}
        onPointerDown={(e) => {
          clearTimer();
          movedRef.current = false;
          longPressRef.current = false;
          draggingRef.current = false;
          startRef.current = { x: e.clientX, y: e.clientY };
          downOnIconRef.current = Boolean(
            (e.target as HTMLElement).closest("[data-role='habit-icon']")
          );
          if (!downOnIconRef.current) {
            timerRef.current = setTimeout(() => {
              longPressRef.current = true;
              onOpen(habit);
            }, LONG_PRESS_DRAG_MS);
          }
        }}
        onPointerMove={(e) => {
          if (draggingRef.current || e.buttons === 0) return;
          if (
            Math.abs(e.clientX - startRef.current.x) > MOVE_THRESHOLD ||
            Math.abs(e.clientY - startRef.current.y) > MOVE_THRESHOLD
          ) {
            movedRef.current = true;
            clearTimer();
            if (downOnIconRef.current && draggable && canReorder) {
              startDrag(habit.id, pendingIds);
            }
          }
        }}
        onPointerUp={() => {
          if (draggingRef.current) return;
          clearTimer();
        }}
        onPointerCancel={() => {
          if (draggingRef.current) return;
          clearTimer();
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <button
          type="button"
          data-role="habit-icon"
          className={styles.iconButton}
          aria-label={`Detalhes de ${habit.name}`}
          onClick={() => {
            if (draggingRef.current || movedRef.current) return;
            onOpen(habit);
          }}
        >
          <span className={styles.iconBox}>
            <Icon className={styles.icon} />
          </span>
        </button>

        <button
          type="button"
          className={styles.main}
          aria-pressed={completed}
          aria-label={target > 1 ? `${habit.name} — ${count} de ${target}` : habit.name}
          onPointerUp={() => {
            if (draggingRef.current) return;
            clearTimer();
            if (!movedRef.current && !longPressRef.current) onToggle(entry);
            movedRef.current = false;
          }}
        >
          <span className={styles.body}>
            <span className={styles.name}>{habit.name}</span>
            <span className={styles.meta}>{metaLabel(entry)}</span>
          </span>
          <span className={styles.check} aria-hidden="true">
            {completed && <CheckMarkIcon className={styles.checkIcon} />}
          </span>
        </button>
      </li>
    );
  };

  return (
    <aside
      className={styles.root}
      data-open={open}
      data-empty={entries.length === 0 || undefined}
    >
      <span className={styles.grabber} aria-hidden="true" />

      <button type="button" className={styles.strip} onClick={() => setOpenState(true)}>
        <span className={styles.stripIcon}>
          <TargetIcon className={styles.stripGlyph} />
        </span>
        <span className={styles.stripText}>
          <span className={styles.stripTitle}>
            A qualquer hora · {pending.length} pendentes
          </span>
          <span className={styles.stripPreview}>{pending.map((e) => e.habit.name).join(", ")}</span>
        </span>
        <span className={styles.stripAction}>abrir</span>
      </button>

      {open && <div className={styles.scrim} onPointerDown={close} aria-hidden="true" />}

      <div
        className={`${styles.sheet} ${dragY ? styles.sheetDragging : ""}`}
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
      >
        <span
          className={styles.sheetGrabber}
          aria-hidden="true"
          onPointerDown={(e) => {
            sheetDragRef.current = e.clientY;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (sheetDragRef.current === null) return;
            const next = Math.max(0, e.clientY - sheetDragRef.current);
            dragYRef.current = next;
            setDragY(next);
          }}
          onPointerUp={() => {
            sheetDragRef.current = null;
            if (dragYRef.current > CLOSE_DRAG_PX) close();
            else {
              dragYRef.current = 0;
              setDragY(0);
            }
          }}
          onPointerCancel={() => {
            sheetDragRef.current = null;
            dragYRef.current = 0;
            setDragY(0);
          }}
        />

        <div className={styles.sheetHeader}>
          <span className={styles.sheetTitle}>A qualquer hora · {entries.length}</span>
          <span className={styles.sheetDone}>{done.length} feito(s)</span>
          <button type="button" className={styles.sheetToggle} onClick={close}>
            recolher
          </button>
        </div>

        {entries.length === 0 ? (
          <p className={styles.sheetEmpty}>Nada sem horário</p>
        ) : (
          <ul className={styles.list}>
            {renderIds.map((id) => {
              const entry = entryById.get(id);
              return entry ? renderItem(entry, true) : null;
            })}
            {done.map((entry) => renderItem(entry, false))}
          </ul>
        )}
      </div>
    </aside>
  );
}
