import { createElement } from "react";
import type { Habit } from "../../types/habit";
import { getIcon } from "../../utils/iconLibrary";
import type { HeatmapGrid } from "../../utils/heatmap";
import type { Period } from "../../utils/period";
import { HabitHeatmap } from "../HabitHeatmap/HabitHeatmap";
import styles from "./HabitHistoryCard.module.css";

interface HabitHistoryCardProps {
  habit: Habit;
  period: Period;
  grid: HeatmapGrid;
  countLabel: string;
  metaLabel: string;
}

export function HabitHistoryCard({
  habit,
  period,
  grid,
  countLabel,
  metaLabel,
}: HabitHistoryCardProps) {
  return (
    <article className={`${styles.card} ${period === "year" ? styles.compact : ""}`}>
      <div className={styles.head}>
        {createElement(getIcon(habit.icon), { className: styles.icon })}
        <span className={styles.name}>{habit.name}</span>
      </div>
      <div className={styles.meta}>
        <span>{countLabel}</span>
        <span className={styles.dot} aria-hidden="true" />
        <span>{metaLabel}</span>
      </div>
      <HabitHeatmap period={period} grid={grid} />
    </article>
  );
}
