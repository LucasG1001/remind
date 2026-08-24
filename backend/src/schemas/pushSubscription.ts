import { z } from "zod";

export const subscribeSchema = z.object({
  endpoint: z.string().url("Endpoint inválido."),
  keys: z.object({
    p256dh: z.string().min(1, "Chave p256dh ausente."),
    auth: z.string().min(1, "Chave auth ausente."),
  }),
});

export const unsubscribeSchema = z.object({
  endpoint: z.string().url("Endpoint inválido."),
});

export type SubscribeBody = z.infer<typeof subscribeSchema>;
export type UnsubscribeBody = z.infer<typeof unsubscribeSchema>;
