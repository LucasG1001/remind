import { pool } from "../database/connection.js";
import { spDateKey } from "../lib/dateUtils.js";
import * as habitModel from "../models/habitModel.js";
import { decideHabitTick, type HabitReminderSlot } from "./habitReminderState.js";
import * as messages from "./habitMessages.js";
import { sendPush } from "./pushService.js";

interface HabitDueRow {
  id: string;
  name: string;
  icon: string;
  target_count: number;
  selected_days: number[];
  count: number | null;
  locked: boolean | null;
  slots: Array<{ id: string; time: string; skipped: boolean | null; last_sent_at: string | null }>;
}

/**
 * Hábitos com pelo menos um horário, agendados para hoje, com os horários e a
 * contagem do dia. A contagem vem na MESMA query: um check que caísse entre duas
 * idas ao banco faria avisar um horário recém-cumprido.
 */
const DUE_SQL = `
  SELECT h.id, h.name, h.icon, h.target_count, h.selected_days,
         c.count, c.locked,
         COALESCE(
           json_agg(
             json_build_object('id', r.id, 'time', r.time,
                               'skipped', rt.skipped, 'last_sent_at', rt.last_sent_at)
             ORDER BY r.time
           ) FILTER (WHERE r.id IS NOT NULL),
           '[]'
         ) AS slots
    FROM habits h
    JOIN habit_reminders r ON r.habit_id = h.id
    LEFT JOIN habit_reminder_runtime rt
      ON rt.habit_reminder_id = r.id AND rt.date = $1
    LEFT JOIN habit_completions c
      ON c.habit_id = h.id AND c.date = $1
   WHERE $2 = ANY(h.selected_days)
   GROUP BY h.id, c.count, c.locked`;

export async function processHabitsDue(now: Date = new Date()): Promise<void> {
  const todayKey = spDateKey(now);
  const weekday = new Date(now.getTime() - 3 * 60 * 60 * 1000).getUTCDay();

  const due = await pool.query<HabitDueRow>(DUE_SQL, [todayKey, weekday]);

  for (const row of due.rows) {
    try {
      const slots: HabitReminderSlot[] = row.slots.map((s) => ({
        id: s.id,
        time: s.time,
        skipped: s.skipped === true,
        lastSentAt: s.last_sent_at ? new Date(s.last_sent_at) : null,
      }));

      const send = decideHabitTick({
        habitId: row.id,
        habitName: row.name,
        targetCount: row.target_count,
        selectedDays: row.selected_days,
        slots,
        count: row.count ?? 0,
        locked: row.locked === true,
        todayKey,
        now,
      });
      if (!send) continue;

      // Persiste antes de enviar, como no scheduler de lembretes: se a escrita
      // falhasse depois do envio, o mesmo aviso repetiria a cada tick.
      await habitModel.markReminderSent(send.slotId, todayKey, send.firedAt);

      const message = messages.habitNag(row.name, send.time, send.slotIndex, row.target_count);
      await sendPush({
        ...message,
        kind: "habit",
        collapseKey: row.id,
        url: "/habitos",
        habit: {
          habitId: row.id,
          slotId: send.slotId,
          slotIndex: send.slotIndex,
          date: todayKey,
        },
      }).catch((error) => {
        console.error(`[habits] falha ao enviar aviso de "${row.name}":`, error);
      });
    } catch (error) {
      console.error(`[habits] falha ao processar hábito ${row.id} ("${row.name}"):`, error);
    }
  }
}
