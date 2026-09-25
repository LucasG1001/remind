import type { ProjectTag } from "../types/project";

// Espelha TAG_COLORS de backend/src/schemas/project.ts (o Zod recusa cor fora da paleta).
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
];

export function resolveTags(tags: ProjectTag[], tagIds: string[]): ProjectTag[] {
  return tagIds
    .map((id) => tags.find((tag) => tag.id === id))
    .filter((tag): tag is ProjectTag => Boolean(tag));
}

export function toggleTagId(tagIds: string[], tagId: string): string[] {
  return tagIds.includes(tagId) ? tagIds.filter((id) => id !== tagId) : [...tagIds, tagId];
}
