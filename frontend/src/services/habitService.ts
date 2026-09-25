import { del, get, patch, post, put } from "./api";
import type { Habit, HabitFormData } from "../types/habit";

export function fetchHabits(): Promise<Habit[]> {
  return get<Habit[]>("/api/habits");
}

export function createHabit(data: HabitFormData): Promise<Habit> {
  return post<Habit>("/api/habits", data);
}

export function updateHabit(id: string, data: HabitFormData): Promise<Habit> {
  return put<Habit>(`/api/habits/${id}`, data);
}

export function reorderHabits(order: string[]): Promise<Habit[]> {
  return post<Habit[]>("/api/habits/reorder", { order });
}

export function deleteHabit(id: string): Promise<void> {
  return del(`/api/habits/${id}`);
}

export function setHabitCompletion(habitId: string, date: string, count: number): Promise<Habit> {
  return patch<Habit>(`/api/habits/${habitId}/completion/${date}`, { count });
}

/** Fim de uma sessão de timer: +1 atômico no servidor, sem passar da meta. */
export function incrementHabitCompletion(habitId: string, date: string): Promise<Habit> {
  return post<Habit>(`/api/habits/${habitId}/completion/${date}/increment`);
}
