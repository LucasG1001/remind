export type ReminderStatus = "active" | "done" | "cancelled";

/** Fases da máquina de estados. Com hora: pending→pre(30min)→due(5min)→at→nag. Dia inteiro: pending→day_before→morning. `snoozed` é entrada manual (soneca) de qualquer fase. */
export type ReminderPhase = "pending" | "pre" | "due" | "at" | "nag" | "day_before" | "morning" | "snoozed";

export type RecurUnit = "day" | "week" | "month" | "year";

/** Como a próxima ocorrência é calculada: fixa na grade da série ou a partir da conclusão. */
export type RecurMode = "fixed" | "relative";

export interface Reminder {
  id: string;
  title: string;
  notes: string | null;
  eventAt: string;
  isAllDay: boolean;
  recurInterval: number | null;
  recurUnit: RecurUnit | null;
  recurWeekday: number | null;
  recurMode: RecurMode;
  recurAnchorAt: string | null;
  /** Calculado (não persistido): próxima ocorrência da grade — só para recorrentes fixos, senão null. */
  nextOccurrenceAt: string | null;
  status: ReminderStatus;
  phase: ReminderPhase;
  nextNotifyAt: string | null;
  notifyCount: number;
  maxNotify: number;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderRow {
  id: string;
  title: string;
  notes: string | null;
  event_at: string;
  is_all_day: boolean;
  recur_interval: number | null;
  recur_unit: RecurUnit | null;
  recur_weekday: number | null;
  recur_mode: RecurMode;
  recur_anchor_at: string | null;
  status: ReminderStatus;
  phase: ReminderPhase;
  next_notify_at: string | null;
  notify_count: number;
  max_notify: number;
  acknowledged: boolean;
  acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Linha pronta para INSERT (já com event_at/phase/next_notify_at resolvidos pelo serviço). */
export interface NewReminder {
  title: string;
  notes: string | null;
  eventAt: Date;
  isAllDay: boolean;
  recurInterval: number | null;
  recurUnit: RecurUnit | null;
  recurWeekday: number | null;
  recurMode: RecurMode;
  recurAnchorAt: Date | null;
  maxNotify: number;
  phase: ReminderPhase;
  nextNotifyAt: Date | null;
}

/** Campos atualizáveis (UPDATE dinâmico). Aceita Date para colunas de timestamp. */
export interface ReminderPatch {
  title?: string;
  notes?: string | null;
  eventAt?: Date;
  isAllDay?: boolean;
  recurInterval?: number | null;
  recurUnit?: RecurUnit | null;
  recurWeekday?: number | null;
  recurMode?: RecurMode;
  recurAnchorAt?: Date | null;
  maxNotify?: number;
  status?: ReminderStatus;
  phase?: ReminderPhase;
  nextNotifyAt?: Date | null;
  notifyCount?: number;
  acknowledged?: boolean;
  acknowledgedAt?: Date | null;
}
