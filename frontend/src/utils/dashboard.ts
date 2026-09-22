import type { Reminder } from "../types/reminder";
import type { Habit } from "../types/habit";
import { getToday, getTodayKey, isScheduledDay } from "./dateUtils";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReminderSummary {
  todayCount: number;
  awaiting: Reminder[];
}

export function summarizeReminders(reminders: Reminder[]): ReminderSummary {
  const start = getToday().getTime();
  const todayEnd = start + DAY_MS;

  let todayCount = 0;
  const awaiting: Reminder[] = [];

  for (const reminder of reminders) {
    const when = Date.parse(reminder.eventAt);
    if (when >= start && when < todayEnd) todayCount += 1;
    if (reminder.notifyCount > 0 && !reminder.acknowledged) awaiting.push(reminder);
  }

  return { todayCount, awaiting };
}

export interface HabitToday {
  habit: Habit;
  completed: boolean;
}

export interface HabitSummary {
  today: HabitToday[];
  doneToday: number;
  totalToday: number;
  bestStreak: number;
}

export function summarizeHabits(habits: Habit[]): HabitSummary {
  const today = getToday();
  const todayKey = getTodayKey();
  const todayList: HabitToday[] = [];

  let bestStreak = 0;

  for (const habit of habits) {
    bestStreak = Math.max(bestStreak, habit.currentStreak);
    if (isScheduledDay(today, habit.selectedDays)) {
      const completion = habit.completions.find((c) => c.date === todayKey);
      todayList.push({ habit, completed: Boolean(completion?.completed) });
    }
  }

  const doneToday = todayList.filter((entry) => entry.completed).length;

  return {
    today: todayList,
    doneToday,
    totalToday: todayList.length,
    bestStreak,
  };
}

const TZ = "America/Sao_Paulo";

export function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(
      new Date()
    )
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function urgencyStyle(when: number): { borderLeftColor: string } | undefined {
  const hours = (when - Date.now()) / 3_600_000;
  if (hours >= 24) return undefined;
  const intensity = Math.max(0, Math.min(1, 1 - hours / 24));
  const alpha = (0.25 + intensity * 0.6).toFixed(2);
  return { borderLeftColor: `color-mix(in srgb, var(--color-warn) ${Math.round(Number(alpha) * 100)}%, transparent)` };
}
