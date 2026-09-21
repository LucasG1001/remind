import { fromSpParts, toSpParts } from "../lib/dateUtils.js";

export const NAG_INTERVAL_MIN = 5;
export const NAG_SLOTS = 5;
/** Janela de insistência: avisos em +0/5/10/15/20 e fecha em +25. */
export const NAG_WINDOW_MIN = NAG_INTERVAL_MIN * NAG_SLOTS;

export interface HabitReminderSlot {
  id: string;
  /** "HH:MM" no fuso de SP. */
  time: string;
  skipped: boolean;
  lastSentAt: Date | null;
}

export interface HabitTickInput {
  habitId: string;
  habitName: string;
  targetCount: number;
  selectedDays: number[];
  /** Ordenados por `time` — a ordem define o índice de cada horário. */
  slots: HabitReminderSlot[];
  /** Conclusões de hoje; pode exceder targetCount se a meta baixou depois. */
  count: number;
  locked: boolean;
  todayKey: string;
  now: Date;
}

export interface HabitTickSend {
  slotId: string;
  slotIndex: number;
  time: string;
  /** Instante de grade que justificou este envio — é o que grava em last_sent_at. */
  firedAt: Date;
}

function slotDueAt(todayKey: string, time: string): Date {
  const [y, mo, d] = todayKey.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return fromSpParts(y!, mo! - 1, d!, h!, mi!);
}

function endOfSpDay(todayKey: string): Date {
  const [y, mo, d] = todayKey.split("-").map(Number);
  return fromSpParts(y!, mo! - 1, d! + 1, 0, 0);
}

/**
 * Decide se um hábito deve avisar agora. Função pura.
 *
 * Só o horário pendente mais antigo avisa — cada notificação pede um check, e ao
 * receber o check a fila anda sozinha para o próximo horário.
 *
 * "Cumprido" é derivado, nunca gravado: o horário de índice k está cumprido se
 * `k < min(count, targetCount, slots.length)`. É isso que faz desfazer um check
 * reativar o horário correspondente sem escrita nenhuma. O `min` triplo importa
 * porque `count` pode exceder a meta — o clamp do banco só vale na escrita, e
 * baixar a meta depois deixa a contagem antiga para trás.
 */
export function decideHabitTick(input: HabitTickInput): HabitTickSend | null {
  const { slots, targetCount, selectedDays, count, locked, todayKey, now } = input;

  if (locked) return null;
  if (slots.length === 0) return null;

  const weekday = toSpParts(now).weekday;
  if (!selectedDays.includes(weekday)) return null;

  const active = Math.min(targetCount, slots.length);
  const satisfiedThrough = Math.min(count, active);
  const dayEnd = endOfSpDay(todayKey);

  for (let index = satisfiedThrough; index < active; index++) {
    const slot = slots[index]!;
    if (slot.skipped) continue;

    const dueAt = slotDueAt(todayKey, slot.time);
    if (now < dueAt) return null; // ainda não chegou: nenhum posterior avisa antes

    const next = slots[index + 1];
    const windowEnd = Math.min(
      dueAt.getTime() + NAG_WINDOW_MIN * 60_000,
      next ? slotDueAt(todayKey, next.time).getTime() : Infinity,
      dayEnd.getTime()
    );
    if (now.getTime() >= windowEnd) continue; // janela passou: tenta o seguinte

    // Alinhado à grade dueAt + k*5min: com tick de 60s, `now + 5min` acumularia
    // até 59s de deriva a cada insistência.
    const elapsed = now.getTime() - dueAt.getTime();
    const step = Math.floor(elapsed / (NAG_INTERVAL_MIN * 60_000));
    const firedAt = new Date(dueAt.getTime() + step * NAG_INTERVAL_MIN * 60_000);
    if (slot.lastSentAt && slot.lastSentAt.getTime() >= firedAt.getTime()) return null;

    return { slotId: slot.id, slotIndex: index, time: slot.time, firedAt };
  }

  return null;
}

/** O horário que o app mostra como "próximo aviso" e alvo do botão de desligar. */
export function nextPendingSlot(input: HabitTickInput): { slot: HabitReminderSlot; index: number } | null {
  const { slots, targetCount, count, locked, selectedDays, now } = input;
  if (locked || slots.length === 0) return null;
  if (!selectedDays.includes(toSpParts(now).weekday)) return null;

  const active = Math.min(targetCount, slots.length);
  const satisfiedThrough = Math.min(count, active);
  for (let index = satisfiedThrough; index < active; index++) {
    const slot = slots[index]!;
    const dueAt = slotDueAt(input.todayKey, slot.time);
    const next = slots[index + 1];
    const windowEnd = Math.min(
      dueAt.getTime() + NAG_WINDOW_MIN * 60_000,
      next ? slotDueAt(input.todayKey, next.time).getTime() : Infinity,
      endOfSpDay(input.todayKey).getTime()
    );
    if (now.getTime() < windowEnd) return { slot, index };
  }
  return null;
}
