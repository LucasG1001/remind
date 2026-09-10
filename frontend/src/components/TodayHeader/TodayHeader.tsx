import { memo, useMemo } from "react";
import type { Habit } from "../../types/habit";
import { getToday, getTodayKey, isScheduledDay } from "../../utils/dateUtils";
import { calculateCombinedStreak } from "../../utils/streakUtils";
import { useCalendar } from "../../context/useCalendar";
import { CalendarIcon, FlameIcon } from "../Sidebar/Sidebar.icons";
import styles from "./TodayHeader.module.css";

interface TodayHeaderProps {
  habits: Habit[];
  onCreate?: () => void;
}

const dayFormatter = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });

function TodayHeaderBase({ habits, onCreate }: TodayHeaderProps) {
  const { open: openCalendar } = useCalendar();

  const { doneToday, totalToday, current, longest } = useMemo(() => {
    const today = getToday();
    const todayKey = getTodayKey();
    const scheduled = habits.filter((habit) => isScheduledDay(today, habit.selectedDays));
    const done = scheduled.filter((habit) =>
      habit.completions.some((c) => c.date === todayKey && c.completed)
    ).length;
    const streak = calculateCombinedStreak(habits);
    return { doneToday: done, totalToday: scheduled.length, ...streak };
  }, [habits]);

  const progressPct = totalToday ? Math.round((doneToday / totalToday) * 100) : 0;
  const pending = totalToday - doneToday;

  const caption =
    totalToday === 0
      ? "Nada agendado para hoje"
      : pending === 0
        ? "Tudo feito hoje! 🎉"
        : `${pending} ${pending === 1 ? "pendente" : "pendentes"} · recorde ${longest} dias`;

  return (
    <header className={styles.header}>
      <div className={styles.row}>
        <h1 className={styles.title}>Hoje, {dayFormatter.format(getToday())}</h1>
        <button
          type="button"
          className={styles.calendarButton}
          onClick={openCalendar}
          aria-label="Calendário"
          title="Calendário"
        >
          <CalendarIcon className={styles.calendarIcon} />
        </button>
        <span className={styles.streak} title="Sequência de dias com todos os hábitos em dia">
          <FlameIcon className={styles.flame} />
          {current}
        </span>
        {onCreate && (
          <button type="button" className={styles.newButton} onClick={onCreate}>
            <span className={styles.newPlus}>+</span>
            <span className={styles.newLabel}>Novo hábito</span>
          </button>
        )}
      </div>

      <div className={styles.row}>
        <span className={styles.track}>
          <span className={styles.fill} style={{ width: `${progressPct}%` }} />
        </span>
        <span className={styles.ratio}>
          {doneToday}
          <span className={styles.ratioTotal}>/{totalToday}</span>
        </span>
        <p className={styles.caption}>{caption}</p>
      </div>
    </header>
  );
}

// memo: a HabitsPage re-renderiza a cada minuto (linha do "agora") e
// calculateCombinedStreak varre todos os dias desde o hábito mais antigo.
export const TodayHeader = memo(TodayHeaderBase);
