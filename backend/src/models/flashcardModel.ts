import { pool } from "../database/connection.js";
import { updateById } from "../database/transaction.js";
import { buildUpdateSet } from "../lib/sqlUpdate.js";
import { review } from "../services/flashcardScheduler.js";
import type {
  Flashcard,
  FlashcardPatch,
  FlashcardRow,
  NewFlashcard,
} from "../types/flashcard.js";

function toFlashcard(row: FlashcardRow): Flashcard {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    categoryId: row.category_id,
    box: row.box,
    nextReviewAt: row.next_review_at,
    lastReviewedAt: row.last_reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findAll(): Promise<Flashcard[]> {
  const result = await pool.query<FlashcardRow>(
    "SELECT * FROM flashcards ORDER BY created_at DESC"
  );
  return result.rows.map(toFlashcard);
}

export async function findDue(): Promise<Flashcard[]> {
  const result = await pool.query<FlashcardRow>(
    "SELECT * FROM flashcards WHERE next_review_at <= NOW() ORDER BY next_review_at ASC, created_at ASC"
  );
  return result.rows.map(toFlashcard);
}

export async function findById(id: string): Promise<Flashcard | null> {
  const result = await pool.query<FlashcardRow>("SELECT * FROM flashcards WHERE id = $1", [id]);
  return result.rows[0] ? toFlashcard(result.rows[0]) : null;
}

export async function createFlashcard(data: NewFlashcard): Promise<Flashcard> {
  const result = await pool.query<FlashcardRow>(
    `INSERT INTO flashcards (question, answer, category_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [data.question, data.answer, data.categoryId]
  );
  return toFlashcard(result.rows[0]!);
}

export async function updateFlashcard(id: string, patch: FlashcardPatch): Promise<Flashcard | null> {
  const { sets, values, nextIndex } = buildUpdateSet(patch, {
    question: "question",
    answer: "answer",
    categoryId: "category_id",
  });
  const row = await updateById<FlashcardRow>("flashcards", id, sets, values, nextIndex);
  return row ? toFlashcard(row) : null;
}

export async function reviewFlashcard(id: string, correct: boolean, now: Date): Promise<Flashcard | null> {
  const existing = await pool.query<FlashcardRow>("SELECT box FROM flashcards WHERE id = $1", [id]);
  const row = existing.rows[0];
  if (!row) return null;

  const outcome = review(row.box, correct, now);

  const result = await pool.query<FlashcardRow>(
    `UPDATE flashcards
     SET box = $1, next_review_at = $2, last_reviewed_at = $3, updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [outcome.box, outcome.nextReviewAt, now, id]
  );
  return result.rows[0] ? toFlashcard(result.rows[0]) : null;
}

export async function removeFlashcard(id: string): Promise<boolean> {
  const result = await pool.query("DELETE FROM flashcards WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}
