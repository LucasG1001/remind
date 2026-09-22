import type { Pool, PoolClient } from "pg";
import { pool } from "./connection.js";

/** Pool ou cliente de transação: os models aceitam os dois para poder participar de uma. */
export type Db = Pool | PoolClient;

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let failure: Error | null = null;
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));
    // ROLLBACK em try próprio: se ele falhar (a conexão caiu), o erro de negócio
    // original é o que interessa ao chamador, não o do rollback.
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("[db] ROLLBACK falhou:", rollbackError);
    }
    throw error;
  } finally {
    // release(error) descarta o cliente em vez de devolver ao pool um que pode estar
    // em transação falhada, herdada pela próxima request.
    if (failure) client.release(failure);
    else client.release();
  }
}

export async function updateById<Row extends object>(
  table: string,
  id: string,
  sets: string[],
  values: unknown[],
  nextIndex: number,
  db: Db = pool
): Promise<Row | null> {
  if (sets.length === 0) {
    const existing = await db.query<Row>(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    return existing.rows[0] ?? null;
  }
  sets.push("updated_at = NOW()");
  values.push(id);
  const result = await db.query<Row>(
    `UPDATE ${table} SET ${sets.join(", ")} WHERE id = $${nextIndex} RETURNING *`,
    values
  );
  return result.rows[0] ?? null;
}
