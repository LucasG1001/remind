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
import { MONTH_PT } from "../../utils/month";
import { ChevronIcon } from "../Icon/icons";
import type { Reminder } from "../../types/reminder";
import styles from "./RemindersRail.module.css";

function holidayCountLabel(daysLeft: number): string {
  if (daysLeft === 0) return "hoje";
  const n = Math.abs(daysLeft);
  const unit = `${n} dia${n === 1 ? "" : "s"}`;
  return daysLeft > 0 ? unit : `há ${unit}`;
}

export function RemindersRail({ reminders, now }: { reminders: Reminder[]; now: number }) {
  const { view, goPrev, goNext, monthLabel, firstDayOffset, days } = useMonthGrid();
  const { open: openCalendar } = useCalendar();

  const today = getToday();
  const todayKey = getTodayKey();

  const byDay = useMemo(() => groupRemindersByDay(reminders), [reminders]);

  const holidays = useMemo(
    () => getHolidays(view.year).filter((h) => Number(h.dateKey.slice(5, 7)) - 1 === view.month),
    [view],
  );
  const holidayByDay = useMemo(() => new Map(holidays.map((h) => [h.dateKey, h])), [holidays]);

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
            const holiday = holidayByDay.get(key);
            const isToday = isSameDay(date, today);
            const past = key < todayKey;
            const cellClass = [
              styles.day,
              isToday ? styles.dayToday : "",
              !isToday && holiday ? styles.dayHoliday : "",
              !isToday && !holiday && past ? styles.dayEmptyPast : "",
            ]
              .filter(Boolean)
              .join(" ");
            const marks = (
              <>
                {date.getDate()}
                {count > 0 && (
                  <span className={`${styles.badge} ${past ? styles.badgePast : ""}`}>
                    {count > 9 ? "9+" : count}
                  </span>
                )}
                {holiday && <span className={styles.holidayDot} />}
              </>
            );

            if (count === 0) {
              return (
                <span key={key} className={cellClass} title={holiday?.name}>
                  {marks}
                </span>
              );
            }
            const title = `${count} lembrete${count === 1 ? "" : "s"}`;
            return (
              <button
                key={key}
                type="button"
                className={cellClass}
                onClick={openCalendar}
                title={holiday ? `${holiday.name} · ${title}` : title}
              >
                {marks}
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.holidays}>
        <h3 className={styles.holidaysTitle}>Feriados de {MONTH_PT[view.month]!.toLowerCase()}</h3>
        {holidays.length === 0 && <p className={styles.holidaysEmpty}>Nenhum feriado neste mês.</p>}
        {holidays.map((holiday) => {
          const date = parseDate(holiday.dateKey);
          const weekday = date.getDay();
          const daysLeft = diffDaysFromToday(date.getTime(), now);
          return (
            <div
              key={holiday.dateKey}
              className={`${styles.holiday} ${daysLeft < 0 ? styles.holidayPast : ""}`}
            >
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
                {holidayCountLabel(daysLeft)}
              </span>
            </div>
          );
        })}
      </section>
    </div>
  );
}
