import { MONTH_PT } from "./month";
import { diffDaysFromToday, getToday, spCalendarDay, spDateKey } from "./dateUtils";
import { WEEKDAY_ABBR_PT } from "./weekdays";

export interface TimelineItem {
  id: string;
  kind: string;
  title: string;
  when: number;
  detail: string;
  hasTime: boolean;
  subtitle?: string;
  subtitleTone?: "danger";
  done?: boolean;
}

export interface TimelineGroup {
  key: string;
  label: string;
  items: TimelineItem[];
}

export function startOfToday(): number {
  return getToday().getTime();
}

export function splitAgenda(items: TimelineItem[]): { week: TimelineItem[]; later: TimelineItem[] } {
  const limit = startOfToday() + 7 * 24 * 60 * 60 * 1000;
  const week: TimelineItem[] = [];
  const later: TimelineItem[] = [];
  for (const item of items) {
    if (item.when < limit) week.push(item);
    else later.push(item);
  }
  return { week, later };
}

function dayLabel(when: number): string {
  const diff = diffDaysFromToday(when, Date.now());
  if (diff <= 0) return "Hoje";
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

export function groupByMonth(items: TimelineItem[]): TimelineGroup[] {
  const currentYear = spCalendarDay(new Date()).getFullYear();
  const map = new Map<string, TimelineItem[]>();
  for (const item of items) {
    const d = spCalendarDay(new Date(item.when));
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return Array.from(map.entries()).map(([key, list]) => {
    const d = spCalendarDay(new Date(list[0]!.when));
    const month = MONTH_PT[d.getMonth()];
    const year = d.getFullYear();
    return {
      key,
      label: year === currentYear ? month! : `${month} ${year}`,
      items: list,
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

export function itemTime(item: TimelineItem, withDate: boolean): string {
  const d = new Date(item.when);
  const time = item.hasTime
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ })
    : "";
  if (!withDate) return time || "—";
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TZ });
  return time ? `${date} ${time}` : date;
}
