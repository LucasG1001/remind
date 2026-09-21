export interface HabitCompletion {
  date: string;
  completed: boolean;
  count: number;
  locked: boolean;
}

export interface HabitReminder {
  id: string;
  time: string;
  /** Índice na ordem por horário: é ele que decide se o aviso já foi cumprido. */
  index: number;
  /** Acima da meta: fica salvo mas não notifica. */
  active: boolean;
  skippedToday: boolean;
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  selectedDays: number[];
  targetCount: number;
  completions: HabitCompletion[];
  reminders: HabitReminder[];
  /** Horário que o app oferece para desligar; resolvido no servidor. */
  nextReminderId: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface HabitReminderRow {
  id: string;
  habit_id: string;
  time: string;
  skipped: boolean | null;
}

export interface HabitRow {
  id: string;
  name: string;
  icon: string;
  selected_days: number[];
  target_count: number;
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
}

export interface HabitPatch {
  name?: string;
  icon?: string;
  selectedDays?: number[];
  targetCount?: number;
}
