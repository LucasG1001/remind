import type { DayOfWeek } from "../types/habit";

const SP_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Dia-calendário de São Paulo (UTC-3 fixo) como Date à meia-noite local desse dia. */
export function spCalendarDay(instant: Date): Date {
  const shifted = new Date(instant.getTime() - SP_OFFSET_MS);
  return new Date(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
}

export function spDateKey(instant: Date): string {
  return formatDateKey(spCalendarDay(instant));
}

/** Diferença em dias-calendário de SP entre dois instantes (ms). */
export function diffDaysFromToday(whenMs: number, nowMs: number): number {
  const a = spCalendarDay(new Date(nowMs));
  const b = spCalendarDay(new Date(whenMs));
  const au = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bu = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bu - au) / DAY_MS);
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateDisplay(isoString: string): string {
  const date = spCalendarDay(new Date(isoString));
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDateBR(dateKey: string): string {
  const [year, month, day] = dateKey.split("-");
  return `${day}/${month}/${year}`;
}

export function getDayOfWeek(date: Date): DayOfWeek {
  return date.getDay() as DayOfWeek;
}

export function isScheduledDay(date: Date, selectedDays: DayOfWeek[]): boolean {
  return selectedDays.includes(getDayOfWeek(date));
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getToday(): Date {
  return spCalendarDay(new Date());
}

export function getTodayKey(): string {
  return formatDateKey(getToday());
}

/** Segunda-feira da semana à qual a data pertence. */
export function startOfWeek(date: Date): Date {
  const dow = getDayOfWeek(date);
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

/** Os 7 dias da semana atual, de segunda a domingo. */
export function getWeekDays(): Date[] {
  const monday = startOfWeek(getToday());
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function parseDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year!, month! - 1, day);
}
