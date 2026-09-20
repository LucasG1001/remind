import { createElement, type PointerEvent as ReactPointerEvent } from "react";
import type { Habit } from "../../types/habit";
import { getIcon } from "../../utils/iconLibrary";
import { getLevelColor } from "../../utils/levelUtils";
import { streakLabel } from "../../utils/streakUtils";
import { LevelStrip } from "../LevelStrip/LevelStrip";
import styles from "./TodayHabitCard.module.css";

interface TodayHabitCardProps {
  habit: Habit;
  count: number;
  target: number;
  completed: boolean;
  dragging: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
}

export function TodayHabitCard({
  habit,
  count,
  target,
  completed,
  dragging,
  onToggle,
  onEdit,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: TodayHabitCardProps) {
  const caption =
    target > 1 && !completed ? `${count}/${target} hoje` : streakLabel(habit.currentStreak);

  return (
    <li
      data-drag-id={habit.id}
      className={`${styles.card} ${completed ? styles.done : ""} ${dragging ? styles.dragging : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Cobre o card inteiro por baixo do conteúdo; só o botão de check fica acima. */}
      <button
        type="button"
        className={styles.edit}
        aria-label={`Editar ${habit.name}`}
        onClick={onEdit}
      />

      <div className={styles.row}>
        <button
          type="button"
          data-role="habit-check"
          className={styles.check}
          aria-pressed={completed}
          aria-label={target > 1 ? `${habit.name} — ${count} de ${target}` : habit.name}
          onPointerUp={onToggle}
        >
          {createElement(getIcon(habit.icon), { className: styles.checkIcon })}
        </button>

        <span className={styles.text}>
          <span className={styles.name}>{habit.name}</span>
          <span className={styles.caption}>{caption}</span>
        </span>

        <span className={styles.level} style={{ color: getLevelColor(habit.level) }}>
          Nv {habit.level}
        </span>
      </div>

      <div className={styles.strip}>
        <LevelStrip level={habit.level} progress={habit.levelProgress} />
      </div>
    </li>
  );
}
