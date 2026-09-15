export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  categoryId: string | null;
  box: number;
  nextReviewAt: string;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FlashcardFormData {
  question: string;
  answer: string;
  categoryId: string | null;
}
