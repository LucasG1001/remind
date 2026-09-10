/**
 * Janela de horário de um hábito ("HH:MM" → "HH:MM").
 *
 * Espelhado em frontend/src/utils/timeWindow.ts — mantenha os dois em sincronia
 * (mesma convenção do par dateUtils backend/frontend).
 */

export const MIN_HABIT_DURATION_MIN = 15;
export const QUARTER_MIN = 15;
const MINUTES_IN_DAY = 24 * 60;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export type TimeWindowIssue = "incomplete" | "reversed" | "tooShort";

export const TIME_WINDOW_MESSAGES: Record<TimeWindowIssue, string> = {
  incomplete: "Informe o início e o fim do horário.",
  reversed: "O fim deve ser depois do início — o hábito não pode virar a madrugada.",
  tooShort: "O horário deve durar pelo menos 15 minutos.",
};

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/** "19:15" → 1155. Fora de HH:MM válido → null. */
export function parseTimeToMinutes(value: string): number | null {
  if (!isValidTime(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours! * 60 + minutes!;
}

/** 1155 → "19:15". */
export function minutesToTime(minutes: number): string {
  const total = Math.trunc(minutes);
  if (!Number.isFinite(total) || total < 0 || total >= MINUTES_IN_DAY) {
    throw new RangeError(`Minuto fora do dia: ${minutes}`);
  }
  const hours = Math.floor(total / 60);
  return `${String(hours).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** TIME do pg ("19:15:00") ou "19:15" → "19:15". null → null. */
export function toHhMm(value: string | null): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.slice(0, 5);
  return isValidTime(trimmed) ? trimmed : null;
}

/** ("20:00","20:40") → 40. Negativo quando invertido. Entrada inválida → null. */
export function durationMinutes(start: string, end: string): number | null {
  const startMin = parseTimeToMinutes(start);
  const endMin = parseTimeToMinutes(end);
  if (startMin === null || endMin === null) return null;
  return endMin - startMin;
}

/** ("19:00", 90) → "20:30". Estouraria a meia-noite → null (sem wrap). */
export function addMinutesToTime(start: string, minutes: number): string | null {
  const startMin = parseTimeToMinutes(start);
  if (startMin === null) return null;
  const total = startMin + Math.trunc(minutes);
  if (total < 0 || total >= MINUTES_IN_DAY) return null;
  return minutesToTime(total);
}

/** "07:37" → "07:30". Piso no quarto de hora (o slot visualmente tocado). */
export function floorToQuarter(value: string): string | null {
  const minutes = parseTimeToMinutes(value);
  if (minutes === null) return null;
  return minutesToTime(Math.floor(minutes / QUARTER_MIN) * QUARTER_MIN);
}

/** Única regra da janela. Prioridade: incomplete > reversed > tooShort. */
export function checkTimeWindow(
  start: string | null,
  end: string | null
): TimeWindowIssue | null {
  if (start === null && end === null) return null;
  if (start === null || end === null) return "incomplete";

  const span = durationMinutes(start, end);
  if (span === null) return "incomplete";
  if (span <= 0) return "reversed";
  if (span < MIN_HABIT_DURATION_MIN) return "tooShort";
  return null;
}
