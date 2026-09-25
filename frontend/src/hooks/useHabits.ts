import { useEffect } from "react";
import type { Habit, HabitFormData } from "../types/habit";
import {
  fetchHabits,
  createHabit as apiCreateHabit,
  updateHabit as apiUpdateHabit,
  deleteHabit as apiDeleteHabit,
  reorderHabits as apiReorderHabits,
  setHabitCompletion,
} from "../services/habitService";
import { useFetchList } from "./useFetchList";
import { calculateCurrentStreak } from "../utils/streakUtils";
import { calculateLevelProgress } from "../utils/levelUtils";

interface UseHabitsReturn {
  habits: Habit[];
  loading: boolean;
  error: string | null;
  createHabit: (data: HabitFormData) => Promise<Habit>;
  updateHabit: (id: string, data: HabitFormData) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  reorderHabits: (orderedIds: string[]) => Promise<void>;
  setCompletion: (habitId: string, date: string, count: number) => Promise<void>;
  reload: () => void;
}

function recalculateHabitStats(habit: Habit): Habit {
  const currentStreak = calculateCurrentStreak(habit.completions, habit.selectedDays);
  const { level, progress } = calculateLevelProgress(
    habit.completions,
    habit.selectedDays,
    habit.createdAt
  );
  return { ...habit, currentStreak, level, levelProgress: progress };
}

function applyCount(habit: Habit, date: string, count: number): Habit {
  const clamped = Math.max(0, Math.min(count, habit.targetCount));
  const others = habit.completions.filter((c) => c.date !== date);
  const completions =
    clamped <= 0
      ? others
      : [...others, { date, count: clamped, completed: clamped >= habit.targetCount, locked: false }];
  return { ...habit, completions };
}

export function useHabits(): UseHabitsReturn {
  const {
    items: habits,
    setItems: setHabits,
    loading,
    error,
    reload,
  } = useFetchList<Habit>(
    () => fetchHabits().then((data) => data.map(recalculateHabitStats)),
    "Não foi possível carregar os hábitos."
  );

  async function createHabit(data: HabitFormData): Promise<Habit> {
    const created = await apiCreateHabit(data);
    setHabits((prev) => [...prev, recalculateHabitStats(created)]);
    return created;
  }

  async function updateHabit(id: string, data: HabitFormData): Promise<void> {
    const updated = await apiUpdateHabit(id, data);
    setHabits((prev) => prev.map((h) => (h.id === id ? recalculateHabitStats(updated) : h)));
  }

  async function deleteHabit(id: string): Promise<void> {
    await apiDeleteHabit(id);
    setHabits((prev) => prev.filter((h) => h.id !== id));
  }

  async function setCompletion(habitId: string, date: string, count: number): Promise<void> {
    let previous: Habit[] = [];
    setHabits((prev) => {
      previous = prev;
      return prev.map((h) => (h.id === habitId ? recalculateHabitStats(applyCount(h, date, count)) : h));
    });
    try {
      const updated = await setHabitCompletion(habitId, date, count);
      setHabits((prev) => prev.map((h) => (h.id === habitId ? recalculateHabitStats(updated) : h)));
    } catch (err) {
      setHabits(previous);
      throw err;
    }
  }

  async function reorderHabits(orderedIds: string[]): Promise<void> {
    let previous: Habit[] = [];
    setHabits((prev) => {
      previous = prev;
      const byId = new Map(prev.map((h) => [h.id, h]));
      const next = orderedIds.map((id) => byId.get(id)).filter((h): h is Habit => Boolean(h));
      return next.length === prev.length ? next : prev;
    });
    try {
      const updated = await apiReorderHabits(orderedIds);
      setHabits(updated.map(recalculateHabitStats));
    } catch {
      setHabits(previous);
    }
  }

  // O fim de um timer registra o check pelo HabitTimerProvider, fora deste hook.
  useEffect(() => {
    window.addEventListener("habit-updated", reload);
    return () => window.removeEventListener("habit-updated", reload);
  }, [reload]);

  return {
    habits,
    loading,
    error,
    createHabit,
    updateHabit,
    deleteHabit,
    reorderHabits,
    setCompletion,
    reload,
  };
}
