import { del, get, post, put } from "./api";
import type { Reminder, ReminderInput, ReminderStatus, RescheduleInput } from "../types/reminder";

export function fetchReminders(status?: ReminderStatus): Promise<Reminder[]> {
  return get<Reminder[]>("/api/reminders", status ? { status } : undefined);
}

export function fetchReminder(id: string): Promise<Reminder> {
  return get<Reminder>(`/api/reminders/${id}`);
}

export function createReminder(input: ReminderInput): Promise<Reminder> {
  return post<Reminder>("/api/reminders", input);
}

export function updateReminder(id: string, input: ReminderInput): Promise<Reminder> {
  return put<Reminder>(`/api/reminders/${id}`, input);
}

export function rescheduleReminder(id: string, input: RescheduleInput): Promise<Reminder> {
  return post<Reminder>(`/api/reminders/${id}/reschedule`, input);
}

export function deleteReminder(id: string): Promise<void> {
  return del(`/api/reminders/${id}`);
}

/**
 * `occurrenceAt` é o `event_at` que este cliente viu. O servidor descarta o clique
 * quando a série já andou — sem isso, dois cliques (aqui e na notificação de outro
 * aparelho) faziam um lembrete semanal saltar duas semanas.
 */
export function acknowledgeReminder(id: string, occurrenceAt?: string): Promise<Reminder> {
  return post<Reminder>(
    `/api/reminders/${id}/acknowledge`,
    occurrenceAt ? { occurrenceAt } : undefined
  );
}

export function cancelReminder(id: string): Promise<Reminder> {
  return post<Reminder>(`/api/reminders/${id}/cancel`);
}
