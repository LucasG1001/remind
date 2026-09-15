import { describe, it, expect } from "vitest";
import { boxIntervalDays, review } from "./flashcardScheduler.js";
import { parseEventAt, toSpParts } from "../lib/dateUtils.js";

const NOW = parseEventAt("2026-07-02", "20:00");

describe("intervalo por caixa", () => {
  it("dobra a partir do primeiro acerto", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(boxIntervalDays)).toEqual([1, 1, 2, 4, 8, 16, 32]);
  });

  it("não deixa a data estourar se a caixa vier corrompida", () => {
    expect(boxIntervalDays(500)).toBe(36500);
    expect(Number.isNaN(review(500, true, NOW).nextReviewAt.getTime())).toBe(false);
  });
});

describe("Leitner acerto", () => {
  it("sobe uma caixa e agenda pelo intervalo da nova caixa", () => {
    const r = review(1, true, NOW);
    expect(r.box).toBe(2);
    expect(toSpParts(r.nextReviewAt)).toMatchObject({ day: 3, hour: 4, minute: 0 });
  });

  it("dobra o intervalo a cada acerto seguinte", () => {
    expect(toSpParts(review(2, true, NOW).nextReviewAt)).toMatchObject({ day: 4 });
    expect(toSpParts(review(3, true, NOW).nextReviewAt)).toMatchObject({ day: 6 });
    expect(toSpParts(review(4, true, NOW).nextReviewAt)).toMatchObject({ day: 10 });
  });

  it("não tem teto de caixa", () => {
    const r = review(9, true, NOW);
    expect(r.box).toBe(10);
    expect(boxIntervalDays(r.box)).toBe(256);
  });
});

describe("Leitner erro", () => {
  it("volta para a caixa 1 e reagenda para o dia seguinte", () => {
    const r = review(4, false, NOW);
    expect(r.box).toBe(1);
    expect(toSpParts(r.nextReviewAt)).toMatchObject({ day: 3, hour: 4 });
  });
});

describe("Leitner robustez", () => {
  it("normaliza caixas inválidas para 1 antes de avançar", () => {
    expect(review(0, true, NOW).box).toBe(2);
    expect(review(Number.NaN, true, NOW).box).toBe(2);
  });
});

describe("normalização para 04:00 SP", () => {
  it("acerto às 23:30 vence às 04:00 do dia-alvo", () => {
    const lateNight = parseEventAt("2026-07-02", "23:30");
    const r = review(1, true, lateNight);
    expect(toSpParts(r.nextReviewAt)).toMatchObject({ day: 3, hour: 4, minute: 0 });
  });

  it("acerto às 01:00 conta a partir do dia civil corrente", () => {
    const earlyMorning = parseEventAt("2026-07-03", "01:00");
    const r = review(1, true, earlyMorning);
    expect(toSpParts(r.nextReviewAt)).toMatchObject({ day: 4, hour: 4, minute: 0 });
  });
});
