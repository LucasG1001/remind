import { diffDaysFromToday, getToday, spCalendarDay, spDateKey } from "./dateUtils";
import { WEEKDAY_ABBR_PT } from "./weekdays";
import { MONTH_PT } from "./month";

export interface TimelineItem {
  id: string;
  kind: string;
  title: string;
  when: number;
  detail: string;
  hasTime: boolean;
  subtitle?: string;
  subtitleTone?: "danger";
  tone?: "danger" | "today";
  done?: boolean;
}

export interface TimelineGroup {
  key: string;
  label: string;
  items: TimelineItem[];
}

export interface TimelineSection {
  key: string;
  label: string;
  items: TimelineItem[];
  count?: number;
  caption?: string;
  tone?: "danger";
  actions?: boolean;
}

export function startOfToday(): number {
  return getToday().getTime();
}

export function splitReminders(
  items: TimelineItem[],
  nowMs: number
): { overdue: TimelineItem[]; today: TimelineItem[]; upcoming: TimelineItem[] } {
  const overdue: TimelineItem[] = [];
  const today: TimelineItem[] = [];
  const upcoming: TimelineItem[] = [];
  for (const item of items) {
    const diff = diffDaysFromToday(item.when, nowMs);
    if (diff < 0) overdue.push(item);
    else if (diff === 0) today.push(item);
    else upcoming.push(item);
  }
  return { overdue, today, upcoming };
}

function dayLabel(when: number): string {
  const diff = diffDaysFromToday(when, Date.now());
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  const d = spCalendarDay(new Date(when));
  return `${WEEKDAY_ABBR_PT[d.getDay()]} ${d.getDate()}`;
}

export function groupByDay(items: TimelineItem[]): TimelineGroup[] {
  const map = new Map<string, TimelineItem[]>();
  for (const item of items) {
    const key = spDateKey(new Date(item.when));
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return Array.from(map.entries()).map(([key, list]) => ({
    key,
    label: dayLabel(list[0]!.when),
    items: list,
  }));
}

/**
 * Um bloco por mês, na ordem em que os itens chegam — a lista já vem ordenada
 * por `when`. O ano só entra no rótulo quando não é o corrente.
 */
export function groupByMonth(items: TimelineItem[], nowMs: number): TimelineSection[] {
  const currentYear = spCalendarDay(new Date(nowMs)).getFullYear();
  const map = new Map<string, TimelineItem[]>();
  for (const item of items) {
    const d = spCalendarDay(new Date(item.when));
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return Array.from(map.entries()).map(([key, list]) => {
    const d = spCalendarDay(new Date(list[0]!.when));
    const month = MONTH_PT[d.getMonth()]!;
    const year = d.getFullYear();
    return {
      key: `month-${key}`,
      label: year === currentYear ? month : `${month} de ${year}`,
      items: list,
      count: list.length,
    };
  });
}

export function groupRemindersByDay<T extends { eventAt: string }>(reminders: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const reminder of reminders) {
    const key = spDateKey(new Date(reminder.eventAt));
    const list = map.get(key);
    if (list) list.push(reminder);
    else map.set(key, [reminder]);
  }
  for (const list of map.values()) {
    list.sort((a, b) => Date.parse(a.eventAt) - Date.parse(b.eventAt));
  }
  return map;
}

const TZ = "America/Sao_Paulo";

/** Coluna de data da linha de lembrete: "dom 19/7". */
export function dayCellLabel(when: number): string {
  const d = spCalendarDay(new Date(when));
  return `${WEEKDAY_ABBR_PT[d.getDay()]!.toLowerCase()} ${d.getDate()}/${d.getMonth() + 1}`;
}

/** Data de hoje por extenso: "domingo, 20 de setembro". */
export function todayLabel(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: TZ,
  });
}

export function itemTime(item: TimelineItem, withDate: boolean): string {
  const d = new Date(item.when);
  const time = item.hasTime
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ })
    : "";
  if (!withDate) return time || "—";
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TZ });
  return time ? `${date} ${time}` : date;
}
