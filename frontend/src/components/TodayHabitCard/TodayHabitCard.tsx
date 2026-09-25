import {
  createElement,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Habit } from "../../types/habit";
import { getIcon } from "../../utils/iconLibrary";
import { CloseIcon, MinusIcon, PauseIcon, PlayIcon } from "../Icon/icons";
import { useHabitTimer } from "../../context/useHabitTimer";
import { formatRemaining } from "../../utils/habitTimer";
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
  onToggle: () => void;
  onUndo: () => void;
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
  onUndo,
  onEdit,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: TodayHabitCardProps) {
  const partial = count > 0 && !completed;
  const timerCtx = useHabitTimer();
  const hasTimer = habit.durationMinutes !== null;
  const timer = timerCtx.timer?.habitId === habit.id ? timerCtx.timer : null;
  const ringing = timerCtx.ringing?.habitId === habit.id;
  const paused = timer?.pausedAt != null;
  // Com a sessão em curso a fileira ganha dois botões: o nível e o "−" saem para
  // o nome e o tempo caberem na coluna de 330px.
  const timerBusy = timer !== null || ringing;

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
          {(target > 1 || hasTimer) && (
            <span className={styles.caption}>
              {hasTimer && (
                <span className={`${styles.timer} ${timer || ringing ? styles.timerActive : ""}`}>
                  {ringing
                    ? "Acabou!"
                    : timer
                      ? `${formatRemaining(timerCtx.remaining)}${paused ? " · pausado" : ""}`
                      : `${habit.durationMinutes} min`}
                </span>
              )}
              {target <= 1 ? null : target <= MAX_SEGMENTS ? (
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

        {ringing ? (
          <button
            type="button"
            data-role="habit-check"
            className={styles.stopButton}
            onPointerUp={timerCtx.stopRinging}
            onClick={keyboardOnly(timerCtx.stopRinging)}
          >
            Parar
          </button>
        ) : timer ? (
          <>
            <button
              type="button"
              data-role="habit-check"
              className={styles.sideButton}
              aria-label={`Cancelar o timer de ${habit.name}`}
              onPointerUp={timerCtx.cancel}
              onClick={keyboardOnly(timerCtx.cancel)}
            >
              <CloseIcon className={styles.sideIcon} />
            </button>
            <button
              type="button"
              data-role="habit-check"
              className={`${styles.sideButton} ${styles.sideButtonOff}`}
              aria-label={paused ? `Retomar o timer de ${habit.name}` : `Pausar o timer de ${habit.name}`}
              onPointerUp={paused ? timerCtx.resume : timerCtx.pause}
              onClick={keyboardOnly(paused ? timerCtx.resume : timerCtx.pause)}
            >
              {paused ? <PlayIcon className={styles.sideIcon} /> : <PauseIcon className={styles.sideIcon} />}
            </button>
          </>
        ) : (
          hasTimer &&
          !completed && (
            <button
              type="button"
              data-role="habit-check"
              className={styles.sideButton}
              aria-label={`Iniciar ${habit.durationMinutes} min de ${habit.name}`}
              onPointerUp={() => timerCtx.start(habit)}
              onClick={keyboardOnly(() => timerCtx.start(habit))}
            >
              <PlayIcon className={styles.sideIcon} />
            </button>
          )
        )}

        {count > 0 && !timerBusy && (
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

        {!timerBusy && (
          <span className={styles.level} style={{ color: getLevelColor(habit.level) }}>
            Nv {habit.level}
          </span>
        )}
      </div>

      <div className={styles.strip}>
        <LevelStrip level={habit.level} progress={habit.levelProgress} />
      </div>
    </li>
  );
}
