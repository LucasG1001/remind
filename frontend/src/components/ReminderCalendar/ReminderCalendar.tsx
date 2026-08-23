import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDateKey, getToday, isSameDay, parseDate } from "../../utils/dateUtils";
import { WEEKDAY_ABBR_PT, WEEKDAY_LETTERS } from "../../utils/weekdays";
import { MONTH_PT } from "../../utils/month";
import { getHolidays } from "../../utils/holidays";
import { toFormParts } from "../../utils/format";
import { useDismiss } from "../../hooks/useDismiss";
import { useMonthGrid } from "../../hooks/useMonthGrid";
import type { Reminder } from "../../types/reminder";
import styles from "./ReminderCalendar.module.css";

interface ReminderCalendarProps {
  byDay: Map<string, Reminder[]>;
  onClose: () => void;
}

function dayPanelLabel(dateKey: string): string {
  const d = parseDate(dateKey);
  return `${WEEKDAY_ABBR_PT[d.getDay()]}, ${d.getDate()} de ${MONTH_PT[d.getMonth()]!.toLowerCase()}`;
}

export function ReminderCalendar({ byDay, onClose }: ReminderCalendarProps) {
  const navigate = useNavigate();
  const today = getToday();
  const { view, goPrev, goNext, monthLabel, firstDayOffset: offset, days } = useMonthGrid();

  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useDismiss(onClose);

  const holidays = useMemo(() => getHolidays(view.year), [view.year]);
  const holidayByDay = useMemo(() => new Map(holidays.map((h) => [h.dateKey, h])), [holidays]);
  const monthHolidays = holidays.filter((h) => Number(h.dateKey.slice(5, 7)) - 1 === view.month);

  const handlePrev = () => {
    setSelectedKey(null);
    goPrev();
  };

  const handleNext = () => {
    setSelectedKey(null);
    goNext();
  };

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const openReminder = (id: string) => {
    navigate(`/lembretes/r/${id}`);
    onClose();
  };

  const selectedEvents = selectedKey ? byDay.get(selectedKey) ?? [] : [];

  return (
    <div
      className={styles.backdrop}
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Calendário de lembretes"
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <button type="button" className={styles.navButton} onClick={handlePrev} aria-label="Mês anterior">
            ‹
          </button>
          <span className={styles.monthLabel}>{monthLabel}</span>
          <button type="button" className={styles.navButton} onClick={handleNext} aria-label="Próximo mês">
            ›
          </button>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className={styles.weekHeader}>
          {WEEKDAY_LETTERS.map((label, i) => (
            <span key={i} className={styles.weekDay}>
              {label}
            </span>
          ))}
        </div>

        <div className={styles.grid}>
          {Array.from({ length: offset }, (_, i) => (
            <div key={`empty-${i}`} className={styles.emptyCell} />
          ))}

          {days.map((date) => {
            const key = formatDateKey(date);
            const count = byDay.get(key)?.length ?? 0;
            const holiday = holidayByDay.get(key);
            const todayCell = isSameDay(date, today);
            const selected = key === selectedKey;
            return (
              <button
                key={date.getDate()}
                type="button"
                className={`${styles.dayCell} ${todayCell ? styles.today : ""} ${
                  holiday ? styles.holiday : ""
                } ${selected ? styles.selected : ""}`}
                title={holiday?.name}
                aria-pressed={selected}
                onClick={() => setSelectedKey((prev) => (prev === key ? null : key))}
              >
                <span className={styles.dayNumber}>{date.getDate()}</span>
                {count > 0 && <span className={styles.badge}>{count > 9 ? "9+" : count}</span>}
                {holiday && <span className={styles.holidayDot} />}
              </button>
            );
          })}
        </div>

        {selectedKey ? (
          <div className={styles.dayPanel}>
            <div className={styles.dayPanelHeader}>{dayPanelLabel(selectedKey)}</div>
            {holidayByDay.get(selectedKey) && (
              <div className={styles.dayPanelHoliday}>
                <span className={styles.holidayItemDot} />
                {holidayByDay.get(selectedKey)!.name}
              </div>
            )}
            {selectedEvents.length === 0 ? (
              <p className={styles.dayPanelEmpty}>Nenhum lembrete neste dia.</p>
            ) : (
              selectedEvents.map((reminder) => (
                <button
                  key={reminder.id}
                  type="button"
                  className={styles.event}
                  onClick={() => openReminder(reminder.id)}
                >
                  <span className={styles.eventTime}>
                    {reminder.isAllDay ? "Dia inteiro" : toFormParts(reminder.eventAt).time}
                  </span>
                  <span className={styles.eventText}>
                    <span className={styles.eventTitle}>{reminder.title}</span>
                    {reminder.notes && <span className={styles.eventNotes}>{reminder.notes}</span>}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : (
          monthHolidays.length > 0 && (
            <div className={styles.holidayList}>
              {monthHolidays.map((h) => (
                <div key={h.dateKey} className={styles.holidayItem}>
                  <span className={styles.holidayItemDot} />
                  <span className={styles.holidayDate}>{h.dateKey.slice(8, 10)}</span>
                  <span className={styles.holidayName}>{h.name}</span>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
