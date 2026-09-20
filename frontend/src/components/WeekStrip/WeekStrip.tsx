import { useMemo } from "react";
import { groupRemindersByDay } from "../../utils/agenda";
import { addDays, formatDateKey, getToday, isSameDay, startOfWeek } from "../../utils/dateUtils";
import { WEEKDAY_ABBR_PT } from "../../utils/weekdays";
import type { Reminder } from "../../types/reminder";
import styles from "./WeekStrip.module.css";

export function WeekStrip({ reminders }: { reminders: Reminder[] }) {
  const today = getToday();
  const byDay = useMemo(() => groupRemindersByDay(reminders), [reminders]);

  const week = useMemo(() => {
    const start = startOfWeek(getToday());
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, []);

  return (
    <div className={styles.strip}>
      {week.map((date) => {
        const key = formatDateKey(date);
        const isToday = isSameDay(date, today);
        const hasReminder = (byDay.get(key)?.length ?? 0) > 0;
        return (
          <div key={key} className={`${styles.cell} ${isToday ? styles.cellToday : ""}`}>
            <span className={styles.dow}>{WEEKDAY_ABBR_PT[date.getDay()]}</span>
            <span className={styles.day}>{date.getDate()}</span>
            <span
              className={`${styles.dot} ${
                isToday ? styles.dotToday : hasReminder ? styles.dotMarked : ""
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}
