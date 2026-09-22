import { describe, it, expect } from "vitest";
import { createReminderSchema, updateReminderSchema } from "./reminder.js";

const base = { title: "Reunião", date: "2026-06-18", time: "14:00" };

describe("maxNotify", () => {
  it("recusa 1 e 2: a contagem inclui os avisos de antecedência, então o aviso da hora nunca chegaria", () => {
    expect(createReminderSchema.safeParse({ ...base, maxNotify: 1 }).success).toBe(false);
    expect(createReminderSchema.safeParse({ ...base, maxNotify: 2 }).success).toBe(false);
    expect(createReminderSchema.safeParse({ ...base, maxNotify: 3 }).success).toBe(true);
  });
});

describe("create vs update", () => {
  it("criar aceita omitir a hora (vira dia inteiro)", () => {
    expect(createReminderSchema.safeParse({ title: "x", date: "2026-06-18" }).success).toBe(true);
  });

  it("atualizar exige a hora explícita: omitir convertia o lembrete em dia inteiro", () => {
    expect(updateReminderSchema.safeParse({ title: "x", date: "2026-06-18" }).success).toBe(false);
    expect(updateReminderSchema.safeParse({ title: "x", date: "2026-06-18", time: null }).success).toBe(true);
    expect(updateReminderSchema.safeParse({ ...base }).success).toBe(true);
  });
});

describe("recorrência", () => {
  it("intervalo e unidade andam juntos", () => {
    expect(createReminderSchema.safeParse({ ...base, recurInterval: 1 }).success).toBe(false);
    expect(createReminderSchema.safeParse({ ...base, recurUnit: "week" }).success).toBe(false);
    expect(createReminderSchema.safeParse({ ...base, recurInterval: 1, recurUnit: "week" }).success).toBe(true);
  });
});
