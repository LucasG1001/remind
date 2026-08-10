import { createElement, useMemo } from "react";
import type { Habit } from "../../types/habit";
import { getTodayKey } from "../../utils/dateUtils";
import { getHabitIcon } from "../../utils/habitIcons";
import { calculateRecentRate } from "../../utils/streakUtils";
import { formatSelectedDays } from "../../utils/weekdays";
import { useDismiss } from "../../hooks/useDismiss";
import { ConfirmButton } from "../ConfirmButton/ConfirmButton";
import { CompletionGrid } from "../CompletionGrid/CompletionGrid";
import { CheckMarkIcon, ChevronIcon, MinusIcon, PlusIcon, TrashIcon } from "../Sidebar/Sidebar.icons";
import styles from "./SidePanel.module.css";

interface SidePanelProps {
  habit: Habit;
  onClose: () => void;
  onEdit: (habit: Habit) => void;
  onDelete: (id: string) => void;
  onSetCount: (habitId: string, dateKey: string, count: number) => void;
}

const MAX_BLOCKS = 10;

export function SidePanel({ habit, onClose, onEdit, onDelete, onSetCount }: SidePanelProps) {
  useDismiss(onClose);

  const todayKey = getTodayKey();
  const target = Math.max(1, habit.targetCount);
  const count = Math.min(habit.completions.find((c) => c.date === todayKey)?.count ?? 0, target);
  const remaining = target - count;
  const complete = remaining <= 0;

  const rate = useMemo(
    () => calculateRecentRate(habit.completions, habit.selectedDays, habit.createdAt),
    [habit.completions, habit.selectedDays, habit.createdAt]
  );

  const setCount = (next: number) =>
    onSetCount(habit.id, todayKey, Math.max(0, Math.min(target, next)));

  const footerLabel = complete
    ? "Desmarcar"
    : target === 1
      ? "Marcar como feito"
      : `Marcar +1 (${remaining} ${remaining === 1 ? "restante" : "restantes"})`;

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <aside className={styles.panel} role="dialog" aria-label={`Detalhes de ${habit.name}`}>
        <div className={styles.actionsBar}>
          <button className={styles.iconAction} onClick={onClose} aria-label="Fechar painel">
            <ChevronIcon className={styles.backIcon} />
          </button>
          <div className={styles.actionsRight}>
            <button
              className={styles.iconAction}
              onClick={() => onEdit(habit)}
              aria-label="Editar hábito"
              title="Editar hábito"
            >
              {createElement(getHabitIcon("edit"), { className: styles.actionIcon })}
            </button>
            <ConfirmButton
              className={`${styles.iconAction} ${styles.deleteAction}`}
              confirmClassName={styles.deleteArmed}
              idleLabel={<TrashIcon className={styles.actionIcon} />}
              confirmLabel="Confirmar?"
              onConfirm={() => {
                onDelete(habit.id);
                onClose();
              }}
            />
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.identity}>
            <span className={styles.identityIcon}>
              {createElement(getHabitIcon(habit.icon), { className: styles.identityGlyph })}
            </span>
            <span className={styles.identityText}>
              <h2 className={styles.habitName}>{habit.name}</h2>
              <span className={styles.habitCaption}>
                {formatSelectedDays(habit.selectedDays)} · meta {target}×/dia
              </span>
            </span>
          </div>

          <div className={styles.metrics}>
            <div className={styles.metricCard}>
              <span className={`${styles.metricValue} ${styles.metricStreak}`}>
                {habit.currentStreak}
              </span>
              <span className={styles.metricLabel}>sequência atual</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricValue}>{habit.longestStreak}</span>
              <span className={styles.metricLabel}>recorde</span>
            </div>
            <div className={styles.metricCard}>
              <span className={`${styles.metricValue} ${styles.metricRate}`}>
                {rate === null ? "—" : `${rate}%`}
              </span>
              <span className={styles.metricLabel}>30 dias</span>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Hoje</span>
              <span className={styles.sectionValue}>
                {count} de {target}
              </span>
            </div>

            {target > MAX_BLOCKS ? (
              <div className={styles.stepper}>
                <button
                  className={styles.stepperButton}
                  onClick={() => setCount(count - 1)}
                  disabled={count === 0}
                  aria-label="Diminuir conclusões de hoje"
                >
                  <MinusIcon className={styles.stepperIcon} />
                </button>
                <span className={styles.stepperValue}>{count}</span>
                <button
                  className={`${styles.stepperButton} ${styles.stepperPlus}`}
                  onClick={() => setCount(count + 1)}
                  disabled={complete}
                  aria-label="Aumentar conclusões de hoje"
                >
                  <PlusIcon className={styles.stepperIcon} />
                </button>
              </div>
            ) : (
              <div className={styles.blocks}>
                {Array.from({ length: target }, (_, i) => {
                  const value = i + 1;
                  const filled = value <= count;
                  return (
                    <button
                      key={value}
                      className={`${styles.block} ${filled ? styles.blockFilled : ""}`}
                      onClick={() => setCount(count === value ? value - 1 : value)}
                      aria-pressed={filled}
                      aria-label={`Definir ${value} de ${target} hoje`}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <div className={styles.gridContainer}>
            <CompletionGrid
              completions={habit.completions}
              selectedDays={habit.selectedDays}
              createdAt={habit.createdAt}
            />
          </div>
        </div>

        <div className={styles.footer}>
          <button
            className={`${styles.footerButton} ${complete ? styles.footerButtonUndo : ""}`}
            onClick={() => setCount(complete ? 0 : count + 1)}
          >
            {!complete && <CheckMarkIcon className={styles.footerIcon} />}
            {footerLabel}
          </button>
        </div>
      </aside>
    </>
  );
}
