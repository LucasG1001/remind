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
  startTime: string | null;
  endTime: string | null;
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
  // pg devolve TIME como "HH:MM:SS" — o mapper toHabit corta para "HH:MM".
  start_time: string | null;
  end_time: string | null;
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
  startTime: string | null;
  endTime: string | null;
}

export interface HabitPatch {
  name?: string;
  icon?: string;
  selectedDays?: number[];
  targetCount?: number;
  startTime?: string | null;
  endTime?: string | null;
}
