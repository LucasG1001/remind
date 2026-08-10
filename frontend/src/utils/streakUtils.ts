import type { DayOfWeek, Habit, HabitCompletion } from "../types/habit";
import { addDays, formatDateKey, getDayOfWeek, getToday, isSameDay } from "./dateUtils";

function isCompletedOnDate(completions: HabitCompletion[], dateKey: string): boolean {
  return completions.some((c) => c.date === dateKey && c.completed);
}

export function calculateCurrentStreak(
  completions: HabitCompletion[],
  selectedDays: DayOfWeek[]
): number {
  const today = getToday();
  const todayKey = formatDateKey(today);
  let streak = 0;
  let date = new Date(today);

  if (selectedDays.includes(getDayOfWeek(today))) {
    if (isCompletedOnDate(completions, todayKey)) {
      streak = 1;
    }
    date = addDays(date, -1);
  } else {
    date = addDays(date, -1);
  }

  while (true) {
    if (!selectedDays.includes(getDayOfWeek(date))) {
      date = addDays(date, -1);
      continue;
    }

    const key = formatDateKey(date);
    if (isCompletedOnDate(completions, key)) {
      streak++;
      date = addDays(date, -1);
    } else {
      break;
    }
  }

  return streak;
}

export function calculateLongestStreak(
  completions: HabitCompletion[],
  selectedDays: DayOfWeek[],
  createdAt: string
): number {
  const today = getToday();
  const startDate = new Date(createdAt);
  startDate.setHours(0, 0, 0, 0);

  let longest = 0;
  let current = 0;
  let date = new Date(startDate);

  while (date <= today) {
    if (selectedDays.includes(getDayOfWeek(date))) {
      const key = formatDateKey(date);
      const isTodayAndNotDone = isSameDay(date, today) && !isCompletedOnDate(completions, key);

      if (isCompletedOnDate(completions, key)) {
        current++;
        if (current > longest) {
          longest = current;
        }
      } else if (isTodayAndNotDone) {
        // pass
      } else {
        current = 0;
      }
    }
    date = addDays(date, 1);
  }

  return longest;
}

type DayStatus = "complete" | "incomplete" | "neutral";

function startOfDay(isoOrDate: string | Date): Date {
  const d = new Date(isoOrDate);
  d.setHours(0, 0, 0, 0);
  return d;
}

function combinedDayStatus(habits: Habit[], date: Date): DayStatus {
  const key = formatDateKey(date);
  const weekday = getDayOfWeek(date);
  let scheduled = 0;
  let done = 0;

  for (const habit of habits) {
    if (date < startOfDay(habit.createdAt)) continue;
    if (!habit.selectedDays.includes(weekday)) continue;
    scheduled++;
    if (isCompletedOnDate(habit.completions, key)) done++;
  }

  if (scheduled === 0) return "neutral";
  return done === scheduled ? "complete" : "incomplete";
}

function earliestCreatedDay(habits: Habit[]): Date {
  let earliest = getToday();
  for (const habit of habits) {
    const created = startOfDay(habit.createdAt);
    if (created < earliest) earliest = created;
  }
  return earliest;
}

export function calculateCombinedStreak(habits: Habit[]): { current: number; longest: number } {
  if (habits.length === 0) return { current: 0, longest: 0 };

  const today = getToday();
  const earliest = earliestCreatedDay(habits);

  let current = 0;
  if (combinedDayStatus(habits, today) === "complete") current = 1;
  let date = addDays(today, -1);
  while (date >= earliest) {
    const status = combinedDayStatus(habits, date);
    if (status === "complete") {
      current++;
    } else if (status === "incomplete") {
      break;
    }
    date = addDays(date, -1);
  }

  let longest = 0;
  let run = 0;
  date = new Date(earliest);
  while (date <= today) {
    const status = combinedDayStatus(habits, date);
    if (status === "complete") {
      run++;
      if (run > longest) longest = run;
    } else if (status === "incomplete" && !isSameDay(date, today)) {
      run = 0;
    }
    date = addDays(date, 1);
  }

  return { current, longest };
}

/** Percentual de dias agendados concluídos na janela recente; null se nada foi agendado. */
export function calculateRecentRate(
  completions: HabitCompletion[],
  selectedDays: DayOfWeek[],
  createdAt: string,
  windowDays = 30
): number | null {
  const today = getToday();
  const createdDay = startOfDay(createdAt);
  let scheduled = 0;
  let done = 0;

  for (let i = 0; i < windowDays; i++) {
    const date = addDays(today, -i);
    if (date < createdDay) break;
    if (!selectedDays.includes(getDayOfWeek(date))) continue;
    scheduled++;
    if (isCompletedOnDate(completions, formatDateKey(date))) done++;
  }

  if (scheduled === 0) return null;
  return Math.round((done / scheduled) * 100);
}

export function hasConsecutiveMissedDays(
  completions: HabitCompletion[],
  selectedDays: DayOfWeek[]
): boolean {
  const today = getToday();
  let missedCount = 0;
  let date = addDays(today, -1);

  for (let i = 0; i < 30; i++) {
    if (selectedDays.includes(getDayOfWeek(date))) {
      const key = formatDateKey(date);
      if (!isCompletedOnDate(completions, key)) {
        missedCount++;
        if (missedCount >= 2) {
          return true;
        }
      } else {
        break;
      }
    }
    date = addDays(date, -1);
  }

  return false;
}
