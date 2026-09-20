import { useMemo } from "react";
import type { Habit } from "../../types/habit";
import type { PeriodNav } from "../../hooks/usePeriodNav";
import { streakLabel } from "../../utils/streakUtils";
import {
  buildDayContext,
  buildMonthGrid,
  buildWeekGrid,
  buildYearGrid,
  sumTotals,
  totalsOf,
  type HeatmapGrid,
  type HeatmapTotals,
} from "../../utils/heatmap";
import { periodCountLabel, periodSummaryLabel } from "../../utils/period";
import { ChevronIcon } from "../Icon/icons";
import { PeriodSwitcher } from "../PeriodSwitcher/PeriodSwitcher";
import { HabitHistoryCard } from "../HabitHistoryCard/HabitHistoryCard";
import styles from "./HistoryPanel.module.css";

interface HistoryPanelProps {
  habits: Habit[];
  nav: PeriodNav;
  variant: "mobile" | "desktop";
  dateLabel: string;
}

interface Row {
  habit: Habit;
  grid: HeatmapGrid;
  totals: HeatmapTotals;
}

export function HistoryPanel({ habits, nav, variant, dateLabel }: HistoryPanelProps) {
  const { period, offset, range } = nav;

  const rows = useMemo<Row[]>(
    () =>
      habits.map((habit) => {
        const ctx = buildDayContext(habit);
        const grid =
          period === "week"
            ? buildWeekGrid(range.start, ctx)
            : period === "month"
              ? buildMonthGrid(range.year, range.month, ctx)
              : buildYearGrid(range.year, ctx);
        return { habit, grid, totals: totalsOf(grid.days) };
      }),
    [habits, period, range]
  );

  const summary = periodSummaryLabel(period, sumTotals(rows.map((r) => r.totals)));

  const navigation = (
    <div className={styles.nav}>
      <button
        type="button"
        className={styles.arrow}
        aria-label="Período anterior"
        onClick={nav.goPrev}
      >
        <ChevronIcon className={styles.arrowIcon} />
      </button>
      <div className={styles.navText}>
        <span className={styles.navLabel}>{nav.label}</span>
        <span className={styles.navSummary}>{summary}</span>
      </div>
      <button
        type="button"
        className={`${styles.arrow} ${styles.next}`}
        aria-label="Próximo período"
        disabled={!nav.canGoNext}
        onClick={nav.goNext}
      >
        <ChevronIcon className={styles.arrowIcon} />
      </button>
    </div>
  );

  const list = (
    <div className={`${styles.list} ${styles[period]}`}>
      {rows.map(({ habit, grid, totals }) => (
        <HabitHistoryCard
          key={habit.id}
          habit={habit}
          period={period}
          grid={grid}
          countLabel={periodCountLabel(period, totals)}
          metaLabel={offset < 0 ? "período passado" : streakLabel(habit.currentStreak)}
        />
      ))}
    </div>
  );

  if (variant === "desktop") {
    return (
      <div className={styles.panel}>
        <div className={styles.bar}>
          {navigation}
          <PeriodSwitcher period={period} onChange={nav.setPeriod} size="inline" />
        </div>
        {list}
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.date}>{dateLabel}</span>
        <h1 className={styles.title}>Check-ins</h1>
      </header>
      <PeriodSwitcher period={period} onChange={nav.setPeriod} />
      {navigation}
      {list}
    </div>
  );
}
