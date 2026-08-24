import webpush from "web-push";
import { WebPushError } from "web-push";
import * as pushSubscriptionModel from "../models/pushSubscriptionModel.js";

export interface PushPayload {
  title: string;
  description: string;
  reminderId?: string;
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

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
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
    ...(payload.reminderId ? { topic: payload.reminderId.replace(/-/g, "") } : {}),
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
    if (status === 404 || status === 410) {
      await pushSubscriptionModel.removeByEndpoint(endpoint);
      console.warn(`[push] subscription expirada removida (${status}): ${endpoint}`);
    } else {
      console.error(`[push] falha ao enviar para ${endpoint}:`, result.reason);
    }
  }

  return sent;
}
