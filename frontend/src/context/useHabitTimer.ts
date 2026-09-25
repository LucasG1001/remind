import { createContext, useContext } from "react";
import type { Habit } from "../types/habit";
import type { HabitTimer } from "../utils/habitTimer";

export interface HabitTimerRinging {
  habitId: string;
  habitName: string;
}

export interface HabitTimerContextValue {
  timer: HabitTimer | null;
  remaining: number;
  ringing: HabitTimerRinging | null;
  start: (habit: Habit) => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  stopRinging: () => void;
}

export const HabitTimerContext = createContext<HabitTimerContextValue | null>(null);

export function useHabitTimer(): HabitTimerContextValue {
  const ctx = useContext(HabitTimerContext);
  if (!ctx) throw new Error("useHabitTimer precisa estar dentro de HabitTimerProvider.");
  return ctx;
}
