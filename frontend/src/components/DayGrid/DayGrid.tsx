import { useLayoutEffect, useRef } from "react";
import type { Habit } from "../../types/habit";
import type { AgendaLayout, HabitEntry } from "../../utils/agendaGrid";
import {
  COLUMN_GAP,
  END_HOUR,
  MIN_BLOCK_MINUTES,
  PX_PER_HOUR,
  formatDuration,
  formatMinutes,
  formatRange,
  habitState,
  hourTop,
} from "../../utils/agendaGrid";
import { floorToQuarter } from "../../utils/timeWindow";
import { getIcon } from "../../utils/iconLibrary";
import { LONG_PRESS_DRAG_MS, MOVE_THRESHOLD } from "../../hooks/useLongPress";
import { CheckMarkIcon } from "../Sidebar/Sidebar.icons";
import styles from "./DayGrid.module.css";

interface DayGridProps {
  layout: AgendaLayout;
  nowMinutes: number;
  onToggle: (entry: HabitEntry) => void;
  onOpen: (habit: Habit) => void;
  onCreateAt: (startTime: string) => void;
}

const SCROLL_LEAD_MINUTES = 30;
const HIT_EXPAND_MAX = 9;

export function DayGrid({ layout, nowMinutes, onToggle, onOpen, onCreateAt }: DayGridProps) {
  const { blocks, startHour, hours, height } = layout;

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const didScrollRef = useRef(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const movedRef = useRef(false);
  const longPressRef = useRef(false);
  const emptyStartRef = useRef<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    if (didScrollRef.current) return;
    const scroller = scrollerRef.current;
    if (!scroller || blocks.length === 0) return;
    didScrollRef.current = true;
    const target = hourTop(nowMinutes - SCROLL_LEAD_MINUTES, startHour);
    scroller.scrollTop = Math.max(0, target);
  }, [blocks.length, nowMinutes, startHour]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const nowVisible = nowMinutes >= startHour * 60 && nowMinutes < END_HOUR * 60;

  if (blocks.length === 0) {
    return (
      <div className={styles.scroller}>
        <p className={styles.emptyGrid}>Nenhum hábito com horário hoje</p>
      </div>
    );
  }

  return (
    <div className={styles.scroller} ref={scrollerRef}>
      <div
        className={styles.grid}
        style={{ height, ["--px-per-hour" as string]: `${PX_PER_HOUR}px` }}
      >
        {Array.from({ length: hours }, (_, i) => (
          <div key={startHour + i} className={styles.hour}>
            <span className={styles.hourLabel}>
              {String(startHour + i).padStart(2, "0")}:00
            </span>
          </div>
        ))}

        <ul
          className={styles.layer}
          onPointerDown={(e) => {
            emptyStartRef.current =
              e.target === e.currentTarget ? { x: e.clientX, y: e.clientY } : null;
          }}
          onClick={(e) => {
            if (e.target !== e.currentTarget) return;
            const down = emptyStartRef.current;
            emptyStartRef.current = null;
            if (
              down &&
              (Math.abs(e.clientX - down.x) > MOVE_THRESHOLD ||
                Math.abs(e.clientY - down.y) > MOVE_THRESHOLD)
            ) {
              return;
            }
            const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
            const raw = startHour * 60 + (y / PX_PER_HOUR) * 60;
            const clamped = Math.min(
              Math.max(raw, startHour * 60),
              END_HOUR * 60 - MIN_BLOCK_MINUTES
            );
            const slot = floorToQuarter(formatMinutes(Math.floor(clamped)));
            if (slot) onCreateAt(slot);
          }}
        >
          {blocks.map((block) => {
            const { entry } = block;
            const { habit, count, target, completed } = entry;
            const Icon = getIcon(habit.icon);
            const state = habitState({ completed, endMin: block.endMin }, nowMinutes);
            const range = formatRange(block.startMin, block.minutes);
            const short = block.height < 44;
            const narrow = block.columns > 1;

            return (
              <li
                key={habit.id}
                className={styles.block}
                data-state={state}
                data-short={short || undefined}
                data-narrow={narrow || undefined}
                style={{
                  top: block.top,
                  height: block.height,
                  left: `${(block.column / block.columns) * 100}%`,
                  width: `calc(${100 / block.columns}% - ${COLUMN_GAP}px)`,
                  ["--hit-bottom" as string]: `${Math.min(
                    HIT_EXPAND_MAX,
                    Math.max(0, block.spaceBelow - 1)
                  )}px`,
                }}
                onPointerDown={(e) => {
                  clearTimer();
                  movedRef.current = false;
                  longPressRef.current = false;
                  startRef.current = { x: e.clientX, y: e.clientY };
                  if (!(e.target as HTMLElement).closest("[data-role='habit-icon']")) {
                    timerRef.current = setTimeout(() => {
                      longPressRef.current = true;
                      onOpen(habit);
                    }, LONG_PRESS_DRAG_MS);
                  }
                }}
                onPointerMove={(e) => {
                  if (e.buttons === 0) return;
                  if (
                    Math.abs(e.clientX - startRef.current.x) > MOVE_THRESHOLD ||
                    Math.abs(e.clientY - startRef.current.y) > MOVE_THRESHOLD
                  ) {
                    movedRef.current = true;
                    clearTimer();
                  }
                }}
                onPointerUp={clearTimer}
                onPointerCancel={clearTimer}
                onContextMenu={(e) => e.preventDefault()}
              >
                <button
                  type="button"
                  data-role="habit-icon"
                  className={styles.iconButton}
                  aria-label={`Detalhes de ${habit.name}`}
                  onClick={() => {
                    if (movedRef.current) return;
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
                  aria-label={
                    target > 1
                      ? `${habit.name} — ${range} — ${count} de ${target}`
                      : `${habit.name} — ${range}`
                  }
                  onPointerUp={() => {
                    clearTimer();
                    if (!movedRef.current && !longPressRef.current) onToggle(entry);
                    movedRef.current = false;
                  }}
                >
                  <span className={styles.body}>
                    <span className={styles.name}>{habit.name}</span>
                    {block.tall && !narrow && (
                      <span className={styles.meta}>
                        {range} · {formatDuration(block.minutes)}
                        <span className={styles.metaLevel}> · Nv {habit.level}</span>
                      </span>
                    )}
                  </span>
                  <span className={styles.time}>{range}</span>
                  <span className={styles.check} aria-hidden="true">
                    {completed && <CheckMarkIcon className={styles.checkIcon} />}
                  </span>
                </button>
              </li>
            );
          })}

          {nowVisible && (
            <div
              className={styles.now}
              style={{ top: hourTop(nowMinutes, startHour) }}
              aria-hidden="true"
            >
              <span className={styles.nowLabel}>{formatMinutes(nowMinutes)}</span>
              <span className={styles.nowDot} />
              <span className={styles.nowLine} />
            </div>
          )}
        </ul>
      </div>
    </div>
  );
}
