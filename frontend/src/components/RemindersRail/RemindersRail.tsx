import { useMemo } from "react";
import { groupRemindersByDay } from "../../utils/agenda";
import {
  diffDaysFromToday,
  formatDateKey,
  getToday,
  getTodayKey,
  isSameDay,
  parseDate,
} from "../../utils/dateUtils";
import { WEEKDAY_ABBR_PT, WEEKDAY_LETTERS } from "../../utils/weekdays";
import { getHolidays } from "../../utils/holidays";
import { useMonthGrid } from "../../hooks/useMonthGrid";
import { useCalendar } from "../../context/useCalendar";
import { ChevronIcon } from "../Icon/icons";
import type { Reminder } from "../../types/reminder";
import styles from "./RemindersRail.module.css";

const HOLIDAY_COUNT = 5;

export function RemindersRail({ reminders, now }: { reminders: Reminder[]; now: number }) {
  const { goPrev, goNext, monthLabel, firstDayOffset, days } = useMonthGrid();
  const { open: openCalendar } = useCalendar();

  const today = getToday();
  const todayKey = getTodayKey();

  const byDay = useMemo(() => groupRemindersByDay(reminders), [reminders]);

  const holidays = useMemo(() => {
    const year = Number(todayKey.slice(0, 4));
    return [...getHolidays(year), ...getHolidays(year + 1)]
      .filter((h) => h.dateKey >= todayKey)
      .slice(0, HOLIDAY_COUNT);
  }, [todayKey]);

  return (
    <div className={styles.rail}>
      <section className={styles.month}>
        <div className={styles.monthHeader}>
          <span className={styles.monthLabel}>{monthLabel}</span>
          <span className={styles.monthNav}>
            <button
              type="button"
              className={styles.navButton}
              onClick={goPrev}
              aria-label="Mês anterior"
            >
              <ChevronIcon className={styles.navIcon} />
            </button>
            <button
              type="button"
              className={styles.navButton}
              onClick={goNext}
              aria-label="Próximo mês"
            >
              <ChevronIcon className={styles.navIconNext} />
            </button>
          </span>
        </div>

        <div className={styles.grid}>
          {WEEKDAY_LETTERS.map((letter, i) => (
            <span key={i} className={styles.weekDay}>
              {letter}
            </span>
          ))}

          {Array.from({ length: firstDayOffset }, (_, i) => (
            <span key={`empty-${i}`} />
          ))}

          {days.map((date) => {
            const key = formatDateKey(date);
            const count = byDay.get(key)?.length ?? 0;
            const isToday = isSameDay(date, today);
            const past = key < todayKey;
            const cellClass = [
              styles.day,
              isToday ? styles.dayToday : "",
              !isToday && count > 0 && past ? styles.dayPast : "",
              !isToday && count > 0 && !past ? styles.dayMarked : "",
              !isToday && count === 0 && past ? styles.dayEmptyPast : "",
            ]
              .filter(Boolean)
              .join(" ");

            if (count === 0) {
              return (
                <span key={key} className={cellClass}>
                  {date.getDate()}
                </span>
              );
            }
            return (
              <button
                key={key}
                type="button"
                className={cellClass}
                onClick={openCalendar}
                title={`${count} lembrete${count === 1 ? "" : "s"}`}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.holidays}>
        <h3 className={styles.holidaysTitle}>Próximos feriados</h3>
        {holidays.map((holiday) => {
          const date = parseDate(holiday.dateKey);
          const weekday = date.getDay();
          const daysLeft = diffDaysFromToday(date.getTime(), now);
          return (
            <div key={holiday.dateKey} className={styles.holiday}>
              <span className={styles.holidayWhen}>
                <span
                  className={`${styles.holidayDow} ${
                    weekday === 1 || weekday === 5 ? styles.holidayDowLong : ""
                  }`}
                >
                  {WEEKDAY_ABBR_PT[weekday]}
                </span>
                <span className={styles.holidayDate}>
                  {date.getDate()}/{date.getMonth() + 1}
                </span>
              </span>
              <span className={styles.holidayName}>
                {holiday.name}
                {holiday.type !== "nacional" && (
                  <span className={styles.holidayType}>{holiday.type}</span>
                )}
              </span>
              <span className={styles.holidayCount}>
                {daysLeft === 0 ? "hoje" : `${daysLeft} dia${daysLeft === 1 ? "" : "s"}`}
              </span>
            </div>
          );
        })}
      </section>
    </div>
  );
}
