import type { RecurUnit } from "../types/reminder.js";

/**
 * Fuso fixo do app: America/Sao_Paulo. O Brasil não usa horário de verão desde
 * 2019, então tratamos como offset constante UTC-3. Toda a matemática de fuso
 * fica isolada aqui — para trocar de fuso/lidar com DST, mexe só neste módulo.
 */
const SP_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface SpParts {
  year: number;
  month: number; // 0-11
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0=domingo ... 6=sábado
}

/** Componentes locais (SP) de um instante UTC. */
export function toSpParts(date: Date): SpParts {
  const shifted = new Date(date.getTime() - SP_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

/** Instante UTC a partir de componentes locais (SP). Overflow de dia/mês normaliza. */
export function fromSpParts(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month, day, hour, minute) + SP_OFFSET_MS);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Mesma data-base deslocada em dias, fixando hora:minuto no fuso local (SP). */
export function spDateAtTime(base: Date, dayDelta: number, hour: number, minute: number): Date {
  const p = toSpParts(base);
  return fromSpParts(p.year, p.month, p.day + dayDelta, hour, minute);
}

/**
 * Chave "YYYY-MM-DD" do dia-calendário de SP. É a chave de `habit_completions.date`
 * e do runtime dos avisos de hábito — no caminho da notificação quem manda é o
 * servidor, para não divergir de um aparelho em outro fuso.
 */
export function spDateKey(date: Date): string {
  const p = toSpParts(date);
  return `${p.year}-${String(p.month + 1).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Parse de "YYYY-MM-DD" + "HH:MM" opcional como horário local (SP) → instante UTC. */
export function parseEventAt(date: string, time: string | null): Date {
  const [y, mo, d] = date.split("-").map(Number);
  if (time) {
    const [h, mi] = time.split(":").map(Number);
    return fromSpParts(y, mo - 1, d, h, mi);
  }
  return fromSpParts(y, mo - 1, d, 0, 0);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Evento está no passado? Dia inteiro compara por dia local (SP) — "hoje" ainda
 * é válido de tarde; com hora compara por instante, tolerando o minuto corrente.
 */
export function isPastEvent(eventAt: Date, isAllDay: boolean, now: Date): boolean {
  if (isAllDay) {
    const eventDay = spDateAtTime(eventAt, 0, 0, 0).getTime();
    const today = spDateAtTime(now, 0, 0, 0).getTime();
    return eventDay < today;
  }
  const nowMinute = Math.floor(now.getTime() / 60000) * 60000;
  return eventAt.getTime() < nowMinute;
}

/** `a` cai em/depois de `b`? Dia inteiro compara por dia (SP); com hora, por instante. */
export function isOnOrAfter(a: Date, b: Date, isAllDay: boolean): boolean {
  if (isAllDay) {
    return spDateAtTime(a, 0, 0, 0).getTime() >= spDateAtTime(b, 0, 0, 0).getTime();
  }
  return a.getTime() >= b.getTime();
}

/**
 * Próxima ocorrência somando intervalo × unidade ao event_at. month/year fazem
 * soma de calendário com clamp de fim-de-mês; se houver weekday, avança até o dia
 * da semana alvo (ex: "a cada 6 meses aos sábados").
 */
export function computeNextOccurrence(
  eventAt: Date,
  interval: number,
  unit: RecurUnit,
  weekday: number | null
): Date {
  const p = toSpParts(eventAt);
  let next: Date;

  if (unit === "day") {
    next = fromSpParts(p.year, p.month, p.day + interval, p.hour, p.minute);
  } else if (unit === "week") {
    next = fromSpParts(p.year, p.month, p.day + interval * 7, p.hour, p.minute);
  } else if (unit === "month") {
    const total = p.month + interval;
    const year = p.year + Math.floor(total / 12);
    const month = ((total % 12) + 12) % 12;
    const day = Math.min(p.day, daysInMonth(year, month));
    next = fromSpParts(year, month, day, p.hour, p.minute);
  } else {
    const year = p.year + interval;
    const day = Math.min(p.day, daysInMonth(year, p.month));
    next = fromSpParts(year, p.month, day, p.hour, p.minute);
  }

  if (weekday !== null) {
    for (let i = 0; i < 7; i++) {
      if (toSpParts(next).weekday === weekday) break;
      next = new Date(next.getTime() + DAY_MS);
    }
  }

  return next;
}
