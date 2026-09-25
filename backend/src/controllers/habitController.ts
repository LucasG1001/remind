import {
  completionCountSchema,
  createHabitSchema,
  habitReminderSchema,
  reminderCompleteSchema,
  reminderSkipSchema,
  reorderHabitsSchema,
  updateHabitSchema,
} from "../schemas/habit.js";
import * as habitModel from "../models/habitModel.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { calendarDateSchema, parseBody, requireUuid } from "../lib/validation.js";

const HABIT_NOT_FOUND = "Hábito não encontrado.";
const REMINDER_NOT_FOUND = "Horário de aviso não encontrado.";

export const getAll = asyncHandler("Erro ao buscar hábitos.", async (_req, res) => {
  const habits = await habitModel.findAll();
  res.json(habits);
});

export const create = asyncHandler("Erro ao criar hábito.", async (req, res) => {
  const body = parseBody(res, createHabitSchema, req.body);
  if (!body) return;
  const habit = await habitModel.create(body);
  res.status(201).json(habit);
});

export const update = asyncHandler("Erro ao atualizar hábito.", async (req, res) => {
  const id = String(req.params.id);
  if (!requireUuid(res, id, HABIT_NOT_FOUND)) return;
  const body = parseBody(res, updateHabitSchema, req.body);
  if (!body) return;
  const habit = await habitModel.update(id, body);
  if (!habit) {
    res.status(404).json({ error: HABIT_NOT_FOUND });
    return;
  }
  res.json(habit);
});

export const reorder = asyncHandler("Erro ao reordenar hábitos.", async (req, res) => {
  const body = parseBody(res, reorderHabitsSchema, req.body);
  if (!body) return;
  const habits = await habitModel.reorder(body.order);
  res.json(habits);
});

export const remove = asyncHandler("Erro ao remover hábito.", async (req, res) => {
  const id = String(req.params.id);
  if (!requireUuid(res, id, HABIT_NOT_FOUND)) return;
  const removed = await habitModel.remove(id);
  if (!removed) {
    res.status(404).json({ error: HABIT_NOT_FOUND });
    return;
  }
  res.status(204).send();
});

export const setCompletion = asyncHandler("Erro ao atualizar conclusão.", async (req, res) => {
  const id = String(req.params.id);
  const date = String(req.params.date);
  if (!requireUuid(res, id, HABIT_NOT_FOUND)) return;
  // Mesma validação dos corpos: a data vem na URL, mas "2026-02-30" também não pode
  // virar 02/03 aqui.
  if (!calendarDateSchema.safeParse(date).success) {
    res.status(400).json({ error: "Data inválida (use YYYY-MM-DD)." });
    return;
  }
  const parsedBody = parseBody(res, completionCountSchema, req.body);
  if (!parsedBody) return;

  const { count } = parsedBody;
  if (count <= 0) {
    await habitModel.clearCompletion(id, date);
  } else {
    await habitModel.setCompletionCount(id, date, count);
  }

  const habit = await habitModel.findById(id);
  if (!habit) {
    res.status(404).json({ error: "Hábito não encontrado." });
    return;
  }
  res.json(habit);
});

/** Fim de uma sessão de timer: soma um check sem passar da meta. */
export const incrementCompletion = asyncHandler("Erro ao registrar a sessão.", async (req, res) => {
  const id = String(req.params.id);
  const date = String(req.params.date);
  if (!requireUuid(res, id, HABIT_NOT_FOUND)) return;
  if (!calendarDateSchema.safeParse(date).success) {
    res.status(400).json({ error: "Data inválida (use YYYY-MM-DD)." });
    return;
  }

  const found = await habitModel.incrementCompletion(id, date);
  const habit = found ? await habitModel.findById(id) : null;
  if (!habit) {
    res.status(404).json({ error: HABIT_NOT_FOUND });
    return;
  }
  res.json(habit);
});

export const addReminder = asyncHandler("Erro ao adicionar horário.", async (req, res) => {
  const id = String(req.params.id);
  if (!requireUuid(res, id, HABIT_NOT_FOUND)) return;
  const body = parseBody(res, habitReminderSchema, req.body);
  if (!body) return;

  const ok = await habitModel.addReminder(id, body.time);
  if (!ok) {
    res.status(404).json({ error: HABIT_NOT_FOUND });
    return;
  }
  res.status(201).json(await habitModel.findById(id));
});

export const removeReminder = asyncHandler("Erro ao remover horário.", async (req, res) => {
  const reminderId = String(req.params.reminderId);
  if (!requireUuid(res, reminderId, REMINDER_NOT_FOUND)) return;

  const habitId = await habitModel.removeReminder(reminderId);
  if (!habitId) {
    res.status(404).json({ error: REMINDER_NOT_FOUND });
    return;
  }
  res.json(await habitModel.findById(habitId));
});

export const skipReminder = asyncHandler("Erro ao desligar o aviso.", async (req, res) => {
  const reminderId = String(req.params.reminderId);
  if (!requireUuid(res, reminderId, REMINDER_NOT_FOUND)) return;
  const body = parseBody(res, reminderSkipSchema, req.body);
  if (!body) return;

  const habitId = await habitModel.setReminderSkipped(reminderId, body.date, body.skipped);
  if (!habitId) {
    res.status(404).json({ error: REMINDER_NOT_FOUND });
    return;
  }
  res.json(await habitModel.findById(habitId));
});

/** Alvo do botão "Concluir" da notificação: idempotente por horário. */
export const completeReminder = asyncHandler("Erro ao concluir o hábito.", async (req, res) => {
  const id = String(req.params.id);
  if (!requireUuid(res, id, HABIT_NOT_FOUND)) return;
  const body = parseBody(res, reminderCompleteSchema, req.body);
  if (!body) return;

  // O índice vem do servidor sempre que o payload trouxe o slotId: o índice do push
  // envelhece, e um índice fora da lista marcaria o dia inteiro como concluído.
  const slotIds = await habitModel.reminderSlotIds(id);
  const slotIndex = body.slotId ? slotIds.indexOf(body.slotId) : body.slotIndex;
  if (slotIndex < 0 || slotIndex >= slotIds.length) {
    res.status(404).json({ error: REMINDER_NOT_FOUND });
    return;
  }

  const count = await habitModel.satisfyReminderSlot(id, slotIndex, body.date);
  if (count === null) {
    res.status(404).json({ error: HABIT_NOT_FOUND });
    return;
  }
  res.json({ count });
});
