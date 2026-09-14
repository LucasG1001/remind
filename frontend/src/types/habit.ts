export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface HabitCompletion {
  date: string;
  completed: boolean;
  count: number;
  locked?: boolean;
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  selectedDays: DayOfWeek[];
  targetCount: number;
  completions: HabitCompletion[];
  currentStreak: number;
  longestStreak: number;
  level: number;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface HabitFormData {
  name: string;
  icon: string;
  selectedDays: DayOfWeek[];
  targetCount: number;
}
