import * as reminderModel from "../models/reminderModel.js";
import { addMinutes } from "../lib/dateUtils.js";
import { decide } from "./reminderStateMachine.js";
import { sendPush } from "./pushService.js";

const TICK_MS = 60 * 1000;
const BATCH_LIMIT = 100;

let inFlight = false;

export async function processDue(now: Date = new Date()): Promise<void> {
  const due = await reminderModel.findDue(now, BATCH_LIMIT);

  if (due.length > 0) {
    console.log(`[scheduler] ${now.toISOString()} — ${due.length} lembrete(s) a disparar.`);
  }

  for (const reminder of due) {
    try {
      const { message, patch } = decide(reminder, now);
      // Persiste a transição antes de enviar: se a escrita falhasse depois do envio,
      // a fase/contagem não avançaria e a mesma notificação repetiria a cada tick.
      await reminderModel.update(reminder.id, patch);
      try {
        const sent = await sendPush({
          ...message,
          reminderId: reminder.id,
          url: `/lembretes/r/${reminder.id}`,
        });
        if (sent === 0) {
          console.warn(`[scheduler] lembrete ${reminder.id} ("${reminder.title}") processado sem envio de push (VAPID ausente ou nenhum aparelho inscrito).`);
        } else {
          console.log(`[scheduler] lembrete ${reminder.id} ("${reminder.title}") notificado em ${sent} aparelho(s): ${reminder.phase} → ${patch.phase ?? reminder.phase}.`);
        }
      } catch (error) {
        console.error(`[scheduler] falha ao enviar notificação do lembrete ${reminder.id} ("${reminder.title}"):`, error);
      }
    } catch (error) {
      console.error(`[scheduler] falha ao processar lembrete ${reminder.id} ("${reminder.title}"):`, error);
      // Nada foi enviado ainda: adia ~1 min mantendo a fase para tentar de novo.
      await reminderModel.update(reminder.id, { nextNotifyAt: addMinutes(now, 1) }).catch(() => undefined);
    }
  }
}

function tick(): void {
  if (inFlight) return;
  inFlight = true;
  processDue()
    .catch((error) => console.error("[scheduler] tick falhou:", error))
    .finally(() => {
      inFlight = false;
    });
}

export function startScheduler(): void {
  console.log("[scheduler] iniciado (tick a cada 60s).");
  tick();
  setInterval(tick, TICK_MS);
}
