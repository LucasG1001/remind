import { addDays, startOfWeek } from "./dateUtils";
import { MONTH_ABBR_PT, MONTH_PT } from "./month";
import { adherencePct, type HeatmapTotals } from "./heatmap";

export type Period = "week" | "month" | "year";

export const PERIOD_OPTIONS: ReadonlyArray<{ value: Period; label: string }> = [
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "year", label: "Ano" },
];

export interface PeriodRange {
  period: Period;
  start: Date;
  end: Date;
  year: number;
  month: number;
}

export function periodRange(period: Period, offset: number, today: Date): PeriodRange {
  if (period === "week") {
    const start = addDays(startOfWeek(today), offset * 7);
    const end = addDays(start, 6);
    return { period, start, end, year: start.getFullYear(), month: start.getMonth() };
  }

  if (period === "month") {
    const start = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    return { period, start, end, year: start.getFullYear(), month: start.getMonth() };
  }

  const year = today.getFullYear() + offset;
  return { period, start: new Date(year, 0, 1), end: new Date(year, 11, 31), year, month: 0 };
}

function shortDate(date: Date): string {
  return `${date.getDate()} ${MONTH_ABBR_PT[date.getMonth()]}`;
}

export function periodLabel(range: PeriodRange, offset: number): string {
  if (range.period === "week") {
    const prefix = offset === 0 ? "Esta semana · " : "";
    return `${prefix}${shortDate(range.start)} – ${shortDate(range.end)}`;
  }
  if (range.period === "month") return `${MONTH_PT[range.month]} de ${range.year}`;
  return String(range.year);
}

export function periodCountLabel(period: Period, totals: HeatmapTotals): string {
  if (period === "year") return `${adherencePct(totals)}%`;
  return `${totals.completed}/${totals.scheduled}`;
}

export function periodSummaryLabel(period: Period, totals: HeatmapTotals): string {
  if (period === "year") return `${adherencePct(totals)}% de adesão média`;
  return `${totals.completed}/${totals.scheduled} check-ins no período`;
}
