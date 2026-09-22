import {
  acknowledgeSchema,
  createReminderSchema,
  updateReminderSchema,
  rescheduleSchema,
  snoozeSchema,
} from "../schemas/reminder.js";
import * as reminderModel from "../models/reminderModel.js";
import { parseEventAt, computeNextOccurrence, isPastEvent, isOnOrAfter, toSpParts, addMinutes } from "../lib/dateUtils.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { parseBody, requireUuid } from "../lib/validation.js";
import { finishOccurrence, initialSchedule } from "../services/reminderStateMachine.js";
import type { Response } from "express";
import type { Reminder, ReminderStatus } from "../types/reminder.js";

const VALID_STATUS: ReminderStatus[] = ["active", "done", "cancelled"];

const NOT_FOUND = "Lembrete não encontrado.";
const PAST_ERROR = "Não é possível agendar para uma data no passado.";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * `reminderModel.update` devolve null quando a linha sumiu entre o findById e o
 * UPDATE (outra aba apagou). Responder o null como 200 entrega `null` a um
 * cliente que espera objeto; aqui isso é 404.
 */
function respondUpdated(res: Response, reminder: Reminder | null): void {
  if (!reminder) {
    res.status(404).json({ error: NOT_FOUND });
    return;
  }
  res.json(reminder);
}

function formatSpRef(date: Date, isAllDay: boolean): string {
  const p = toSpParts(date);
  const day = `${pad(p.day)}/${pad(p.month + 1)}/${p.year}`;
  return isAllDay ? day : `${day} ${pad(p.hour)}:${pad(p.minute)}`;
}

export const getAll = asyncHandler("Erro ao buscar lembretes.", async (req, res) => {
  // O cast para string era mentira (no Express 5 a query pode vir array) e um valor
  // desconhecido caía no `undefined`: `?status=activo` devolvia **todos** os lembretes,
  // cancelados inclusive, com 200.
  const raw = req.query.status;
  if (raw !== undefined && (typeof raw !== "string" || !VALID_STATUS.includes(raw as ReminderStatus))) {
    res.status(400).json({ error: "Filtro de status inválido." });
    return;
  }
  const reminders = await reminderModel.findAll(raw as ReminderStatus | undefined);
  res.json(reminders);
});

export const getById = asyncHandler("Erro ao buscar lembrete.", async (req, res) => {
  const id = String(req.params.id);
  if (!requireUuid(res, id, NOT_FOUND)) return;
  const reminder = await reminderModel.findById(id);
  if (!reminder) {
    res.status(404).json({ error: NOT_FOUND });
    return;
  }
  res.json(reminder);
});

export const create = asyncHandler("Erro ao criar lembrete.", async (req, res) => {
  const body = parseBody(res, createReminderSchema, req.body);
  if (!body) return;
  const isAllDay = !body.time;
  const eventAt = parseEventAt(body.date, body.time ?? null);
  const now = new Date();
  if (isPastEvent(eventAt, isAllDay, now)) {
    res.status(400).json({ error: PAST_ERROR });
    return;
  }
  const sched = initialSchedule(eventAt, isAllDay, now);
  const isRecurring = Boolean(body.recurInterval);

  const reminder = await reminderModel.create({
    title: body.title,
    notes: body.notes ?? null,
    eventAt,
    isAllDay,
    recurInterval: body.recurInterval ?? null,
    recurUnit: body.recurUnit ?? null,
    recurWeekday: body.recurWeekday ?? null,
    recurMode: body.recurMode ?? "fixed",
    recurAnchorAt: isRecurring ? eventAt : null,
    maxNotify: body.maxNotify ?? 10,
    phase: sched.phase,
    nextNotifyAt: sched.nextNotifyAt,
  });
  res.status(201).json(reminder);
});

export const update = asyncHandler("Erro ao atualizar lembrete.", async (req, res) => {
  const id = String(req.params.id);
  if (!requireUuid(res, id, NOT_FOUND)) return;
  const existing = await reminderModel.findById(id);
  if (!existing) {
    res.status(404).json({ error: NOT_FOUND });
    return;
  }
  const body = parseBody(res, updateReminderSchema, req.body);
  if (!body) return;
  const isAllDay = !body.time;
  const eventAt = parseEventAt(body.date, body.time ?? null);
  const now = new Date();
  // "Não agende no passado" vale para mudança de horário, não para corrigir o
  // título de um lembrete já atrasado: se o agendamento não mudou, deixa passar.
  const scheduleChanged =
    eventAt.getTime() !== new Date(existing.eventAt).getTime() || isAllDay !== existing.isAllDay;
  if (scheduleChanged && isPastEvent(eventAt, isAllDay, now)) {
    res.status(400).json({ error: PAST_ERROR });
    return;
  }
  const sched = initialSchedule(eventAt, isAllDay, now);
  const isRecurring = Boolean(body.recurInterval);

  // Editar muda a regra: reinicia o ciclo e re-ancora a série no novo event_at.
  const reminder = await reminderModel.update(existing.id, {
    title: body.title,
    notes: body.notes ?? null,
    eventAt,
    isAllDay,
    recurInterval: body.recurInterval ?? null,
    recurUnit: body.recurUnit ?? null,
    recurWeekday: body.recurWeekday ?? null,
    recurMode: isRecurring ? body.recurMode ?? "fixed" : "fixed",
    recurAnchorAt: isRecurring ? eventAt : null,
    maxNotify: body.maxNotify ?? existing.maxNotify,
    status: "active",
    phase: sched.phase,
    nextNotifyAt: sched.nextNotifyAt,
    notifyCount: 0,
    acknowledged: false,
    acknowledgedAt: null,
  });
  respondUpdated(res, reminder);
});

export const reschedule = asyncHandler("Erro ao remarcar lembrete.", async (req, res) => {
  const id = String(req.params.id);
  if (!requireUuid(res, id, NOT_FOUND)) return;
  const existing = await reminderModel.findById(id);
  if (!existing) {
    res.status(404).json({ error: NOT_FOUND });
    return;
  }
  const body = parseBody(res, rescheduleSchema, req.body);
  if (!body) return;
  if (existing.status !== "active") {
    res.status(400).json({ error: "Só é possível remarcar um lembrete ativo." });
    return;
  }
  // Remarcar move só esta ocorrência: preserva o tipo e a regra/âncora da série.
  if (!existing.isAllDay && !body.time) {
    res.status(400).json({ error: "Informe a hora para remarcar este lembrete." });
    return;
  }
  const eventAt = parseEventAt(body.date, existing.isAllDay ? null : body.time ?? null);
  const now = new Date();
  if (isPastEvent(eventAt, existing.isAllDay, now)) {
    res.status(400).json({ error: PAST_ERROR });
    return;
  }
  // Fixo recorrente: não pode empurrar a ocorrência atual para além do próximo agendamento.
  if (existing.recurInterval && existing.recurUnit && existing.recurMode === "fixed") {
    const next = computeNextOccurrence(
      new Date(existing.recurAnchorAt ?? existing.eventAt),
      existing.recurInterval,
      existing.recurUnit,
      existing.recurWeekday
    );
    if (isOnOrAfter(eventAt, next, existing.isAllDay)) {
      res.status(400).json({
        error: `Não é possível remarcar para depois do próximo agendamento (${formatSpRef(next, existing.isAllDay)}).`,
      });
      return;
    }
  }
  const sched = initialSchedule(eventAt, existing.isAllDay, now);

  const reminder = await reminderModel.update(existing.id, {
    eventAt,
    status: "active",
    phase: sched.phase,
    nextNotifyAt: sched.nextNotifyAt,
    notifyCount: 0,
    acknowledged: false,
    acknowledgedAt: null,
  });
  respondUpdated(res, reminder);
});

export const remove = asyncHandler("Erro ao remover lembrete.", async (req, res) => {
  const id = String(req.params.id);
  if (!requireUuid(res, id, NOT_FOUND)) return;
  const removed = await reminderModel.remove(id);
  if (!removed) {
    res.status(404).json({ error: NOT_FOUND });
    return;
  }
  res.status(204).send();
});

export const acknowledge = asyncHandler("Erro ao confirmar lembrete.", async (req, res) => {
  const id = String(req.params.id);
  if (!requireUuid(res, id, NOT_FOUND)) return;
  const reminder = await reminderModel.findById(id);
  if (!reminder) {
    res.status(404).json({ error: NOT_FOUND });
    return;
  }
  const body = parseBody(res, acknowledgeSchema, req.body ?? {});
  if (!body) return;
  if (reminder.status !== "active") {
    res.status(400).json({ error: "Só é possível concluir um lembrete ativo." });
    return;
  }
  if (body.occurrenceAt) {
    const seen = new Date(body.occurrenceAt).getTime();
    if (Number.isNaN(seen)) {
      res.status(400).json({ error: "Ocorrência inválida." });
      return;
    }
    // A série já andou: este clique é de uma ocorrência encerrada (outro aparelho, ou
    // duplo toque). Devolve o estado atual em vez de avançar a série outra vez.
    if (seen !== new Date(reminder.eventAt).getTime()) {
      res.json(reminder);
      return;
    }
  }
  const now = new Date();
  const patch = finishOccurrence(reminder, now);
  if (patch.status === "done") {
    patch.acknowledged = true;
    patch.acknowledgedAt = now;
  }
  const updated = await reminderModel.update(reminder.id, patch);
  respondUpdated(res, updated);
});

export const snooze = asyncHandler("Erro ao adiar lembrete.", async (req, res) => {
  const id = String(req.params.id);
  if (!requireUuid(res, id, NOT_FOUND)) return;
  const existing = await reminderModel.findById(id);
  if (!existing) {
    res.status(404).json({ error: NOT_FOUND });
    return;
  }
  const body = parseBody(res, snoozeSchema, req.body);
  if (!body) return;
  if (existing.status !== "active") {
    res.status(400).json({ error: "Só é possível adiar um lembrete ativo." });
    return;
  }
  // Soneca adia só o aviso: o event_at da ocorrência não se move (é o que
  // separa soneca de remarcar). notifyCount volta a zero para o maxNotify não
  // travar sonecas seguidas, que são sempre ação explícita do usuário.
  const reminder = await reminderModel.update(existing.id, {
    phase: "snoozed",
    nextNotifyAt: addMinutes(new Date(), body.minutes),
    notifyCount: 0,
  });
  respondUpdated(res, reminder);
});

export const cancel = asyncHandler("Erro ao cancelar lembrete.", async (req, res) => {
  const id = String(req.params.id);
  if (!requireUuid(res, id, NOT_FOUND)) return;
  const reminder = await reminderModel.findById(id);
  if (!reminder) {
    res.status(404).json({ error: NOT_FOUND });
    return;
  }
  const updated = await reminderModel.update(reminder.id, { status: "cancelled", nextNotifyAt: null });
  respondUpdated(res, updated);
});
