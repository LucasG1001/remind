import { useMemo } from "react";
import type { Flashcard, FlashcardFormData } from "../types/flashcard";
import {
  fetchFlashcards,
  createFlashcard as apiCreateFlashcard,
  updateFlashcard as apiUpdateFlashcard,
  deleteFlashcard as apiDeleteFlashcard,
  reviewFlashcard as apiReviewFlashcard,
  setFlashcardCategory as apiSetFlashcardCategory,
} from "../services/flashcardService";
import { useFetchList } from "./useFetchList";
import { countDue } from "../utils/flashcardUtils";

interface UseFlashcardsReturn {
  cards: Flashcard[];
  loading: boolean;
  error: string | null;
  dueCount: number;
  createCard: (data: FlashcardFormData) => Promise<void>;
  updateCard: (id: string, data: FlashcardFormData) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  bulkDelete: (ids: string[]) => Promise<void>;
  bulkMove: (ids: string[], categoryId: string | null) => Promise<void>;
  applyReview: (id: string, correct: boolean) => Promise<Flashcard>;
}

export function useFlashcards(): UseFlashcardsReturn {
  const {
    items: cards,
    setItems: setCards,
    loading,
    error,
  } = useFetchList<Flashcard>(fetchFlashcards, "Não foi possível carregar os flashcards.");

  const dueCount = useMemo(() => countDue(cards), [cards]);

  async function createCard(data: FlashcardFormData): Promise<void> {
    const created = await apiCreateFlashcard(data);
    setCards((prev) => [created, ...prev]);
  }

  async function updateCard(id: string, data: FlashcardFormData): Promise<void> {
    const updated = await apiUpdateFlashcard(id, data);
    setCards((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }

  async function deleteCard(id: string): Promise<void> {
    await apiDeleteFlashcard(id);
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  async function bulkDelete(ids: string[]): Promise<void> {
    await Promise.all(ids.map((id) => apiDeleteFlashcard(id)));
    const removed = new Set(ids);
    setCards((prev) => prev.filter((c) => !removed.has(c.id)));
  }

  async function bulkMove(ids: string[], categoryId: string | null): Promise<void> {
    const updated = await Promise.all(ids.map((id) => apiSetFlashcardCategory(id, categoryId)));
    const byId = new Map(updated.map((c) => [c.id, c]));
    setCards((prev) => prev.map((c) => byId.get(c.id) ?? c));
  }

  async function applyReview(id: string, correct: boolean): Promise<Flashcard> {
    const updated = await apiReviewFlashcard(id, correct);
    setCards((prev) => prev.map((c) => (c.id === id ? updated : c)));
    return updated;
  }

  return {
    cards,
    loading,
    error,
    dueCount,
    createCard,
    updateCard,
    deleteCard,
    bulkDelete,
    bulkMove,
    applyReview,
  };
}
