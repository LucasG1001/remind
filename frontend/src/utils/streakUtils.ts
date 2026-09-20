import type { DayOfWeek, HabitCompletion } from "../types/habit";
import { addDays, formatDateKey, getDayOfWeek, getToday } from "./dateUtils";

function isCompletedOnDate(completions: HabitCompletion[], dateKey: string): boolean {
  return completions.some((c) => c.date === dateKey && c.completed);
}

export function calculateCurrentStreak(
  completions: HabitCompletion[],
  selectedDays: DayOfWeek[]
): number {
  // Sem dias agendados o laço de trás para frente nunca acharia um dia para parar.
  if (selectedDays.length === 0) return 0;

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

export function streakLabel(streak: number): string {
  if (streak <= 0) return "sequência zerada";
  return `${streak} ${streak === 1 ? "dia seguido" : "dias seguidos"}`;
}
