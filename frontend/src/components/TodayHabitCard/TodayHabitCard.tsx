import {
  createElement,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Habit } from "../../types/habit";
import { getIcon } from "../../utils/iconLibrary";
import { BellIcon, BellOffIcon, MinusIcon } from "../Icon/icons";
import { getLevelColor } from "../../utils/levelUtils";
import { LevelStrip } from "../LevelStrip/LevelStrip";
import styles from "./TodayHabitCard.module.css";

// Acima disto a fileira deixa de ler como checks discretos (a meta vai até 50).
const MAX_SEGMENTS = 12;

/**
 * Os botões de check respondem a `pointerup` (o toque repetido de metas > 1 não
 * pode virar arraste). Teclado e tecnologia assistiva não disparam `pointerup`,
 * só `click`, e com `detail === 0` — é por onde eles entram, sem duplicar o toque.
 */
function keyboardOnly(handler: () => void) {
  return (event: ReactMouseEvent) => {
    if (event.detail === 0) handler();
  };
}

interface TodayHabitCardProps {
  habit: Habit;
  count: number;
  target: number;
  completed: boolean;
  dragging: boolean;
  /** Horário pendente de hoje; null quando não há aviso a desligar. */
  nextReminderTime: string | null;
  nextReminderSkipped: boolean;
  onToggle: () => void;
  onUndo: () => void;
  onSkipReminder: () => void;
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
  nextReminderTime,
  nextReminderSkipped,
  onToggle,
  onUndo,
  onSkipReminder,
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
          onClick={keyboardOnly(onToggle)}
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

        {count > 0 && (
          <button
            type="button"
            data-role="habit-check"
            className={styles.sideButton}
            aria-label={`Voltar um check de ${habit.name}`}
            onPointerUp={onUndo}
            onClick={keyboardOnly(onUndo)}
          >
            <MinusIcon className={styles.sideIcon} />
          </button>
        )}

        {nextReminderTime && (
          <button
            type="button"
            data-role="habit-check"
            className={`${styles.sideButton} ${nextReminderSkipped ? styles.sideButtonOff : ""}`}
            aria-label={
              nextReminderSkipped
                ? `Reativar o aviso das ${nextReminderTime} de ${habit.name}`
                : `Desligar o aviso das ${nextReminderTime} de ${habit.name}`
            }
            title={`Aviso das ${nextReminderTime}`}
            onPointerUp={onSkipReminder}
            onClick={keyboardOnly(onSkipReminder)}
          >
            {nextReminderSkipped ? (
              <BellOffIcon className={styles.sideIcon} />
            ) : (
              <BellIcon className={styles.sideIcon} />
            )}
          </button>
        )}

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
