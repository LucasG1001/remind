import { z } from "zod";
import { DATE_RE, TIME_RE } from "../lib/validation.js";


const recurUnit = z.enum(["day", "week", "month", "year"]);

const baseReminder = z
  .object({
    title: z.string().min(1, "Informe um título.").max(200),
    notes: z.string().max(2000).nullish(),
    date: z.string().regex(DATE_RE, "Data inválida (use YYYY-MM-DD)."),
    time: z.string().regex(TIME_RE, "Hora inválida (use HH:MM).").nullish(),
    recurInterval: z.number().int().positive().nullish(),
    recurUnit: recurUnit.nullish(),
    recurWeekday: z.number().int().min(0).max(6).nullish(),
    recurMode: z.enum(["fixed", "relative"]).nullish(),
    maxNotify: z.number().int().min(1).max(50).optional(),
  })
  .refine((d) => Boolean(d.recurInterval) === Boolean(d.recurUnit), {
    message: "Recorrência exige intervalo e unidade juntos.",
  });

export const createReminderSchema = baseReminder;

export const updateReminderSchema = baseReminder;

export const rescheduleSchema = z.object({
  date: z.string().regex(DATE_RE, "Data inválida (use YYYY-MM-DD)."),
  time: z.string().regex(TIME_RE, "Hora inválida (use HH:MM).").nullish(),
});

export const snoozeSchema = z.object({
  minutes: z.number().int().min(1, "Informe os minutos da soneca.").max(1440),
});

export type CreateReminderBody = z.infer<typeof createReminderSchema>;
export type UpdateReminderBody = z.infer<typeof updateReminderSchema>;
export type RescheduleBody = z.infer<typeof rescheduleSchema>;
export type SnoozeBody = z.infer<typeof snoozeSchema>;
