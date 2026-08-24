import { pool } from "../database/connection.js";
import type { NewPushSubscription, PushSubscription, PushSubscriptionRow } from "../types/pushSubscription.js";

const COLUMNS = "id, endpoint, p256dh, auth, user_agent, created_at, last_seen_at";

function toPushSubscription(row: PushSubscriptionRow): PushSubscription {
  return {
    id: row.id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

export async function findAll(): Promise<PushSubscription[]> {
  const result = await pool.query<PushSubscriptionRow>(
    `SELECT ${COLUMNS} FROM push_subscriptions ORDER BY created_at`
  );
  return result.rows.map(toPushSubscription);
}

export async function upsert(input: NewPushSubscription): Promise<PushSubscription> {
  const result = await pool.query<PushSubscriptionRow>(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_agent)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE
       SET p256dh = EXCLUDED.p256dh,
           auth = EXCLUDED.auth,
           user_agent = EXCLUDED.user_agent,
           last_seen_at = NOW()
     RETURNING ${COLUMNS}`,
    [input.endpoint, input.p256dh, input.auth, input.userAgent]
  );
  return toPushSubscription(result.rows[0]);
}

export async function removeByEndpoint(endpoint: string): Promise<boolean> {
  const result = await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
  return (result.rowCount ?? 0) > 0;
}
