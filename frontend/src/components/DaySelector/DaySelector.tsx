import type { DayOfWeek } from "../../types/habit";
import { WEEKDAY_LETTERS, WEEKDAYS_PT } from "../../utils/weekdays";
import styles from "./DaySelector.module.css";

interface DaySelectorProps {
  selectedDays: DayOfWeek[];
  onChange: (days: DayOfWeek[]) => void;
  error?: string;
}

const ALL_DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

export function DaySelector({ selectedDays, onChange, error }: DaySelectorProps) {
  const allSelected = selectedDays.length === ALL_DAYS.length;

  function handleToggle(day: DayOfWeek) {
    if (selectedDays.includes(day)) {
      onChange(selectedDays.filter((d) => d !== day));
    } else {
      onChange([...selectedDays, day].sort((a, b) => a - b));
    }
  }

  function toggleAll() {
    onChange(allSelected ? [] : [...ALL_DAYS]);
  }

  return (
    <div className={styles.field}>
      <div className={styles.header}>
        <span className={styles.label}>Dias</span>
        <button
          type="button"
          className={styles.allButton}
          onClick={toggleAll}
          aria-pressed={allSelected}
        >
          {allSelected ? "Limpar" : "Todos os dias"}
        </button>
      </div>

      <div className={styles.chips}>
        {ALL_DAYS.map((value) => {
          const isSelected = selectedDays.includes(value);
          return (
            <button
              key={value}
              type="button"
              className={`${styles.chip} ${isSelected ? styles.selected : ""}`}
              onClick={() => handleToggle(value)}
              aria-pressed={isSelected}
              aria-label={WEEKDAYS_PT[value]}
            >
              {WEEKDAY_LETTERS[value]}
            </button>
          );
        })}
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
