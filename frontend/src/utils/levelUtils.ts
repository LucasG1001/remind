import type { DayOfWeek, HabitCompletion } from "../types/habit";
import { addDays, formatDateKey, getDayOfWeek, getToday, isSameDay, spCalendarDay } from "./dateUtils";

export const LEVEL_STEP = 30;
export const LEVEL_DROP_MISSES = 3;

const LEVEL_COLORS: Record<number, string> = {
  1: "var(--level-1)",
  2: "var(--level-2)",
  3: "var(--level-3)",
  4: "var(--level-4)",
  5: "var(--level-5)",
  6: "var(--level-6)",
  7: "var(--level-7)",
};

export interface LevelProgress {
  level: number;
  progress: number;
}

export function getLevelColor(level: number): string {
  if (level >= 8) return "var(--level-8)";
  return LEVEL_COLORS[level] ?? "var(--level-1)";
}

/**
 * Varredura única de createdAt até hoje, só nos dias agendados: LEVEL_STEP concluídos seguidos
 * sobem um nível e zeram o progresso; cada bloco de LEVEL_DROP_MISSES perdidos seguidos derruba um.
 * Hoje ainda não é falta enquanto o dia não fecha.
 */
export function calculateLevelProgress(
  completions: HabitCompletion[],
  selectedDays: DayOfWeek[],
  createdAt: string
): LevelProgress {
  if (selectedDays.length === 0) return { level: 1, progress: 0 };

  const done = new Set(completions.filter((c) => c.completed).map((c) => c.date));
  const today = getToday();
  let date = spCalendarDay(new Date(createdAt));

  let level = 1;
  let progress = 0;
  let misses = 0;

  while (date <= today) {
    if (selectedDays.includes(getDayOfWeek(date))) {
      if (done.has(formatDateKey(date))) {
        misses = 0;
        progress += 1;
        if (progress >= LEVEL_STEP) {
          level += 1;
          progress = 0;
        }
      } else if (!isSameDay(date, today)) {
        progress = 0;
        misses += 1;
        if (misses % LEVEL_DROP_MISSES === 0) level = Math.max(1, level - 1);
      }
    }
    date = addDays(date, 1);
  }

  return { level, progress };
}
