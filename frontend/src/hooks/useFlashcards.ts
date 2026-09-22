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
  reload: () => void;
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
    reload,
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

  // allSettled, e nao all: com `all` uma falha no meio rejeitava antes de qualquer
  // setCards, e a lista seguia exibindo cartoes ja apagados no servidor.
  async function bulkDelete(ids: string[]): Promise<void> {
    const results = await Promise.allSettled(ids.map((id) => apiDeleteFlashcard(id)));
    const removed = new Set(ids.filter((_, i) => results[i]?.status === "fulfilled"));
    setCards((prev) => prev.filter((c) => !removed.has(c.id)));
    const failed = results.length - removed.size;
    if (failed > 0) throw new Error(`Não foi possível excluir ${failed} card(s).`);
  }

  async function bulkMove(ids: string[], categoryId: string | null): Promise<void> {
    const results = await Promise.allSettled(
      ids.map((id) => apiSetFlashcardCategory(id, categoryId))
    );
    const byId = new Map(
      results
        .filter((r): r is PromiseFulfilledResult<Flashcard> => r.status === "fulfilled")
        .map((r) => [r.value.id, r.value])
    );
    setCards((prev) => prev.map((c) => byId.get(c.id) ?? c));
    const failed = results.length - byId.size;
    if (failed > 0) throw new Error(`Não foi possível mover ${failed} card(s).`);
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
    reload,
    createCard,
    updateCard,
    deleteCard,
    bulkDelete,
    bulkMove,
    applyReview,
  };
}
