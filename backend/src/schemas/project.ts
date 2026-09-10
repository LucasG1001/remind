import { z } from "zod";

const name = z.string().min(1, "Informe um nome.").max(200);
const cardTitle = z.string().min(1, "Informe um título.").max(500);
const cardDescription = z.string().max(10000, "Descrição muito longa.");
const cardImages = z
  .array(z.string().startsWith("data:image/", "Imagem inválida.").max(600000, "Imagem muito grande."))
  .max(6, "No máximo 6 imagens por cartão.");
const cardChecklist = z
  .array(z.object({ text: z.string().min(1).max(500), done: z.boolean() }))
  .max(100, "No máximo 100 itens.");
const cardTagIds = z
  .array(z.string().uuid("Tag inválida."))
  .max(12, "No máximo 12 tags por cartão.");

// Paleta fixa de swatches — espelhada em frontend/src/utils/tagPalette.ts.
export const TAG_COLORS = [
  "#b7aefc",
  "#8fc5ff",
  "#7dd3fc",
  "#6ee7a8",
  "#c3e88d",
  "#f0c878",
  "#ffb37a",
  "#ff9b8a",
  "#f4a8d8",
  "#d0d4dc",
] as const;

const tagName = z.string().trim().min(1, "Informe o nome da tag.").max(40, "Nome muito longo.");
const tagColor = z.enum(TAG_COLORS, "Cor inválida.");
const tagIcon = z.string().min(1, "Escolha um ícone.").max(16);

export const createProjectSchema = z.object({ name });

export const updateProjectSchema = createProjectSchema;

export const createListSchema = z.object({ name });

export const updateListSchema = createListSchema;

export const createCardSchema = z.object({ title: cardTitle });

export const updateCardSchema = z.object({
  title: cardTitle.optional(),
  done: z.boolean().optional(),
  description: cardDescription.optional(),
  images: cardImages.optional(),
  checklist: cardChecklist.optional(),
  tagIds: cardTagIds.optional(),
});

export const createTagSchema = z.object({ name: tagName, color: tagColor, icon: tagIcon });

export const updateTagSchema = z.object({
  name: tagName.optional(),
  color: tagColor.optional(),
  icon: tagIcon.optional(),
});

export const reorderListsSchema = z.object({
  order: z.array(z.string().uuid("ID inválido.")).min(1, "Forneça ao menos uma lista."),
});

export const moveCardSchema = z.object({
  toListId: z.string().uuid("ID inválido."),
  position: z.number().int().min(0),
});
