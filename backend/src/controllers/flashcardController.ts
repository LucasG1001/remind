import {
  createFlashcardSchema,
  reviewFlashcardSchema,
  updateFlashcardSchema,
} from "../schemas/flashcard.js";
import * as flashcardModel from "../models/flashcardModel.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { parseBody, requireUuid } from "../lib/validation.js";

const FLASHCARD_NOT_FOUND = "Flashcard não encontrado.";

export const getFlashcards = asyncHandler("Erro ao buscar flashcards.", async (_req, res) => {
  const flashcards = await flashcardModel.findAll();
  res.json(flashcards);
});

export const getDueFlashcards = asyncHandler("Erro ao buscar flashcards.", async (_req, res) => {
  const flashcards = await flashcardModel.findDue();
  res.json(flashcards);
});

export const getFlashcard = asyncHandler("Erro ao buscar flashcard.", async (req, res) => {
  const id = String(req.params.id);
  if (!requireUuid(res, id, FLASHCARD_NOT_FOUND)) return;
  const flashcard = await flashcardModel.findById(id);
  if (!flashcard) {
    res.status(404).json({ error: FLASHCARD_NOT_FOUND });
    return;
  }
  res.json(flashcard);
});

export const createFlashcard = asyncHandler("Erro ao criar flashcard.", async (req, res) => {
  const body = parseBody(res, createFlashcardSchema, req.body);
  if (!body) return;
  const flashcard = await flashcardModel.createFlashcard(body);
  res.status(201).json(flashcard);
});

export const updateFlashcard = asyncHandler("Erro ao atualizar flashcard.", async (req, res) => {
  const id = String(req.params.id);
  if (!requireUuid(res, id, FLASHCARD_NOT_FOUND)) return;
  const body = parseBody(res, updateFlashcardSchema, req.body);
  if (!body) return;
  const flashcard = await flashcardModel.updateFlashcard(id, body);
  if (!flashcard) {
    res.status(404).json({ error: FLASHCARD_NOT_FOUND });
    return;
  }
  res.json(flashcard);
});

export const reviewFlashcard = asyncHandler("Erro ao revisar flashcard.", async (req, res) => {
  const id = String(req.params.id);
  if (!requireUuid(res, id, FLASHCARD_NOT_FOUND)) return;
  const body = parseBody(res, reviewFlashcardSchema, req.body);
  if (!body) return;
  const flashcard = await flashcardModel.reviewFlashcard(id, body.correct, new Date());
  if (!flashcard) {
    res.status(404).json({ error: FLASHCARD_NOT_FOUND });
    return;
  }
  res.json(flashcard);
});

export const removeFlashcard = asyncHandler("Erro ao remover flashcard.", async (req, res) => {
  const id = String(req.params.id);
  if (!requireUuid(res, id, FLASHCARD_NOT_FOUND)) return;
  const removed = await flashcardModel.removeFlashcard(id);
  if (!removed) {
    res.status(404).json({ error: FLASHCARD_NOT_FOUND });
    return;
  }
  res.status(204).send();
});
