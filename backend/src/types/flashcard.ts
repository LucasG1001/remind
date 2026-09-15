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

export interface FlashcardRow {
  id: string;
  question: string;
  answer: string;
  category_id: string | null;
  box: number;
  next_review_at: string;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewFlashcard {
  question: string;
  answer: string;
  categoryId: string | null;
}

export interface FlashcardPatch {
  question?: string;
  answer?: string;
  categoryId?: string | null;
}
