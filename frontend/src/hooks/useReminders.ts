import { useCallback, useEffect } from "react";
import {
  fetchReminders,
  deleteReminder,
  acknowledgeReminder,
  rescheduleReminder,
  cancelReminder,
} from "../services/reminderService";
import { useFetchList } from "./useFetchList";
import type { Reminder, RescheduleInput } from "../types/reminder";

export function useReminders() {
  const {
    items: reminders,
    setItems: setReminders,
    loading,
    error,
    reload,
  } = useFetchList<Reminder>(() => fetchReminders("active"), "Não foi possível carregar os lembretes.");

  const applyUpdate = useCallback(
    (updated: Reminder) => {
      setReminders((prev) =>
        updated.status === "active"
          ? prev.map((r) => (r.id === updated.id ? updated : r))
          : prev.filter((r) => r.id !== updated.id)
      );
    },
    [setReminders]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteReminder(id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
    },
    [setReminders]
  );

  const acknowledge = useCallback(
    async (id: string) => applyUpdate(await acknowledgeReminder(id)),
    [applyUpdate]
  );

  const reschedule = useCallback(
    async (id: string, input: RescheduleInput) => applyUpdate(await rescheduleReminder(id, input)),
    [applyUpdate]
  );

  // Ações feitas pelos botões da notificação acontecem fora do React: o service
  // worker avisa as janelas abertas para a lista não ficar velha.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "reminder-updated") reload();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [reload]);

  const cancel = useCallback(
    async (id: string) => applyUpdate(await cancelReminder(id)),
    [applyUpdate]
  );

  return {
    reminders,
    loading,
    error,
    reload,
    remove,
    acknowledge,
    reschedule,
    cancel,
  };
}
