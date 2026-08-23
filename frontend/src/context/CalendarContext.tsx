import { useCallback, useState, type ReactNode } from "react";
import { ReminderCalendar } from "../components/ReminderCalendar/ReminderCalendar";
import { fetchReminders } from "../services/reminderService";
import { groupRemindersByDay } from "../utils/agenda";
import type { Reminder } from "../types/reminder";
import { CalendarContext } from "./useCalendar";

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [byDay, setByDay] = useState<Map<string, Reminder[]>>(() => new Map());

  const open = useCallback(() => {
    setIsOpen(true);
    fetchReminders("active")
      .then((data) => setByDay(groupRemindersByDay(data)))
      .catch(() => setByDay(new Map()));
  }, []);

  return (
    <CalendarContext.Provider value={{ open }}>
      {children}
      {isOpen && <ReminderCalendar byDay={byDay} onClose={() => setIsOpen(false)} />}
    </CalendarContext.Provider>
  );
}
