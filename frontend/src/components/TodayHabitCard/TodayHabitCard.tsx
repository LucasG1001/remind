import { createElement, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { Habit } from "../../types/habit";
import { getIcon } from "../../utils/iconLibrary";
import { getLevelColor } from "../../utils/levelUtils";
import { LevelStrip } from "../LevelStrip/LevelStrip";
import styles from "./TodayHabitCard.module.css";

// Acima disto a fileira deixa de ler como checks discretos (a meta vai até 50).
const MAX_SEGMENTS = 12;

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
  const partial = count > 0 && !completed;

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
          className={`${styles.check} ${partial ? styles.checkPartial : ""}`}
          aria-pressed={completed}
          aria-label={target > 1 ? `${habit.name} — ${count} de ${target}` : habit.name}
          onPointerUp={onToggle}
        >
          {createElement(getIcon(habit.icon), { className: styles.checkIcon })}
        </button>

        <span className={styles.text}>
          <span className={styles.name}>{habit.name}</span>
          {/* O aria-label do botão já anuncia "N de M": a faixa é só visual. */}
          {target > 1 && (
            <span className={styles.caption}>
              {target <= MAX_SEGMENTS ? (
                <span
                  className={styles.dayStrip}
                  style={{ "--checks": target } as CSSProperties}
                  aria-hidden="true"
                >
                  {Array.from({ length: target }, (_, i) => (
                    <span
                      key={i}
                      className={`${styles.dayCell} ${
                        i < count ? styles.dayFilled : i === count ? styles.dayNext : ""
                      }`}
                    />
                  ))}
                </span>
              ) : (
                <span className={styles.dayBar} aria-hidden="true">
                  <span
                    className={styles.dayBarFill}
                    style={{ width: `${(count / target) * 100}%` }}
                  />
                </span>
              )}
            </span>
          )}
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
