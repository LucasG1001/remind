import { del, get, post, put } from "./api";
import type { Flashcard, FlashcardFormData } from "../types/flashcard";

export function fetchFlashcards(): Promise<Flashcard[]> {
  return get<Flashcard[]>("/api/flashcards");
}

export function fetchDueFlashcards(): Promise<Flashcard[]> {
  return get<Flashcard[]>("/api/flashcards/due");
}

export function createFlashcard(data: FlashcardFormData): Promise<Flashcard> {
  return post<Flashcard>("/api/flashcards", data);
}

export function updateFlashcard(id: string, data: FlashcardFormData): Promise<Flashcard> {
  return put<Flashcard>(`/api/flashcards/${id}`, data);
}

export function setFlashcardCategory(id: string, categoryId: string | null): Promise<Flashcard> {
  return put<Flashcard>(`/api/flashcards/${id}`, { categoryId });
}

export function deleteFlashcard(id: string): Promise<void> {
  return del(`/api/flashcards/${id}`);
}

export function reviewFlashcard(id: string, correct: boolean): Promise<Flashcard> {
  return post<Flashcard>(`/api/flashcards/${id}/review`, { correct });
}
