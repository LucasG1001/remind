import { z } from "zod";

const baseHabit = z.object({
  name: z.string().min(1, "Informe um nome.").max(200),
  icon: z.string().min(1, "Escolha um ícone.").max(16),
  selectedDays: z
    .array(z.number().int().min(0).max(6))
    .min(1, "Escolha ao menos um dia."),
  targetCount: z.number().int().min(1, "Meta mínima é 1.").max(50, "Meta máxima é 50.").default(1),
});

export const createHabitSchema = baseHabit;

export const updateHabitSchema = baseHabit;

export const completionCountSchema = z.object({
  count: z.number().int().min(0, "Contagem inválida."),
});

const TIME = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido (use HH:MM).");

export const habitReminderSchema = z.object({ time: TIME });

export const reminderSkipSchema = z.object({
  skipped: z.boolean(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use YYYY-MM-DD)."),
});

export const reminderCompleteSchema = z.object({
  slotIndex: z.number().int().min(0, "Índice inválido."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use YYYY-MM-DD)."),
});

export const reorderHabitsSchema = z.object({
  order: z.array(z.string().uuid("ID inválido.")).min(1, "Forneça ao menos um hábito."),
});

export type CreateHabitBody = z.infer<typeof createHabitSchema>;
export type UpdateHabitBody = z.infer<typeof updateHabitSchema>;
