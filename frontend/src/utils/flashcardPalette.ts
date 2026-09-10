import { NEUTRAL_TINTS, tints, type ColorTints } from "./colorTints";

export const CATEGORY_COLORS = ["#b7aefc", "#6ee7a8", "#ff9b8a", "#8fc5ff", "#f0c878"];

export type CategoryTints = ColorTints;

export { NEUTRAL_TINTS, tints };

export function categoryTints(
  categories: { id: string; color: string }[],
  id: string | null
): CategoryTints {
  const cat = id ? categories.find((c) => c.id === id) : undefined;
  return cat ? tints(cat.color) : NEUTRAL_TINTS;
}

export function categoryLabel(
  categories: { id: string; name: string }[],
  id: string | null
): string {
  return (id && categories.find((c) => c.id === id)?.name) || "Sem categoria";
}
