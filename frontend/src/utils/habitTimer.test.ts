import { describe, it, expect } from "vitest";
import {
  formatRemaining,
  isFinished,
  parseStoredTimer,
  pauseTimer,
  remainingMs,
  resumeTimer,
  startTimer,
} from "./habitTimer";

const MIN = 60_000;
// 12:00 de SP em 18/06/2026.
const NOON = Date.parse("2026-06-18T15:00:00.000Z");
const habit = { id: "h1", name: "Inglês", durationMinutes: 30 };

describe("habitTimer", () => {
  it("conta o restante a partir do início", () => {
    const t = startTimer(habit, NOON);
    expect(remainingMs(t, NOON)).toBe(30 * MIN);
    expect(remainingMs(t, NOON + 10 * MIN)).toBe(20 * MIN);
  });

  it("termina exatamente na duração e não fica negativo", () => {
    const t = startTimer(habit, NOON);
    expect(isFinished(t, NOON + 30 * MIN - 1)).toBe(false);
    expect(isFinished(t, NOON + 30 * MIN)).toBe(true);
    expect(remainingMs(t, NOON + 90 * MIN)).toBe(0);
  });

  it("pausado, o restante congela", () => {
    const paused = pauseTimer(startTimer(habit, NOON), NOON + 5 * MIN);
    expect(remainingMs(paused, NOON + 60 * MIN)).toBe(25 * MIN);
    expect(isFinished(paused, NOON + 60 * MIN)).toBe(false);
  });

  it("pausas acumulam no pausedMs", () => {
    let t = startTimer(habit, NOON);
    t = pauseTimer(t, NOON + 5 * MIN);
    t = resumeTimer(t, NOON + 15 * MIN);
    t = pauseTimer(t, NOON + 20 * MIN);
    t = resumeTimer(t, NOON + 22 * MIN);
    expect(t.pausedMs).toBe(12 * MIN);
    expect(remainingMs(t, NOON + 22 * MIN)).toBe(20 * MIN);
  });

  it("pausar/retomar duas vezes seguidas não altera o estado", () => {
    const t = pauseTimer(startTimer(habit, NOON), NOON + MIN);
    expect(pauseTimer(t, NOON + 5 * MIN)).toBe(t);
    const running = resumeTimer(t, NOON + 2 * MIN);
    expect(resumeTimer(running, NOON + 3 * MIN)).toBe(running);
  });

  it("a sessão que cruza a meia-noite conta no dia do início", () => {
    // 23:50 de SP em 18/06 = 02:50 UTC de 19/06.
    const t = startTimer(habit, Date.parse("2026-06-19T02:50:00.000Z"));
    expect(t.dateKey).toBe("2026-06-18");
  });

  it("formata mm:ss e h:mm:ss arredondando para cima", () => {
    expect(formatRemaining(30 * MIN)).toBe("30:00");
    expect(formatRemaining(61_001)).toBe("01:02");
    expect(formatRemaining(1)).toBe("00:01");
    expect(formatRemaining(0)).toBe("00:00");
    expect(formatRemaining(90 * MIN)).toBe("1:30:00");
  });

  it("rejeita storage malformado", () => {
    const t = startTimer(habit, NOON);
    expect(parseStoredTimer(JSON.stringify(t))).toEqual(t);
    expect(parseStoredTimer(null)).toBeNull();
    expect(parseStoredTimer("{")).toBeNull();
    expect(parseStoredTimer(JSON.stringify({ ...t, startedAt: "x" }))).toBeNull();
  });
});
