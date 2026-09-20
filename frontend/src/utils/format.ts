import type { Reminder, RecurUnit } from "../types/reminder";
import { WEEKDAYS_PT } from "./weekdays";
import { diffDaysFromToday } from "./dateUtils";

const TZ = "America/Sao_Paulo";

const UNIT_EVERY: Record<RecurUnit, string> = {
  day: "Todos os dias",
  week: "Toda semana",
  month: "Todo mês",
  year: "Todo ano",
};
const UNIT_PLURAL: Record<RecurUnit, string> = {
  day: "dias",
  week: "semanas",
  month: "meses",
  year: "anos",
};

/** Instante (ms UTC) a partir de "YYYY-MM-DD" + "HH:MM" no fuso fixo de SP (UTC-3, sem DST). */
export function spInstant(date: string, time: string | null): number {
  return Date.parse(`${date}T${time && time.length ? time : "00:00"}:00-03:00`);
}

/** Quebra o event_at (UTC) em campos de formulário no fuso de São Paulo. */
export function toFormParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return { date, time };
}

export function recurrenceLabel(reminder: Reminder): string | null {
  if (!reminder.recurInterval || !reminder.recurUnit) return null;
  const n = reminder.recurInterval;
  let base =
    n === 1
      ? UNIT_EVERY[reminder.recurUnit]
      : `A cada ${n} ${UNIT_PLURAL[reminder.recurUnit]}`;
  if (reminder.recurWeekday !== null) {
    base = `${base}, ${WEEKDAYS_PT[reminder.recurWeekday]!.toLowerCase()}`;
  }
  if (reminder.recurMode === "relative") {
    base = `${base} (a partir da conclusão)`;
  }
  return base;
}

export function formatRemaining(targetMs: number, nowMs: number): string {
  const diff = targetMs - nowMs;
  if (diff < 60_000) return "agora";

  const totalMinutes = Math.floor(diff / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? "dia" : "dias"}`);
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hora" : "horas"}`);
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? "minuto" : "minutos"}`);

  return parts.join(" ");
}

/** Rótulo curto de atraso para a lista: "há 2 meses", "há 27 dias", "há 3 horas". */
export function shortOverdueLabel(targetMs: number, nowMs: number): string {
  const days = -diffDaysFromToday(targetMs, nowMs);
  if (days >= 60) return `há ${Math.floor(days / 30)} meses`;
  if (days >= 30) return "há 1 mês";
  if (days >= 1) return `há ${days} ${days === 1 ? "dia" : "dias"}`;
  const hours = Math.floor((nowMs - targetMs) / 3_600_000);
  if (hours >= 1) return `há ${hours} ${hours === 1 ? "hora" : "horas"}`;
  return "atrasado";
}

export function remainingLabel(targetMs: number, nowMs: number): { text: string; overdue: boolean } {
  if (targetMs > nowMs) {
    return { text: `faltam ${formatRemaining(targetMs, nowMs)}`, overdue: false };
  }
  const elapsed = formatRemaining(nowMs, targetMs);
  return { text: elapsed === "agora" ? "atrasado" : `atrasado ${elapsed}`, overdue: true };
}

/** Contagem por dias para itens de dia inteiro (sem horário): hoje / amanhã / faltam N dias. */
export function dayRemainingLabel(targetMs: number, nowMs: number): { text: string; overdue: boolean } {
  const diff = diffDaysFromToday(targetMs, nowMs);
  if (diff === 0) return { text: "hoje", overdue: false };
  if (diff === 1) return { text: "amanhã", overdue: false };
  if (diff > 1) return { text: `faltam ${diff} dias`, overdue: false };
  if (diff === -1) return { text: "atrasado 1 dia", overdue: true };
  return { text: `atrasado ${-diff} dias`, overdue: true };
}
