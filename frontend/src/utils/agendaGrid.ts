import type { Habit } from "../types/habit";
import { minutesToTime, parseTimeToMinutes } from "./timeWindow";

export const PX_PER_HOUR = 48;
export const DEFAULT_START_HOUR = 6;
export const END_HOUR = 24;
export const BLOCK_GAP = 4;
export const MIN_BLOCK_HEIGHT = 26;
export const MIN_BLOCK_MINUTES = 15;
export const TALL_BLOCK_HEIGHT = 52;

const MINUTES_IN_DAY = END_HOUR * 60;

export interface HabitEntry {
  habit: Habit;
  count: number;
  target: number;
  completed: boolean;
  startMin: number | null;
  endMin: number | null;
}

export interface AgendaBlock {
  entry: HabitEntry;
  startMin: number;
  minutes: number;
  endMin: number;
  top: number;
  height: number;
  tall: boolean;
  spaceBelow: number;
}

export interface AgendaLayout {
  blocks: AgendaBlock[];
  startHour: number;
  hours: number;
  height: number;
}

/** Aceita 1440 ("24:00"), que minutesToTime recusa por não ser um instante do dia. */
export function formatMinutes(totalMinutes: number): string {
  if (totalMinutes >= MINUTES_IN_DAY) return "24:00";
  return minutesToTime(totalMinutes);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function formatRange(startMin: number, minutes: number): string {
  return `${formatMinutes(startMin)}–${formatMinutes(startMin + minutes)}`;
}

/** "18:00–19:15 · 1 h 15 min" — usado pela grade e pelo SidePanel. */
export function formatSchedule(startTime: string, endTime: string | null): string {
  const startMin = parseTimeToMinutes(startTime);
  if (startMin === null) return "";
  const rawEnd = endTime === null ? null : parseTimeToMinutes(endTime);
  const minutes = Math.max(MIN_BLOCK_MINUTES, (rawEnd ?? startMin) - startMin);
  return `${formatRange(startMin, minutes)} · ${formatDuration(minutes)}`;
}

export function hourTop(minutesOfDay: number, startHour: number): number {
  return ((minutesOfDay - startHour * 60) / 60) * PX_PER_HOUR;
}

/**
 * A grade abre às 06:00, mas estica para trás quando há hábito de madrugada —
 * assim uma única fórmula (hourTop) posiciona linhas, blocos e a linha do agora.
 */
export function computeStartHour(items: HabitEntry[]): number {
  let earliest = DEFAULT_START_HOUR * 60;
  for (const item of items) {
    if (item.startMin !== null && item.startMin < earliest) earliest = item.startMin;
  }
  return Math.max(0, Math.min(DEFAULT_START_HOUR, Math.floor(earliest / 60)));
}

/**
 * Hábito que cruza a meia-noite não é suportado (o backend recusa): um fim
 * anterior ao início degrada para a duração mínima de 15 min.
 */
export function layoutBlocks(items: HabitEntry[], startHour: number): AgendaLayout {
  const hours = END_HOUR - startHour;
  const timed = items
    .filter((entry): entry is HabitEntry & { startMin: number } => entry.startMin !== null)
    .sort((a, b) => a.startMin - b.startMin);

  let prevBottom = -Infinity;
  const blocks: AgendaBlock[] = timed.map((entry) => {
    const minutes = Math.max(MIN_BLOCK_MINUTES, (entry.endMin ?? entry.startMin) - entry.startMin);
    const height = Math.max(MIN_BLOCK_HEIGHT, (minutes / 60) * PX_PER_HOUR - BLOCK_GAP);
    const chrono = hourTop(entry.startMin, startHour);
    const top = Math.max(chrono, prevBottom + BLOCK_GAP);
    prevBottom = top + height;
    return {
      entry,
      startMin: entry.startMin,
      minutes,
      endMin: entry.startMin + minutes,
      top,
      height,
      tall: height >= TALL_BLOCK_HEIGHT,
      spaceBelow: Infinity,
    };
  });

  for (let i = 0; i < blocks.length - 1; i++) {
    const current = blocks[i]!;
    current.spaceBelow = blocks[i + 1]!.top - (current.top + current.height);
  }

  return {
    blocks,
    startHour,
    hours,
    height: Math.max(hours * PX_PER_HOUR, prevBottom === -Infinity ? 0 : prevBottom + BLOCK_GAP),
  };
}

export type HabitState = "pending" | "late" | "done";

export function habitState(
  input: { completed: boolean; endMin: number | null },
  nowMinutes: number
): HabitState {
  if (input.completed) return "done";
  if (input.endMin !== null && input.endMin <= nowMinutes) return "late";
  return "pending";
}
