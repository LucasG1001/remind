import type { DayOfWeek, Habit } from "../types/habit";
import { addDays, formatDateKey, getDayOfWeek, getToday, isSameDay, spCalendarDay } from "./dateUtils";

export type DayState = "completed" | "missed" | "pending" | "notScheduled" | "future";

export interface HeatmapDay {
  key: string;
  date: Date;
  state: DayState;
  isToday: boolean;
}

export interface HeatmapGrid {
  days: HeatmapDay[];
  leadingBlanks: number;
}

export interface HeatmapTotals {
  completed: number;
  scheduled: number;
}

export interface HabitDayContext {
  completed: Set<string>;
  selectedDays: DayOfWeek[];
  createdDay: Date;
  today: Date;
}

export const STATE_LABEL: Record<DayState, string> = {
  completed: "feito",
  missed: "não feito",
  pending: "hoje",
  notScheduled: "não agendado",
  future: "ainda não chegou",
};

type HabitSlice = Pick<Habit, "completions" | "selectedDays" | "createdAt">;

export function buildDayContext(habit: HabitSlice): HabitDayContext {
  return {
    completed: new Set(habit.completions.filter((c) => c.completed).map((c) => c.date)),
    selectedDays: habit.selectedDays,
    createdDay: spCalendarDay(new Date(habit.createdAt)),
    today: getToday(),
  };
}

export function dayState(date: Date, ctx: HabitDayContext): DayState {
  if (date > ctx.today) return "future";
  if (date < ctx.createdDay) return "notScheduled";
  if (!ctx.selectedDays.includes(getDayOfWeek(date))) return "notScheduled";
  if (ctx.completed.has(formatDateKey(date))) return "completed";
  return isSameDay(date, ctx.today) ? "pending" : "missed";
}

function buildDays(start: Date, count: number, ctx: HabitDayContext): HeatmapDay[] {
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(start, i);
    return {
      key: formatDateKey(date),
      date,
      state: dayState(date, ctx),
      isToday: isSameDay(date, ctx.today),
    };
  });
}

export function buildWeekGrid(weekStart: Date, ctx: HabitDayContext): HeatmapGrid {
  return { days: buildDays(weekStart, 7, ctx), leadingBlanks: 0 };
}

export function buildMonthGrid(year: number, month: number, ctx: HabitDayContext): HeatmapGrid {
  const first = new Date(year, month, 1);
  const length = new Date(year, month + 1, 0).getDate();
  return { days: buildDays(first, length, ctx), leadingBlanks: first.getDay() };
}

export function buildYearGrid(year: number, ctx: HabitDayContext): HeatmapGrid {
  const first = new Date(year, 0, 1);
  const length = Math.round((new Date(year + 1, 0, 1).getTime() - first.getTime()) / 86400000);
  return { days: buildDays(first, length, ctx), leadingBlanks: first.getDay() };
}

export function totalsOf(days: HeatmapDay[]): HeatmapTotals {
  let completed = 0;
  let scheduled = 0;
  for (const day of days) {
    if (day.state === "future" || day.state === "notScheduled") continue;
    scheduled++;
    if (day.state === "completed") completed++;
  }
  return { completed, scheduled };
}

export function sumTotals(totals: HeatmapTotals[]): HeatmapTotals {
  return totals.reduce(
    (acc, t) => ({ completed: acc.completed + t.completed, scheduled: acc.scheduled + t.scheduled }),
    { completed: 0, scheduled: 0 }
  );
}

export function adherencePct(totals: HeatmapTotals): number {
  if (totals.scheduled === 0) return 0;
  return Math.round((totals.completed / totals.scheduled) * 100);
}
