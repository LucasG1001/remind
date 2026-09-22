import { z } from "zod";
import { TIME_RE, calendarDateSchema, timeSchema } from "../lib/validation.js";

const recurUnit = z.enum(["day", "week", "month", "year"]);
const RECUR_TOGETHER = "Recorrência exige intervalo e unidade juntos.";

const reminderShape = {
  title: z.string().min(1, "Informe um título.").max(200),
  notes: z.string().max(2000).nullish(),
  date: calendarDateSchema,
  recurInterval: z.number().int().positive().nullish(),
  recurUnit: recurUnit.nullish(),
  recurWeekday: z.number().int().min(0).max(6).nullish(),
  recurMode: z.enum(["fixed", "relative"]).nullish(),
  // Mínimo 3: a contagem inclui os avisos de antecedência (30 min e 5 min), então com
  // 1 ou 2 o lembrete parava de insistir **antes** do aviso da hora.
  maxNotify: z.number().int().min(3, "Mínimo de 3 avisos.").max(50).optional(),
};

export const createReminderSchema = z
  .object({ ...reminderShape, time: timeSchema.nullish() })
  .refine((d) => Boolean(d.recurInterval) === Boolean(d.recurUnit), { message: RECUR_TOGETHER });

/**
 * O PUT é substituição total, então aqui `time` é obrigatório (string ou `null`): com
 * ele opcional, um corpo sem o campo convertia um lembrete com hora em dia inteiro —
 * o evento ia para 00:00 e o aviso da hora era trocado pelo "bom dia".
 */
export const updateReminderSchema = z
  .object({
    ...reminderShape,
    time: z
      .string({ error: "Informe a hora (HH:MM), ou null para dia inteiro." })
      .regex(TIME_RE, "Hora inválida (use HH:MM).")
      .nullable(),
  })
  .refine((d) => Boolean(d.recurInterval) === Boolean(d.recurUnit), { message: RECUR_TOGETHER });

export const rescheduleSchema = z.object({
  date: calendarDateSchema,
  time: timeSchema.nullish(),
});

export const acknowledgeSchema = z.object({
  /**
   * ISO do `event_at` que o cliente viu. Token de ocorrência: o push vai para todos
   * os aparelhos e o mesmo botão pode ser tocado em cada um — sem isto um lembrete
   * semanal saltaria duas semanas com dois cliques.
   */
  occurrenceAt: z.string().optional(),
});

export const snoozeSchema = z.object({
  minutes: z.number().int().min(1, "Informe os minutos da soneca.").max(1440),
});

export type CreateReminderBody = z.infer<typeof createReminderSchema>;
export type UpdateReminderBody = z.infer<typeof updateReminderSchema>;
export type RescheduleBody = z.infer<typeof rescheduleSchema>;
export type AcknowledgeBody = z.infer<typeof acknowledgeSchema>;
export type SnoozeBody = z.infer<typeof snoozeSchema>;
