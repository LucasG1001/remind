import { spDateKey } from "./dateUtils";

/**
 * Sessão de timer de um hábito. O restante é sempre derivado de timestamps, nunca
 * decrementado: aba em segundo plano (setInterval estrangulado) ou reload não atrasam.
 */
export interface HabitTimer {
  habitId: string;
  habitName: string;
  /** Dia de SP do início: a sessão que cruza a meia-noite conta no dia em que começou. */
  dateKey: string;
  durationMs: number;
  startedAt: number;
  pausedAt: number | null;
  pausedMs: number;
}

export function startTimer(
  habit: { id: string; name: string; durationMinutes: number },
  now: number
): HabitTimer {
  return {
    habitId: habit.id,
    habitName: habit.name,
    dateKey: spDateKey(new Date(now)),
    durationMs: habit.durationMinutes * 60_000,
    startedAt: now,
    pausedAt: null,
    pausedMs: 0,
  };
}

export function remainingMs(timer: HabitTimer, now: number): number {
  const elapsed = (timer.pausedAt ?? now) - timer.startedAt - timer.pausedMs;
  return Math.max(0, timer.durationMs - elapsed);
}

export function isFinished(timer: HabitTimer, now: number): boolean {
  return remainingMs(timer, now) === 0;
}

export function pauseTimer(timer: HabitTimer, now: number): HabitTimer {
  return timer.pausedAt === null ? { ...timer, pausedAt: now } : timer;
}

export function resumeTimer(timer: HabitTimer, now: number): HabitTimer {
  if (timer.pausedAt === null) return timer;
  return { ...timer, pausedAt: null, pausedMs: timer.pausedMs + (now - timer.pausedAt) };
}

/** Arredonda para cima: "00:00" só aparece quando o tempo acabou de fato. */
export function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** O storage é entrada externa (outra versão do app, edição manual): valida a forma. */
export function parseStoredTimer(raw: string | null): HabitTimer | null {
  if (!raw) return null;
  try {
    const t = JSON.parse(raw) as Partial<HabitTimer>;
    const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
    if (
      typeof t.habitId !== "string" ||
      typeof t.habitName !== "string" ||
      typeof t.dateKey !== "string" ||
      !isNum(t.durationMs) ||
      !isNum(t.startedAt) ||
      !isNum(t.pausedMs) ||
      !(t.pausedAt === null || isNum(t.pausedAt))
    ) {
      return null;
    }
    return t as HabitTimer;
  } catch {
    return null;
  }
}
