export interface HabitCompletion {
  date: string;
  completed: boolean;
  count: number;
  locked: boolean;
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  selectedDays: number[];
  targetCount: number;
  /** Duração de uma sessão com timer; null = hábito só de check. */
  durationMinutes: number | null;
  completions: HabitCompletion[];
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface HabitRow {
  id: string;
  name: string;
  icon: string;
  selected_days: number[];
  target_count: number;
  duration_minutes: number | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface HabitCompletionRow {
  habit_id: string;
  date: string;
  count: number;
  locked: boolean;
}

export interface NewHabit {
  name: string;
  icon: string;
  selectedDays: number[];
  targetCount: number;
  durationMinutes: number | null;
}

export interface HabitPatch {
  name?: string;
  icon?: string;
  selectedDays?: number[];
  targetCount?: number;
  durationMinutes?: number | null;
}
