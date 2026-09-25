import { pool } from "../database/connection.js";
import { updateById, withTransaction } from "../database/transaction.js";
import { buildUpdateSet, nextPositionSql } from "../lib/sqlUpdate.js";
import { CompletionLockedError, ReorderMismatchError } from "./errors.js";
import type {
  Habit,
  HabitCompletion,
  HabitCompletionRow,
  HabitPatch,
  HabitRow,
  NewHabit,
} from "../types/habit.js";

async function touchHabit(habitId: string): Promise<void> {
  await pool.query("UPDATE habits SET updated_at = NOW() WHERE id = $1", [habitId]);
}

function toHabit(row: HabitRow, completionRows: HabitCompletionRow[]): Habit {
  const completions = completionRows
    .filter((c) => c.habit_id === row.id)
    .map((c) => ({
      date: c.date,
      count: c.count,
      completed: c.count >= row.target_count,
      locked: c.locked,
    }));

  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    selectedDays: row.selected_days,
    targetCount: row.target_count,
    durationMinutes: row.duration_minutes,
    completions,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findAll(): Promise<Habit[]> {
  const habits = await pool.query<HabitRow>(
    "SELECT * FROM habits ORDER BY position ASC, created_at ASC"
  );
  const completions = await pool.query<HabitCompletionRow>(
    "SELECT habit_id, date, count, locked FROM habit_completions"
  );
  return habits.rows.map((row) => toHabit(row, completions.rows));
}

export async function findById(id: string): Promise<Habit | null> {
  const habit = await pool.query<HabitRow>("SELECT * FROM habits WHERE id = $1", [id]);
  if (!habit.rows[0]) return null;
  const completions = await pool.query<HabitCompletionRow>(
    "SELECT habit_id, date, count, locked FROM habit_completions WHERE habit_id = $1",
    [id]
  );
  return toHabit(habit.rows[0], completions.rows);
}

export async function create(entry: NewHabit): Promise<Habit> {
  const result = await pool.query<HabitRow>(
    `INSERT INTO habits (name, selected_days, icon, target_count, duration_minutes, position)
     VALUES ($1, $2, $3, $4, $5, ${nextPositionSql("habits")})
     RETURNING *`,
    [entry.name, entry.selectedDays, entry.icon, entry.targetCount, entry.durationMinutes]
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
  durationMinutes: "duration_minutes",
};

export async function update(id: string, patch: HabitPatch): Promise<Habit | null> {
  const { sets, values, nextIndex } = buildUpdateSet(patch, COLUMN_MAP);
  const row = await updateById<HabitRow>("habits", id, sets, values, nextIndex);
  if (!row) return null;
  // Releê pelo findById: a resposta precisa levar as conclusões, porque o cliente
  // troca o item do estado por ela.
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

/**
 * +1 atômico para a sessão de timer: o PATCH grava contagem absoluta, e o cliente
 * somando sobre um estado velho (outra aba, outro aparelho) perderia um check.
 */
export async function incrementCompletion(habitId: string, date: string): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO habit_completions (habit_id, date, count, locked)
     SELECT $1, $2, 1, FALSE
     FROM habits h WHERE h.id = $1
     ON CONFLICT (habit_id, date) DO UPDATE
       SET count = LEAST(
         habit_completions.count + 1,
         (SELECT target_count FROM habits WHERE id = $1)
       )
       WHERE NOT habit_completions.locked`,
    [habitId, date]
  );

  if ((result.rowCount ?? 0) === 0) {
    const existing = await getCompletion(habitId, date);
    if (existing?.locked) throw new CompletionLockedError();
    return existing !== null;
  }

  await touchHabit(habitId);
  return true;
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
