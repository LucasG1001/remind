import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { DayOfWeek, HabitCompletion } from "../types/habit";
import { addDays, formatDateKey, getToday, parseDate } from "./dateUtils";
import { calculateLevelProgress, LEVEL_DROP_MISSES, LEVEL_STEP } from "./levelUtils";
import { buildDayContext, dayState } from "./heatmap";
import { calculateCurrentStreak } from "./streakUtils";

// "Hoje" fixo em 18/06/2026 (quinta, weekday 4), 12:00 de São Paulo: a varredura de
// nível vai de createdAt até hoje, então sem relógio fixo o resultado muda por dia.
const TODAY = new Date("2026-06-18T15:00:00.000Z");
const ALL_DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];
/** Hoje é quinta: um hábito só de quintas deixa os demais dias fora da agenda. */
const THURSDAY: DayOfWeek[] = [4];

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TODAY);
});

afterAll(() => {
  vi.useRealTimers();
});

/** Chave YYYY-MM-DD de N dias atrás (0 = hoje). */
function dayKey(back: number): string {
  return formatDateKey(addDays(getToday(), -back));
}

/** ISO do instante correspondente a N dias atrás, para usar como createdAt. */
function createdDaysAgo(back: number): string {
  return new Date(TODAY.getTime() - back * 86_400_000).toISOString();
}

function completedOn(keys: string[]): HabitCompletion[] {
  return keys.map((date) => ({ date, count: 1, completed: true }));
}

/** Dias fechados (de `from` até 1 dia atrás), do mais antigo para o mais recente. */
function closedDays(from: number): string[] {
  const keys: string[] = [];
  for (let back = from; back >= 1; back--) keys.push(dayKey(back));
  return keys;
}

describe("calculateLevelProgress", () => {
  it("sem dias agendados fica no nível 1", () => {
    expect(calculateLevelProgress([], [], createdDaysAgo(100))).toEqual({ level: 1, progress: 0 });
  });

  it("LEVEL_STEP concluídos seguidos sobem um nível e zeram o progresso", () => {
    const keys = [...closedDays(LEVEL_STEP - 1), dayKey(0)];
    expect(keys).toHaveLength(LEVEL_STEP);
    const result = calculateLevelProgress(
      completedOn(keys),
      ALL_DAYS,
      createdDaysAgo(LEVEL_STEP - 1)
    );
    expect(result).toEqual({ level: 2, progress: 0 });
  });

  it("hoje em branco não zera o progresso — o dia ainda não fechou", () => {
    const keys = closedDays(5);
    const result = calculateLevelProgress(completedOn(keys), ALL_DAYS, createdDaysAgo(5));
    expect(result).toEqual({ level: 1, progress: 5 });
  });

  it("um dia agendado perdido zera o progresso", () => {
    // Concluído de -5 a -3, nada em -2 e -1.
    const keys = [dayKey(5), dayKey(4), dayKey(3)];
    const result = calculateLevelProgress(completedOn(keys), ALL_DAYS, createdDaysAgo(5));
    expect(result.progress).toBe(0);
  });

  it("um bloco de LEVEL_DROP_MISSES perdidos seguidos derruba um nível", () => {
    // 30 concluídos (sobe para o nível 2), depois 3 dias fechados em branco.
    const span = LEVEL_STEP + LEVEL_DROP_MISSES;
    const keys = closedDays(span).slice(0, LEVEL_STEP);
    const result = calculateLevelProgress(completedOn(keys), ALL_DAYS, createdDaysAgo(span));
    expect(result).toEqual({ level: 1, progress: 0 });
  });

  it("o nível tem piso em 1", () => {
    const result = calculateLevelProgress([], ALL_DAYS, createdDaysAgo(60));
    expect(result.level).toBe(1);
  });

  it("dias fora da agenda não contam como falta", () => {
    // Só quintas: os outros seis dias da semana em branco não derrubam nada.
    const result = calculateLevelProgress(completedOn([dayKey(7)]), THURSDAY, createdDaysAgo(7));
    expect(result).toEqual({ level: 1, progress: 1 });
  });
});

describe("dayState", () => {
  const ctx = (selectedDays: DayOfWeek[], keys: string[], createdBack: number) =>
    buildDayContext({
      completions: completedOn(keys),
      selectedDays,
      createdAt: createdDaysAgo(createdBack),
    });

  it("dia agendado e concluído é 'completed'", () => {
    const context = ctx(ALL_DAYS, [dayKey(1)], 10);
    expect(dayState(parseDate(dayKey(1)), context)).toBe("completed");
  });

  it("um check num dia que saiu da agenda continua sendo 'completed'", () => {
    // Quarta (-1) concluída num hábito que hoje só roda às quintas: antes a célula
    // virava cinza "não agendado" e o check sumia do heatmap e dos totais.
    const context = ctx(THURSDAY, [dayKey(1)], 10);
    expect(dayState(parseDate(dayKey(1)), context)).toBe("completed");
  });

  it("dia fora da agenda e sem check é 'notScheduled'", () => {
    const context = ctx(THURSDAY, [], 10);
    expect(dayState(parseDate(dayKey(1)), context)).toBe("notScheduled");
  });

  it("hoje ainda em aberto é 'pending', não 'missed'", () => {
    const context = ctx(ALL_DAYS, [], 10);
    expect(dayState(getToday(), context)).toBe("pending");
  });

  it("dia fechado, agendado e sem check é 'missed'", () => {
    const context = ctx(ALL_DAYS, [], 10);
    expect(dayState(parseDate(dayKey(1)), context)).toBe("missed");
  });

  it("antes da criação do hábito é 'notScheduled'", () => {
    const context = ctx(ALL_DAYS, [], 3);
    expect(dayState(parseDate(dayKey(10)), context)).toBe("notScheduled");
  });

  it("depois de hoje é 'future'", () => {
    const context = ctx(ALL_DAYS, [], 10);
    expect(dayState(addDays(getToday(), 1), context)).toBe("future");
  });
});

describe("calculateCurrentStreak", () => {
  it("sem dias agendados a sequência é zero", () => {
    expect(calculateCurrentStreak(completedOn([dayKey(1)]), [])).toBe(0);
  });

  it("conta dias agendados concluídos de trás para frente", () => {
    const keys = [dayKey(3), dayKey(2), dayKey(1)];
    expect(calculateCurrentStreak(completedOn(keys), ALL_DAYS)).toBe(3);
  });

  it("hoje concluído entra na conta", () => {
    const keys = [dayKey(1), dayKey(0)];
    expect(calculateCurrentStreak(completedOn(keys), ALL_DAYS)).toBe(2);
  });

  it("hoje em branco não quebra a sequência dos dias fechados", () => {
    const keys = [dayKey(2), dayKey(1)];
    expect(calculateCurrentStreak(completedOn(keys), ALL_DAYS)).toBe(2);
  });

  it("um dia fechado em branco quebra a sequência", () => {
    const keys = [dayKey(3), dayKey(1)];
    expect(calculateCurrentStreak(completedOn([...keys]), ALL_DAYS)).toBe(1);
  });
});
