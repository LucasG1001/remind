import webpush from "web-push";
import { WebPushError } from "web-push";
import * as pushSubscriptionModel from "../models/pushSubscriptionModel.js";

export interface PushPayload {
  title: string;
  description: string;
  /**
   * Só lembretes preenchem `reminderId`. Um aparelho com o service worker antigo
   * em cache cai no ramo de push de teste quando ele falta, em vez de postar em
   * /api/reminders/<id> — é o contrato de compatibilidade dos avisos de hábito.
   */
  reminderId?: string;
  /**
   * `event_at` da ocorrência que gerou este aviso, em ISO. O botão "Concluir" o
   * devolve para o servidor descartar o clique de uma ocorrência já encerrada — o
   * push vai para todos os aparelhos e cada um deles pode tocar o mesmo botão.
   */
  occurrenceAt?: string;
  kind?: "reminder" | "habit";
  /** Chave de coalescência na fila do serviço de push; vira o header `topic`. */
  collapseKey?: string;
  habit?: { habitId: string; slotId: string; slotIndex: number; date: string };
  url?: string;
}

/**
 * Um aviso que chegasse horas atrasado seria ruído, não lembrete: o push expira
 * na fila do serviço se não for entregue dentro deste intervalo.
 */
const TTL_SECONDS = 15 * 60;

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    console.warn("VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT ausentes — push não enviado.");
    configured = false;
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

/**
 * A chave pública só é oferecida quando o par inteiro existe: com uma das três
 * variáveis em branco o cliente inscrevia o aparelho com sucesso e o usuário via
 * "notificações ativadas" sem que nenhum push pudesse sair.
 */
export function vapidPublicKey(): string | null {
  if (!ensureConfigured()) return null;
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

/**
 * Há canal de entrega agora? O scheduler consulta antes de gastar a fase e a
 * contagem de avisos de um lembrete que sairia mudo.
 */
export async function canDeliverPush(): Promise<boolean> {
  if (!ensureConfigured()) return false;
  return (await pushSubscriptionModel.count()) > 0;
}

/**
 * Envia o push para todos os aparelhos inscritos. Todo o conteúdo vai no payload
 * cifrado: o service worker nunca precisa buscar dados para montar a notificação.
 * Retorna quantos envios foram aceitos pelo serviço de push.
 */
export async function sendPush(payload: PushPayload): Promise<number> {
  if (!ensureConfigured()) return 0;

  const subscriptions = await pushSubscriptionModel.findAll();
  if (subscriptions.length === 0) {
    console.warn("[push] nenhum aparelho inscrito — notificação não enviada.");
    return 0;
  }

  const body = JSON.stringify(payload);
  const options: webpush.RequestOptions = {
    TTL: TTL_SECONDS,
    urgency: "high",
    // Coalesce na fila do serviço de push: um aviso não entregue do mesmo
    // lembrete é substituído pelo seguinte. O limite do header é 32 chars.
    ...(() => {
      // O header aceita no máximo 32 chars e um UUID sem traços tem exatamente 32.
      const key = payload.collapseKey ?? payload.reminderId;
      return key ? { topic: key.replace(/-/g, "").slice(0, 32) } : {};
    })(),
  };

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body,
        options
      )
    )
  );

  let sent = 0;
  for (const [index, result] of results.entries()) {
    if (result.status === "fulfilled") {
      sent++;
      continue;
    }

    const { endpoint } = subscriptions[index];
    const status = result.reason instanceof WebPushError ? result.reason.statusCode : null;
    // 403/400 também são definitivos (ex: par VAPID regerado — "credentials
    // mismatch"): mantidas, essas linhas fariam todo tick tentar endpoints mortos e
    // `sent` nunca sair de zero. 429 é transitório e não remove.
    if (status === 404 || status === 410 || status === 403 || status === 400) {
      await pushSubscriptionModel.removeByEndpoint(endpoint);
      console.warn(`[push] subscription inválida removida (${status}): ${endpoint.slice(0, 40)}…`);
    } else {
      console.error(`[push] falha ao enviar para ${endpoint.slice(0, 40)}…:`, result.reason);
    }
  }

  return sent;
}
