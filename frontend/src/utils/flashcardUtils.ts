import type { Flashcard } from "../types/flashcard";

export function isDue(nextReviewAt: string): boolean {
  return new Date(nextReviewAt).getTime() <= Date.now();
}

export function countDue(cards: Flashcard[]): number {
  return cards.filter((c) => isDue(c.nextReviewAt)).length;
}
