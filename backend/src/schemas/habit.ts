import { z } from "zod";
import { TIME_RE } from "../lib/validation.js";
import { checkTimeWindow, TIME_WINDOW_MESSAGES } from "../lib/timeWindow.js";

// .nullable().default(null) e não .nullish(): o PUT é full-replace e o
// buildUpdateSet pula undefined, então omitir o campo tem que APAGAR o horário
// em vez de preservar o antigo.
const timeField = z
  .string()
  .regex(TIME_RE, "Horário inválido (use HH:MM).")
  .nullable()
  .default(null);

const baseHabit = z
  .object({
    name: z.string().min(1, "Informe um nome.").max(200),
    icon: z.string().min(1, "Escolha um ícone.").max(16),
    selectedDays: z
      .array(z.number().int().min(0).max(6))
      .min(1, "Escolha ao menos um dia."),
    targetCount: z
      .number()
      .int()
      .min(1, "Meta mínima é 1.")
      .max(50, "Meta máxima é 50.")
      .default(1),
    startTime: timeField,
    endTime: timeField,
  })
  .superRefine((data, ctx) => {
    const issue = checkTimeWindow(data.startTime, data.endTime);
    if (issue) ctx.addIssue({ code: "custom", message: TIME_WINDOW_MESSAGES[issue] });
  });

export const createHabitSchema = baseHabit;

export const updateHabitSchema = baseHabit;

export const completionCountSchema = z.object({
  count: z.number().int().min(0, "Contagem inválida."),
});

export const reorderHabitsSchema = z.object({
  order: z.array(z.string().uuid("ID inválido.")).min(1, "Forneça ao menos um hábito."),
});

export type CreateHabitBody = z.infer<typeof createHabitSchema>;
export type UpdateHabitBody = z.infer<typeof updateHabitSchema>;
