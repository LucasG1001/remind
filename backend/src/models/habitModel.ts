import { pool } from "../database/connection.js";
import { updateById, withTransaction } from "../database/transaction.js";
import { buildUpdateSet, nextPositionSql } from "../lib/sqlUpdate.js";
import { spDateKey } from "../lib/dateUtils.js";
import { nextPendingSlot } from "../services/habitReminderState.js";
import {
  CompletionLockedError,
  DuplicateReminderTimeError,
  ReminderLimitError,
  ReorderMismatchError,
} from "./errors.js";
import type {
  Habit,
  HabitCompletion,
  HabitCompletionRow,
  HabitPatch,
  HabitReminderRow,
  HabitRow,
  NewHabit,
} from "../types/habit.js";

async function touchHabit(habitId: string): Promise<void> {
  await pool.query("UPDATE habits SET updated_at = NOW() WHERE id = $1", [habitId]);
}

function toHabit(
  row: HabitRow,
  completionRows: HabitCompletionRow[],
  reminderRows: HabitReminderRow[] = [],
  now: Date = new Date()
): Habit {
  const todayKey = spDateKey(now);
  const completions = completionRows
    .filter((c) => c.habit_id === row.id)
    .map((c) => ({
      date: c.date,
      count: c.count,
      completed: c.count >= row.target_count,
      locked: c.locked,
    }));

  const slots = reminderRows
    .filter((r) => r.habit_id === row.id)
    .sort((a, b) => a.time.localeCompare(b.time));

  const reminders = slots.map((r, index) => ({
    id: r.id,
    time: r.time,
    index,
    active: index < row.target_count,
    skippedToday: r.skipped === true,
  }));

  const today = completions.find((c) => c.date === todayKey);
  const next = nextPendingSlot({
    habitId: row.id,
    habitName: row.name,
    targetCount: row.target_count,
    selectedDays: row.selected_days,
    slots: slots.map((r) => ({ id: r.id, time: r.time, skipped: r.skipped === true, lastSentAt: null })),
    count: today?.count ?? 0,
    locked: today?.locked ?? false,
    todayKey,
    now,
  });

  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    selectedDays: row.selected_days,
    targetCount: row.target_count,
    completions,
    reminders,
    nextReminderId: next?.slot.id ?? null,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const REMINDER_SELECT = `
  SELECT r.id, r.habit_id, r.time, rt.skipped
    FROM habit_reminders r
    LEFT JOIN habit_reminder_runtime rt
      ON rt.habit_reminder_id = r.id AND rt.date = $1`;

export async function findAll(): Promise<Habit[]> {
  const now = new Date();
  const habits = await pool.query<HabitRow>(
    "SELECT * FROM habits ORDER BY position ASC, created_at ASC"
  );
  const completions = await pool.query<HabitCompletionRow>(
    "SELECT habit_id, date, count, locked FROM habit_completions"
  );
  const reminders = await pool.query<HabitReminderRow>(REMINDER_SELECT, [spDateKey(now)]);
  return habits.rows.map((row) => toHabit(row, completions.rows, reminders.rows, now));
}

export async function findById(id: string): Promise<Habit | null> {
  const now = new Date();
  const habit = await pool.query<HabitRow>("SELECT * FROM habits WHERE id = $1", [id]);
  if (!habit.rows[0]) return null;
  const completions = await pool.query<HabitCompletionRow>(
    "SELECT habit_id, date, count, locked FROM habit_completions WHERE habit_id = $1",
    [id]
  );
  const reminders = await pool.query<HabitReminderRow>(
    `${REMINDER_SELECT} WHERE r.habit_id = $2`,
    [spDateKey(now), id]
  );
  return toHabit(habit.rows[0], completions.rows, reminders.rows, now);
}

export async function create(entry: NewHabit): Promise<Habit> {
  const result = await pool.query<HabitRow>(
    `INSERT INTO habits (name, selected_days, icon, target_count, position)
     VALUES ($1, $2, $3, $4, ${nextPositionSql("habits")})
     RETURNING *`,
    [entry.name, entry.selectedDays, entry.icon, entry.targetCount]
  );
  return toHabit(result.rows[0]!, []);
}

export async function reorder(orderedIds: string[]): Promise<Habit[]> {
  await withTransaction(async (client) => {
    // Ordem parcial deixaria os ausentes com a posição antiga, colidindo com as novas,
    // e o `ORDER BY position, created_at` passaria a "pular" durante o arraste.
    const total = await client.query<{ n: string }>("SELECT COUNT(*) AS n FROM habits");
    if (Number(total.rows[0]!.n) !== orderedIds.length) {
      throw new ReorderMismatchError("todos os hábitos");
    }
    for (let i = 0; i < orderedIds.length; i++) {
      const result = await client.query(
        "UPDATE habits SET position = $1, updated_at = NOW() WHERE id = $2",
        [i, orderedIds[i]]
      );
      if ((result.rowCount ?? 0) === 0) throw new ReorderMismatchError("todos os hábitos");
    }
  });
  return findAll();
}

const COLUMN_MAP: Record<keyof HabitPatch, string> = {
  name: "name",
  icon: "icon",
  selectedDays: "selected_days",
  targetCount: "target_count",
};

export async function update(id: string, patch: HabitPatch): Promise<Habit | null> {
  const { sets, values, nextIndex } = buildUpdateSet(patch, COLUMN_MAP);
  const row = await updateById<HabitRow>("habits", id, sets, values, nextIndex);
  if (!row) return null;
  // Releê pelo findById: a resposta precisa levar `reminders` e `nextReminderId`,
  // porque o cliente troca o item do estado por ela.
  return findById(id);
}

export async function remove(id: string): Promise<boolean> {
  const result = await pool.query("DELETE FROM habits WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function getCompletion(
  habitId: string,
  date: string
): Promise<Pick<HabitCompletion, "date" | "count" | "locked"> | null> {
  const result = await pool.query<Pick<HabitCompletion, "date" | "count" | "locked">>(
    "SELECT date, count, locked FROM habit_completions WHERE habit_id = $1 AND date = $2",
    [habitId, date]
  );
  return result.rows[0] ?? null;
}

export async function setCompletionCount(habitId: string, date: string, count: number): Promise<void> {
  const result = await pool.query(
    `INSERT INTO habit_completions (habit_id, date, count, locked)
     SELECT $1, $2, LEAST($3, h.target_count), FALSE
     FROM habits h WHERE h.id = $1
     ON CONFLICT (habit_id, date) DO UPDATE
       SET count = EXCLUDED.count
       WHERE NOT habit_completions.locked`,
    [habitId, date, count]
  );

  if ((result.rowCount ?? 0) === 0) {
    const existing = await getCompletion(habitId, date);
    if (existing?.locked) {
      throw new CompletionLockedError();
    }
    return;
  }

  await touchHabit(habitId);
}

export async function clearCompletion(habitId: string, date: string): Promise<void> {
  const result = await pool.query(
    "DELETE FROM habit_completions WHERE habit_id = $1 AND date = $2 AND NOT locked",
    [habitId, date]
  );

  if ((result.rowCount ?? 0) === 0) {
    const existing = await getCompletion(habitId, date);
    if (existing?.locked) {
      throw new CompletionLockedError();
    }
    return;
  }

  await touchHabit(habitId);
}

export async function addReminder(habitId: string, time: string): Promise<boolean> {
  return withTransaction(async (client) => {
    const habit = await client.query<{ target_count: number }>(
      "SELECT target_count FROM habits WHERE id = $1 FOR UPDATE",
      [habitId]
    );
    const target = habit.rows[0]?.target_count;
    if (target === undefined) return false;

    const existing = await client.query<{ n: string }>(
      "SELECT COUNT(*) AS n FROM habit_reminders WHERE habit_id = $1",
      [habitId]
    );
    // Trava aqui, e não no Zod: o PUT de hábito é substituição total e passaria
    // a rejeitar o formulário inteiro por causa de um horário sobrando.
    if (Number(existing.rows[0]!.n) >= target) throw new ReminderLimitError(target);

    const inserted = await client.query(
      "INSERT INTO habit_reminders (habit_id, time) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [habitId, time]
    );
    // O DO NOTHING respondia 201 sem ter criado nada: o usuário adicionava 08:00 duas
    // vezes e via sucesso, sem novo horário na lista.
    if ((inserted.rowCount ?? 0) === 0) throw new DuplicateReminderTimeError(time);
    return true;
  });
}

/**
 * Ids dos horários na ordem por `time`. A ordem É a chave que decide se o aviso de
 * um índice já foi cumprido — não existe coluna de posição, de propósito.
 */
export async function reminderSlotIds(habitId: string): Promise<string[]> {
  const result = await pool.query<{ id: string }>(
    "SELECT id FROM habit_reminders WHERE habit_id = $1 ORDER BY time",
    [habitId]
  );
  return result.rows.map((row) => row.id);
}

export async function removeReminder(reminderId: string): Promise<string | null> {
  const result = await pool.query<{ habit_id: string }>(
    "DELETE FROM habit_reminders WHERE id = $1 RETURNING habit_id",
    [reminderId]
  );
  return result.rows[0]?.habit_id ?? null;
}

export async function setReminderSkipped(
  reminderId: string,
  date: string,
  skipped: boolean
): Promise<string | null> {
  const owner = await pool.query<{ habit_id: string }>(
    "SELECT habit_id FROM habit_reminders WHERE id = $1",
    [reminderId]
  );
  if (!owner.rows[0]) return null;

  await pool.query(
    `INSERT INTO habit_reminder_runtime (habit_reminder_id, date, skipped)
     VALUES ($1, $2, $3)
     ON CONFLICT (habit_reminder_id, date) DO UPDATE SET skipped = EXCLUDED.skipped`,
    [reminderId, date, skipped]
  );
  return owner.rows[0].habit_id;
}

export async function markReminderSent(reminderId: string, date: string, firedAt: Date): Promise<void> {
  await pool.query(
    `INSERT INTO habit_reminder_runtime (habit_reminder_id, date, last_sent_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (habit_reminder_id, date) DO UPDATE SET last_sent_at = EXCLUDED.last_sent_at`,
    [reminderId, date, firedAt]
  );
}

/**
 * Satisfaz o horário de índice `slotIndex` sem nunca reduzir a contagem atual.
 * Idempotente de propósito: o push vai para todos os aparelhos, então a mesma
 * notificação pode ser tocada duas vezes, ou minutos depois de já ter sido
 * concluída no app.
 */
export async function satisfyReminderSlot(
  habitId: string,
  slotIndex: number,
  date: string
): Promise<number | null> {
  const result = await pool.query<{ count: number }>(
    `INSERT INTO habit_completions (habit_id, date, count, locked)
     SELECT $1, $2, LEAST($3, h.target_count), FALSE
     FROM habits h WHERE h.id = $1
     ON CONFLICT (habit_id, date) DO UPDATE
       SET count = GREATEST(habit_completions.count, EXCLUDED.count)
       WHERE NOT habit_completions.locked
     RETURNING count`,
    [habitId, date, slotIndex + 1]
  );
  if (!result.rows[0]) {
    // Sem linha devolvida: ou o dia está travado (o WHERE do ON CONFLICT barrou),
    // ou o hábito não existe. Distinguir importa — travado é 409, não 404.
    const existing = await getCompletion(habitId, date);
    if (existing?.locked) throw new CompletionLockedError();
    return null;
  }
  await touchHabit(habitId);
  return result.rows[0].count;
}
