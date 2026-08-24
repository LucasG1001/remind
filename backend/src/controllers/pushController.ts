import { subscribeSchema, unsubscribeSchema } from "../schemas/pushSubscription.js";
import * as pushSubscriptionModel from "../models/pushSubscriptionModel.js";
import { sendPush, vapidPublicKey } from "../services/pushService.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { parseBody } from "../lib/validation.js";

export const getPublicKey = asyncHandler("Erro ao buscar a chave de notificações.", async (_req, res) => {
  const publicKey = vapidPublicKey();
  if (!publicKey) {
    res.status(503).json({ error: "Notificações não configuradas no servidor." });
    return;
  }
  res.json({ publicKey });
});

export const subscribe = asyncHandler("Erro ao registrar o aparelho.", async (req, res) => {
  const body = parseBody(res, subscribeSchema, req.body);
  if (!body) return;

  const subscription = await pushSubscriptionModel.upsert({
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    userAgent: req.get("user-agent") ?? null,
  });
  res.status(201).json(subscription);
});

export const unsubscribe = asyncHandler("Erro ao remover o aparelho.", async (req, res) => {
  const body = parseBody(res, unsubscribeSchema, req.body);
  if (!body) return;

  await pushSubscriptionModel.removeByEndpoint(body.endpoint);
  res.status(204).send();
});

export const test = asyncHandler("Erro ao enviar a notificação de teste.", async (_req, res) => {
  const sent = await sendPush({
    title: "🔔 Teste do RemindMe",
    description: "Se você está vendo isso com os botões abaixo, as notificações estão funcionando.",
    url: "/lembretes",
  });
  res.json({ sent });
});
