import { describe, it, expect } from "vitest";
import { calendarDateSchema, timeSchema } from "./validation.js";

const accepts = (value: string) => calendarDateSchema.safeParse(value).success;

describe("calendarDateSchema", () => {
  it("aceita data que existe", () => {
    expect(accepts("2026-06-18")).toBe(true);
    expect(accepts("2024-02-29")).toBe(true);
  });

  it("recusa dia que não existe no mês (antes virava o mês seguinte)", () => {
    expect(accepts("2026-02-30")).toBe(false);
    expect(accepts("2026-04-31")).toBe(false);
    expect(accepts("2025-02-29")).toBe(false);
  });

  it("recusa mês fora da faixa", () => {
    expect(accepts("2026-13-01")).toBe(false);
    expect(accepts("2026-00-10")).toBe(false);
  });

  it("recusa ano de dois dígitos disfarçado (0-99 mapeia para 1900-1999)", () => {
    expect(accepts("0026-06-18")).toBe(false);
  });

  it("recusa formato errado", () => {
    expect(accepts("18/06/2026")).toBe(false);
    expect(accepts("2026-6-8")).toBe(false);
  });
});

describe("timeSchema", () => {
  it("aceita 24h e recusa fora da faixa", () => {
    expect(timeSchema.safeParse("00:00").success).toBe(true);
    expect(timeSchema.safeParse("23:59").success).toBe(true);
    expect(timeSchema.safeParse("24:00").success).toBe(false);
    expect(timeSchema.safeParse("12:60").success).toBe(false);
  });
});
