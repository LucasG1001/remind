import { z } from "zod";
import { calendarDateSchema, timeSchema } from "../lib/validation.js";

const targetCount = z
  .number({ error: "Informe a meta de vezes por dia." })
  .int()
  .min(1, "Meta mínima é 1.")
  .max(50, "Meta máxima é 50.");

const baseHabit = z.object({
  name: z.string().min(1, "Informe um nome.").max(200),
  icon: z.string().min(1, "Escolha um ícone.").max(16),
  selectedDays: z
    .array(z.number().int().min(0).max(6))
    .min(1, "Escolha ao menos um dia."),
});

export const createHabitSchema = baseHabit.extend({ targetCount: targetCount.default(1) });

// Sem `.default` no update: o PUT é substituição total, e um corpo sem targetCount
// rebaixaria a meta para 1 em silêncio — o que desativa horários e reescreve o heatmap.
export const updateHabitSchema = baseHabit.extend({ targetCount });

export const completionCountSchema = z.object({
  count: z.number().int().min(0, "Contagem inválida."),
});

export const habitReminderSchema = z.object({ time: timeSchema });

export const reminderSkipSchema = z.object({
  skipped: z.boolean(),
  date: calendarDateSchema,
});

export const reminderCompleteSchema = z.object({
  /**
   * Horário que gerou o aviso. Quem manda é ele, não o `slotIndex`: a chave do
   * "cumprido" é a posição na ordem por `time`, e adicionar um horário mais cedo
   * entre o envio do push e o toque desloca todos os índices.
   */
  slotId: z.string().uuid("ID inválido.").optional(),
  slotIndex: z.number().int().min(0, "Índice inválido."),
  date: calendarDateSchema,
});

export const reorderHabitsSchema = z.object({
  order: z
    .array(z.string().uuid("ID inválido."))
    .min(1, "Forneça ao menos um hábito.")
    .refine((ids) => new Set(ids).size === ids.length, { message: "Ordem com ids repetidos." }),
});

export type CreateHabitBody = z.infer<typeof createHabitSchema>;
export type UpdateHabitBody = z.infer<typeof updateHabitSchema>;
