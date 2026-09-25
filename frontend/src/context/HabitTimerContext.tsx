import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { incrementHabitCompletion } from "../services/habitService";
import { HabitTimerBar } from "../components/HabitTimerBar/HabitTimerBar";
import { alertApiError } from "../utils/apiError";
import { startAlarm, stopAlarm, unlockAudio } from "../utils/alarm";
import {
  isFinished,
  parseStoredTimer,
  pauseTimer,
  remainingMs,
  resumeTimer,
  startTimer,
  type HabitTimer,
} from "../utils/habitTimer";
import type { Habit } from "../types/habit";
import { HabitTimerContext, type HabitTimerRinging } from "./useHabitTimer";

const STORAGE_KEY = "remindme:habit-timer";

function readStored(): HabitTimer | null {
  try {
    return parseStoredTimer(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStored(timer: HabitTimer | null): void {
  try {
    if (timer) localStorage.setItem(STORAGE_KEY, JSON.stringify(timer));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* sem storage o timer só não sobrevive ao reload */
  }
}

/**
 * Com duas abas abertas as duas veem o fim; conclui só quem ainda encontra a
 * própria sessão no storage e a remove — a outra recebe o `storage` e desiste.
 * Sem storage não há com quem disputar.
 */
function claimFinish(timer: HabitTimer): boolean {
  try {
    const stored = parseStoredTimer(localStorage.getItem(STORAGE_KEY));
    if (!stored || stored.habitId !== timer.habitId || stored.startedAt !== timer.startedAt) {
      return false;
    }
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return true;
  }
}

async function notifyFinished(habitName: string): Promise<void> {
  // Na tela o card/faixa já avisam; a notificação é para a aba escondida.
  if (document.visibilityState === "visible") return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const options: NotificationOptions = {
    body: `${habitName} — sessão concluída, check registrado.`,
    tag: "habit-timer",
    icon: "/icon-192.png",
    badge: "/badge-96.png",
    requireInteraction: true,
    data: { url: "/habitos" },
  };
  const registration = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
  if (registration) await registration.showNotification("⏰ Tempo esgotado", options);
  else new Notification("⏰ Tempo esgotado", options);
}

export function HabitTimerProvider({ children }: { children: ReactNode }) {
  const [timer, setTimer] = useState<HabitTimer | null>(readStored);
  const [now, setNow] = useState(() => Date.now());
  const [ringing, setRinging] = useState<HabitTimerRinging | null>(null);
  const finishingRef = useRef<number | null>(null);

  const commit = useCallback((next: HabitTimer | null) => {
    setTimer(next);
    writeStored(next);
    setNow(Date.now());
  }, []);

  const running = timer !== null && timer.pausedAt === null;


  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setTimer(parseStoredTimer(event.newValue));
        setNow(Date.now());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const finish = useCallback((finished: HabitTimer) => {
    if (finishingRef.current === finished.startedAt) return;
    finishingRef.current = finished.startedAt;
    setTimer(null);
    if (!claimFinish(finished)) return;

    setRinging({ habitId: finished.habitId, habitName: finished.habitName });
    startAlarm();
    void notifyFinished(finished.habitName).catch(() => undefined);
    incrementHabitCompletion(finished.habitId, finished.dateKey)
      .then(() => window.dispatchEvent(new CustomEvent("habit-updated")))
      .catch((err) => alertApiError(err, "O tempo acabou, mas não deu para registrar o check."));
  }, []);

  // O primeiro tick vai já no próximo ciclo: cobre o reload com o tempo vencido, que
  // conclui na montagem. O som provavelmente não sai (nenhum gesto destravou o
  // áudio), e o "Tempo esgotado" fica visível.
  useEffect(() => {
    if (!timer || timer.pausedAt !== null) return;
    const tick = () => {
      const at = Date.now();
      if (isFinished(timer, at)) finish(timer);
      else setNow(at);
    };
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [timer, finish]);

  // Android congela a página com a tela apagada, e aí o alarme não sai. O lock é
  // solto pelo navegador quando a aba some, por isso é readquirido ao voltar.
  useEffect(() => {
    if (!running || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = () => {
      if (document.visibilityState !== "visible") return;
      navigator.wakeLock
        .request("screen")
        .then((sentinel) => {
          if (cancelled) void sentinel.release();
          else lock = sentinel;
        })
        .catch(() => undefined);
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release().catch(() => undefined);
    };
  }, [running]);

  const stopRinging = useCallback(() => {
    stopAlarm();
    setRinging(null);
  }, []);

  const start = useCallback(
    (habit: Habit) => {
      if (!habit.durationMinutes) return;
      // O toque no play é o gesto que libera o som que vai tocar lá no fim.
      unlockAudio();
      stopRinging();
      const current = readStored() ?? timer;
      if (
        current &&
        current.habitId !== habit.id &&
        !window.confirm(`Encerrar o timer de ${current.habitName} e começar ${habit.name}?`)
      ) {
        return;
      }
      commit(startTimer({ ...habit, durationMinutes: habit.durationMinutes }, Date.now()));
    },
    [timer, commit, stopRinging]
  );

  const pause = useCallback(() => {
    if (timer) commit(pauseTimer(timer, Date.now()));
  }, [timer, commit]);

  const resume = useCallback(() => {
    unlockAudio();
    if (timer) commit(resumeTimer(timer, Date.now()));
  }, [timer, commit]);

  const cancel = useCallback(() => commit(null), [commit]);

  const remaining = timer ? remainingMs(timer, now) : 0;

  const value = useMemo(
    () => ({ timer, remaining, ringing, start, pause, resume, cancel, stopRinging }),
    [timer, remaining, ringing, start, pause, resume, cancel, stopRinging]
  );

  return (
    <HabitTimerContext.Provider value={value}>
      {children}
      <HabitTimerBar />
    </HabitTimerContext.Provider>
  );
}
