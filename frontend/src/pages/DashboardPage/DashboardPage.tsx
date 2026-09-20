import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useReminders } from "../../hooks/useReminders";
import { useHabits } from "../../hooks/useHabits";
import { BellIcon, CheckIcon, CalendarIcon } from "../../components/Icon/icons";
import { useCalendar } from "../../context/useCalendar";
import { groupByDay, itemTime, startOfToday, todayLabel, type TimelineItem } from "../../utils/agenda";
import {
  summarizeReminders,
  summarizeHabits,
  greeting,
  urgencyStyle,
} from "../../utils/dashboard";
import { remainingLabel, dayRemainingLabel } from "../../utils/format";
import { useMinuteTick } from "../../hooks/useMinuteTick";
import styles from "./DashboardPage.module.css";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function DashboardPage() {
  const navigate = useNavigate();
  const { reminders, loading: remindersLoading } = useReminders();
  const { habits, loading: habitsLoading } = useHabits();
  const { open: openCalendar } = useCalendar();

  const reminderSummary = useMemo(() => summarizeReminders(reminders), [reminders]);
  const habitSummary = useMemo(() => summarizeHabits(habits), [habits]);

  const dayGroups = useMemo(() => {
    const start = startOfToday();
    const items: TimelineItem[] = reminders
      .map((reminder) => ({
        id: reminder.id,
        kind: "reminder",
        title: reminder.title,
        when: Date.parse(reminder.eventAt),
        detail: reminder.isAllDay ? "Dia inteiro" : "",
        hasTime: !reminder.isAllDay,
      }))
      .filter((item) => item.when >= start && item.when < start + WEEK_MS)
      .sort((a, b) => a.when - b.when);
    return groupByDay(items);
  }, [reminders]);

  const now = useMinuteTick();
  const loading = remindersLoading || habitsLoading;

  const pendingHabits = habitSummary.totalToday - habitSummary.doneToday;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.greeting}>{greeting()}</h1>
          <button
            type="button"
            className={styles.calendarButton}
            aria-label="Abrir calendário"
            onClick={openCalendar}
          >
            <CalendarIcon className={styles.calendarIcon} />
          </button>
        </div>
        <p className={styles.date}>{todayLabel()}</p>
        {!loading && (
          <div className={styles.summaryPills}>
            <span className={styles.pill}>
              {reminderSummary.todayCount} lembrete{reminderSummary.todayCount === 1 ? "" : "s"} hoje
            </span>
            <span className={styles.pill}>
              {pendingHabits} hábito{pendingHabits === 1 ? "" : "s"} pendente{pendingHabits === 1 ? "" : "s"}
            </span>
            <span className={`${styles.pill} ${styles.pillStreak}`}>🔥 {habitSummary.bestStreak}</span>
          </div>
        )}
      </header>

      {loading ? (
        <p className={styles.muted}>Carregando…</p>
      ) : (
        <div className={styles.grid}>
          <section className={`${styles.card} ${styles.span2}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardLabelGroup}>
                <BellIcon className={styles.cardLabelIcon} />
                <span className={styles.cardLabel}>Esta semana</span>
              </span>
              <Link to="/lembretes" className={styles.cardLink}>
                Ver todos
              </Link>
            </div>
            {dayGroups.length === 0 ? (
              <p className={styles.muted}>Nada para esta semana.</p>
            ) : (
              <div className={styles.dayList}>
                {dayGroups.map((group) => (
                  <div key={group.key} className={styles.dayGroup}>
                    <span className={styles.dayLabel}>{group.label}</span>
                    {group.items.map((item) => {
                      const remaining = item.hasTime
                        ? remainingLabel(item.when, now)
                        : dayRemainingLabel(item.when, now);
                      const detailText = remaining?.text ?? item.detail;
                      return (
                        <button
                          key={item.id}
                          className={styles.row}
                          style={urgencyStyle(item.when)}
                          onClick={() => navigate(`/lembretes/r/${item.id}`)}
                        >
                          <span className={styles.rowTime}>{itemTime(item, false)}</span>
                          <span className={styles.rowTitle}>{item.title}</span>
                          {detailText && (
                            <span
                              className={`${styles.rowDetail} ${
                                remaining?.overdue ? styles.rowDetailDanger : ""
                              }`}
                            >
                              {detailText}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={`${styles.card} ${styles.span2}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardLabelGroup}>
                <CheckIcon className={styles.cardLabelIcon} />
                <span className={styles.cardLabel}>Hábitos de hoje</span>
              </span>
              <Link to="/habitos" className={styles.cardLink}>
                Ver todos
              </Link>
            </div>
            {habitSummary.today.length === 0 ? (
              <p className={styles.muted}>Nenhum hábito agendado para hoje.</p>
            ) : (
              <div className={styles.habitList}>
                {habitSummary.today.map(({ habit, completed }) => (
                  <button
                    key={habit.id}
                    className={styles.row}
                    onClick={() => navigate("/habitos")}
                  >
                    <span className={`${styles.rowTitle} ${completed ? styles.rowTitleDone : ""}`}>
                      {habit.name}
                    </span>
                    <span className={styles.rowDetail}>Nível {habit.level}</span>
                    {habit.currentStreak > 0 && (
                      <span className={styles.rowStreak}>🔥 {habit.currentStreak}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>

          {reminderSummary.awaiting.length > 0 && (
            <section className={`${styles.card} ${styles.span2} ${styles.cardWarning}`}>
              <span className={styles.cardLabel}>Aguardando ação</span>
              <div className={styles.habitList}>
                {reminderSummary.awaiting.map((reminder) => (
                  <button
                    key={reminder.id}
                    className={styles.row}
                    onClick={() => navigate(`/lembretes/r/${reminder.id}`)}
                  >
                    <BellIcon className={styles.nextIcon} />
                    <span className={styles.rowTitle}>{reminder.title}</span>
                    <span className={styles.rowDetail}>
                      {reminder.notifyCount}/{reminder.maxNotify} avisos
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
