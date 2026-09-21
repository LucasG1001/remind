export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface HabitCompletion {
  date: string;
  completed: boolean;
  count: number;
  locked?: boolean;
}

export interface HabitReminder {
  id: string;
  time: string;
  index: number;
  /** Acima da meta: fica salvo mas não notifica. */
  active: boolean;
  skippedToday: boolean;
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  selectedDays: DayOfWeek[];
  targetCount: number;
  completions: HabitCompletion[];
  reminders: HabitReminder[];
  /** Resolvido no servidor: o horário que o botão de sino desliga. */
  nextReminderId: string | null;
  currentStreak: number;
  levelProgress: number;
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
