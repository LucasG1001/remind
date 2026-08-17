import { useMemo } from "react";
import type { DayOfWeek, HabitCompletion } from "../../types/habit";
import {
  formatDateKey,
  getDayOfWeek,
  getToday,
  getWeekDays,
  isSameDay,
  spCalendarDay,
} from "../../utils/dateUtils";
import { WEEKDAYS_PT } from "../../utils/weekdays";
import styles from "./WeekBars.module.css";

interface WeekBarsProps {
  completions: HabitCompletion[];
  selectedDays: DayOfWeek[];
  createdAt: string;
}

type BarState = "completed" | "missed" | "pending" | "future" | "notScheduled";

interface Bar {
  key: string;
  label: string;
  state: BarState;
}

const STATE_LABEL: Record<BarState, string> = {
  completed: "feito",
  missed: "não feito",
  pending: "hoje",
  future: "ainda não chegou",
  notScheduled: "não agendado",
};

function barState(
  date: Date,
  today: Date,
  createdDay: Date,
  completions: HabitCompletion[],
  selectedDays: DayOfWeek[]
): BarState {
  const isToday = isSameDay(date, today);

  if (!selectedDays.includes(getDayOfWeek(date))) return "notScheduled";
  if (date > today) return "future";
  if (date < createdDay) return "notScheduled";

  const done = completions.some((c) => c.date === formatDateKey(date) && c.completed);
  if (done) return "completed";
  return isToday ? "pending" : "missed";
}

export function WeekBars({ completions, selectedDays, createdAt }: WeekBarsProps) {
  const bars = useMemo<Bar[]>(() => {
    const today = getToday();
    const createdDay = spCalendarDay(new Date(createdAt));
    return getWeekDays().map((date) => {
      const key = formatDateKey(date);
      const state = barState(date, today, createdDay, completions, selectedDays);
      return {
        key,
        label: `${WEEKDAYS_PT[getDayOfWeek(date)]} · ${STATE_LABEL[state]}`,
        state,
      };
    });
  }, [completions, selectedDays, createdAt]);

  return (
    <span className={styles.week}>
      {bars.map((bar) => (
        <span key={bar.key} className={`${styles.bar} ${styles[bar.state]}`} title={bar.label} />
      ))}
    </span>
  );
}
