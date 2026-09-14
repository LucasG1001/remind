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

export const reorderHabitsSchema = z.object({
  order: z.array(z.string().uuid("ID inválido.")).min(1, "Forneça ao menos um hábito."),
});

export type CreateHabitBody = z.infer<typeof createHabitSchema>;
export type UpdateHabitBody = z.infer<typeof updateHabitSchema>;
