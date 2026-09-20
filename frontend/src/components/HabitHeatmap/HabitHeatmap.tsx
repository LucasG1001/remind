import { WEEKDAY_LETTERS } from "../../utils/weekdays";
import { STATE_LABEL, type HeatmapGrid } from "../../utils/heatmap";
import { formatDateBR } from "../../utils/dateUtils";
import type { Period } from "../../utils/period";
import styles from "./HabitHeatmap.module.css";

interface HabitHeatmapProps {
  period: Period;
  grid: HeatmapGrid;
}

const VARIANT: Record<Period, string> = {
  week: styles.week,
  month: styles.month,
  year: styles.year,
};

export function HabitHeatmap({ period, grid }: HabitHeatmapProps) {
  if (period === "week") {
    return (
      <div className={`${styles.cells} ${VARIANT.week}`}>
        {grid.days.map((day, i) => (
          <div key={day.key} className={styles.column}>
            <span className={styles.letter}>{WEEKDAY_LETTERS[i]}</span>
            <span
              className={`${styles.cell} ${styles[day.state]} ${day.isToday ? styles.today : ""}`}
              title={`${formatDateBR(day.key)} · ${STATE_LABEL[day.state]}`}
            />
          </div>
        ))}
      </div>
    );
  }

  const blanks = Array.from({ length: grid.leadingBlanks }, (_, i) => (
    <span key={`blank-${i}`} className={styles.blank} />
  ));

  if (period === "month") {
    return (
      <div className={styles.monthWrapper}>
        <div className={styles.letters}>
          {WEEKDAY_LETTERS.map((letter, i) => (
            <span key={i} className={styles.letter}>
              {letter}
            </span>
          ))}
        </div>
        <div className={`${styles.cells} ${VARIANT.month}`}>
          {blanks}
          {grid.days.map((day) => (
            <span
              key={day.key}
              className={`${styles.cell} ${styles[day.state]} ${day.isToday ? styles.today : ""}`}
              title={`${formatDateBR(day.key)} · ${STATE_LABEL[day.state]}`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.cells} ${VARIANT.year}`}>
      {blanks}
      {grid.days.map((day) => (
        <span
          key={day.key}
          className={`${styles.cell} ${styles[day.state]} ${day.isToday ? styles.today : ""}`}
        />
      ))}
    </div>
  );
}
