import * as reminderModel from "../models/reminderModel.js";
import { withTransaction } from "../database/transaction.js";
import { addMinutes } from "../lib/dateUtils.js";
import { decide } from "./reminderStateMachine.js";
import { canDeliverPush, sendPush } from "./pushService.js";

const TICK_MS = 60 * 1000;
const BATCH_LIMIT = 100;

let inFlight = false;
let timer: NodeJS.Timeout | null = null;

export async function processDue(now: Date = new Date()): Promise<void> {
  const due = await reminderModel.findDue(now, BATCH_LIMIT);
  if (due.length === 0) return;

  console.log(`[scheduler] ${now.toISOString()} — ${due.length} lembrete(s) a disparar.`);

  // Sem canal de entrega, processar gastaria a fase e a contagem de avisos de todos
  // eles em silêncio — o lembrete sairia do ciclo sem nunca ter avisado ninguém.
  // Não gravar nada é o próprio retry: o findDue os traz de volta no próximo tick.
  if (!(await canDeliverPush())) {
    console.warn(`[scheduler] ${due.length} lembrete(s) vencido(s) sem canal de push (VAPID ausente ou nenhum aparelho inscrito) — fase preservada para o próximo tick.`);
    return;
  }

  for (const candidate of due) {
    try {
      // Relê sob FOR UPDATE e decide sobre o estado fresco: entre o findDue e a
      // escrita o usuário pode ter sonecado ou concluído pela notificação, e gravar
      // o patch por cima apagaria essa ação (last-write-wins).
      const decided = await withTransaction(async (client) => {
        const fresh = await reminderModel.lockById(client, candidate.id);
        if (!fresh || fresh.status !== "active" || !fresh.nextNotifyAt) return null;
        if (new Date(fresh.nextNotifyAt).getTime() > now.getTime()) return null;

        const { message, patch } = decide(fresh, now);
        // Persiste a transição antes de enviar: se a escrita falhasse depois do envio,
        // a fase/contagem não avançaria e a mesma notificação repetiria a cada tick.
        await reminderModel.update(fresh.id, patch, client);
        return {
          message,
          occurrenceAt: new Date(fresh.eventAt).toISOString(),
          phaseFrom: fresh.phase,
          phaseTo: patch.phase ?? fresh.phase,
        };
      });

      if (!decided) {
        console.log(`[scheduler] lembrete ${candidate.id} ("${candidate.title}") mudou entre a busca e o envio — nada enviado.`);
        continue;
      }

      try {
        const sent = await sendPush({
          ...decided.message,
          reminderId: candidate.id,
          occurrenceAt: decided.occurrenceAt,
          url: `/lembretes/r/${candidate.id}`,
        });
        if (sent === 0) {
          console.warn(`[scheduler] lembrete ${candidate.id} ("${candidate.title}") processado sem envio de push (aparelho desinscrito no meio do tick).`);
        } else {
          console.log(`[scheduler] lembrete ${candidate.id} ("${candidate.title}") notificado em ${sent} aparelho(s): ${decided.phaseFrom} → ${decided.phaseTo}.`);
        }
      } catch (error) {
        console.error(`[scheduler] falha ao enviar notificação do lembrete ${candidate.id} ("${candidate.title}"):`, error);
      }
    } catch (error) {
      console.error(`[scheduler] falha ao processar lembrete ${candidate.id} ("${candidate.title}"):`, error);
      // Nada foi enviado ainda: adia ~1 min mantendo a fase para tentar de novo.
      await reminderModel.update(candidate.id, { nextNotifyAt: addMinutes(now, 1) }).catch(() => undefined);
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
  timer = setInterval(tick, TICK_MS);
}

/** Chamado no encerramento: sem isto um deploy podia matar o processo no meio de um tick. */
export function stopScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
