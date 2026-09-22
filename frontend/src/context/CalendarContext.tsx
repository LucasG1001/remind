import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { ReminderCalendar } from "../components/ReminderCalendar/ReminderCalendar";
import { fetchReminders } from "../services/reminderService";
import { groupRemindersByDay } from "../utils/agenda";
import type { Reminder } from "../types/reminder";
import { CalendarContext } from "./useCalendar";

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [byDay, setByDay] = useState<Map<string, Reminder[]>>(() => new Map());
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const open = useCallback(() => {
    setIsOpen(true);
    setError(null);
    // Duas aberturas rápidas disparavam duas buscas concorrentes, e a última a resolver
    // definia o conteúdo — qualquer que fosse a ordem em que foram pedidas.
    const request = requestRef.current + 1;
    requestRef.current = request;
    fetchReminders("active")
      .then((data) => {
        if (requestRef.current !== request) return;
        setByDay(groupRemindersByDay(data));
      })
      .catch(() => {
        if (requestRef.current !== request) return;
        // Calendário vazio por falha de rede era idêntico a "nenhum lembrete".
        setError("Não foi possível carregar os lembretes do calendário.");
        setByDay(new Map());
      });
  }, []);

  // O provider envolve o app inteiro: sem o memo, cada mudança de isOpen/byDay
  // re-renderizava todos os consumidores de useCalendar (TopNav, Dashboard, rail).
  const value = useMemo(() => ({ open }), [open]);

  return (
    <CalendarContext.Provider value={value}>
      {children}
      {isOpen && (
        <ReminderCalendar byDay={byDay} error={error} onClose={() => setIsOpen(false)} />
      )}
    </CalendarContext.Provider>
  );
}
