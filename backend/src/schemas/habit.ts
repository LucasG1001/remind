import { z } from "zod";

const targetCount = z
  .number({ error: "Informe a meta de vezes por dia." })
  .int()
  .min(1, "Meta mínima é 1.")
  .max(50, "Meta máxima é 50.");

const durationMinutes = z
  .number({ error: "Informe a duração em minutos." })
  .int()
  .min(1, "Duração mínima é 1 minuto.")
  .max(600, "Duração máxima é 600 minutos.")
  .nullable();

const baseHabit = z.object({
  name: z.string().min(1, "Informe um nome.").max(200),
  icon: z.string().min(1, "Escolha um ícone.").max(16),
  selectedDays: z
    .array(z.number().int().min(0).max(6))
    .min(1, "Escolha ao menos um dia."),
});

export const createHabitSchema = baseHabit.extend({
  targetCount: targetCount.default(1),
  durationMinutes: durationMinutes.default(null),
});

// Sem `.default` no update: o PUT é substituição total, e um corpo sem targetCount
// rebaixaria a meta para 1 em silêncio — o que desativa horários e reescreve o heatmap.
// O mesmo vale para durationMinutes, que apagaria o timer.
export const updateHabitSchema = baseHabit.extend({ targetCount, durationMinutes });

export const completionCountSchema = z.object({
  count: z.number().int().min(0, "Contagem inválida."),
});

export const reorderHabitsSchema = z.object({
  order: z
    .array(z.string().uuid("ID inválido."))
    .min(1, "Forneça ao menos um hábito.")
    .refine((ids) => new Set(ids).size === ids.length, { message: "Ordem com ids repetidos." }),
});

export type CreateHabitBody = z.infer<typeof createHabitSchema>;
export type UpdateHabitBody = z.infer<typeof updateHabitSchema>;
