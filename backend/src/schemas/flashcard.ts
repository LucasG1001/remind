import { z } from "zod";

const question = z.string().min(1, "Informe a pergunta.").max(10000, "Pergunta muito longa.");
const answer = z.string().min(1, "Informe a resposta.").max(10000, "Resposta muito longa.");
const categoryId = z.string().uuid("Categoria inválida.").nullable();

export const createFlashcardSchema = z.object({
  question,
  answer,
  categoryId: categoryId.optional().default(null),
});

export const updateFlashcardSchema = z.object({
  question: question.optional(),
  answer: answer.optional(),
  categoryId: categoryId.optional(),
});

export const reviewFlashcardSchema = z.object({
  correct: z.boolean("Resultado inválido."),
});
