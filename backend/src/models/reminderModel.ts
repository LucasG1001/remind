import type { PoolClient } from "pg";
import { pool } from "../database/connection.js";
import { updateById, type Db } from "../database/transaction.js";
import { buildUpdateSet } from "../lib/sqlUpdate.js";
import { computeNextOccurrence } from "../lib/dateUtils.js";
import type { NewReminder, Reminder, ReminderPatch, ReminderRow, ReminderStatus } from "../types/reminder.js";

function nextOccurrenceOf(row: ReminderRow): string | null {
  if (!row.recur_interval || !row.recur_unit || row.recur_mode !== "fixed") return null;
  return computeNextOccurrence(
    new Date(row.recur_anchor_at ?? row.event_at),
    row.recur_interval,
    row.recur_unit,
    row.recur_weekday
  ).toISOString();
}

function toReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    eventAt: row.event_at,
    isAllDay: row.is_all_day,
    recurInterval: row.recur_interval,
    recurUnit: row.recur_unit,
    recurWeekday: row.recur_weekday,
    recurMode: row.recur_mode,
    recurAnchorAt: row.recur_anchor_at,
    nextOccurrenceAt: nextOccurrenceOf(row),
    status: row.status,
    phase: row.phase,
    nextNotifyAt: row.next_notify_at,
    notifyCount: row.notify_count,
    maxNotify: row.max_notify,
    acknowledged: row.acknowledged,
    acknowledgedAt: row.acknowledged_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findAll(status?: ReminderStatus): Promise<Reminder[]> {
  const result = status
    ? await pool.query<ReminderRow>(
        "SELECT * FROM reminders WHERE status = $1 ORDER BY next_notify_at ASC NULLS LAST, event_at ASC",
        [status]
      )
    : await pool.query<ReminderRow>(
        "SELECT * FROM reminders ORDER BY next_notify_at ASC NULLS LAST, event_at ASC"
      );
  return result.rows.map(toReminder);
}

export async function findById(id: string): Promise<Reminder | null> {
  const result = await pool.query<ReminderRow>("SELECT * FROM reminders WHERE id = $1", [id]);
  return result.rows[0] ? toReminder(result.rows[0]) : null;
}

/** Lembretes ativos com disparo já vencido — consumidos pelo scheduler. */
export async function findDue(now: Date, limit: number): Promise<Reminder[]> {
  const result = await pool.query<ReminderRow>(
    `SELECT * FROM reminders
      WHERE status = 'active' AND next_notify_at IS NOT NULL AND next_notify_at <= $1
      ORDER BY next_notify_at ASC
      LIMIT $2`,
    [now, limit]
  );
  return result.rows.map(toReminder);
}

export async function create(entry: NewReminder): Promise<Reminder> {
  const result = await pool.query<ReminderRow>(
    `INSERT INTO reminders
       (title, notes, event_at, is_all_day, recur_interval, recur_unit, recur_weekday, recur_mode, recur_anchor_at, max_notify, phase, next_notify_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      entry.title,
      entry.notes,
      entry.eventAt,
      entry.isAllDay,
      entry.recurInterval,
      entry.recurUnit,
      entry.recurWeekday,
      entry.recurMode,
      entry.recurAnchorAt,
      entry.maxNotify,
      entry.phase,
      entry.nextNotifyAt,
    ]
  );
  return toReminder(result.rows[0]);
}

const COLUMN_MAP: Record<keyof ReminderPatch, string> = {
  title: "title",
  notes: "notes",
  eventAt: "event_at",
  isAllDay: "is_all_day",
  recurInterval: "recur_interval",
  recurUnit: "recur_unit",
  recurWeekday: "recur_weekday",
  recurMode: "recur_mode",
  recurAnchorAt: "recur_anchor_at",
  maxNotify: "max_notify",
  status: "status",
  phase: "phase",
  nextNotifyAt: "next_notify_at",
  notifyCount: "notify_count",
  acknowledged: "acknowledged",
  acknowledgedAt: "acknowledged_at",
};

/**
 * Relê a linha com FOR UPDATE dentro de uma transação. O scheduler decide sobre
 * este estado, e não sobre o do batch: entre o findDue e a escrita o usuário pode
 * ter sonecado ou concluído pela notificação.
 */
export async function lockById(client: PoolClient, id: string): Promise<Reminder | null> {
  const result = await client.query<ReminderRow>(
    "SELECT * FROM reminders WHERE id = $1 FOR UPDATE",
    [id]
  );
  return result.rows[0] ? toReminder(result.rows[0]) : null;
}

export async function update(id: string, patch: ReminderPatch, db?: Db): Promise<Reminder | null> {
  const { sets, values, nextIndex } = buildUpdateSet(patch, COLUMN_MAP);
  const row = await updateById<ReminderRow>("reminders", id, sets, values, nextIndex, db);
  return row ? toReminder(row) : null;
}

export async function remove(id: string): Promise<boolean> {
  const result = await pool.query("DELETE FROM reminders WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}
