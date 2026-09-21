import { describe, it, expect } from "vitest";
import { decideHabitTick, nextPendingSlot, type HabitTickInput } from "./habitReminderState.js";
import { parseEventAt, spDateKey, toSpParts } from "../lib/dateUtils.js";

// 2026-06-18 é uma quinta-feira (weekday 4).
const DAY = "2026-06-18";
const at = (time: string) => parseEventAt(DAY, time);

function slot(id: string, time: string, over: Partial<{ skipped: boolean; lastSentAt: Date | null }> = {}) {
  return { id, time, skipped: false, lastSentAt: null, ...over };
}

function makeInput(over: Partial<HabitTickInput> = {}): HabitTickInput {
  return {
    habitId: "h1",
    habitName: "Beber água",
    targetCount: 3,
    selectedDays: [0, 1, 2, 3, 4, 5, 6],
    slots: [slot("s0", "08:00"), slot("s1", "12:00"), slot("s2", "18:00")],
    count: 0,
    locked: false,
    todayKey: DAY,
    now: at("08:00"),
    ...over,
  };
}

describe("dia e agendamento", () => {
  it("quinta-feira é weekday 4 — a convenção bate com selected_days", () => {
    expect(toSpParts(at("08:00")).weekday).toBe(4);
  });

  it("não avisa em dia fora de selected_days", () => {
    expect(decideHabitTick(makeInput({ selectedDays: [0, 6] }))).toBeNull();
  });

  it("não avisa sem horários configurados", () => {
    expect(decideHabitTick(makeInput({ slots: [] }))).toBeNull();
  });

  it("não avisa antes da hora", () => {
    expect(decideHabitTick(makeInput({ now: at("07:59") }))).toBeNull();
  });

  it("conclusão travada não avisa nunca", () => {
    expect(decideHabitTick(makeInput({ locked: true }))).toBeNull();
  });
});

describe("janela de insistência", () => {
  it("dispara no horário exato", () => {
    const send = decideHabitTick(makeInput({ now: at("08:00") }));
    expect(send).toMatchObject({ slotId: "s0", slotIndex: 0 });
    expect(send!.firedAt.toISOString()).toBe(at("08:00").toISOString());
  });

  it("alinha à grade de 5 min em vez de now + 5min", () => {
    const send = decideHabitTick(makeInput({ now: at("08:12") }));
    expect(send!.firedAt.toISOString()).toBe(at("08:10").toISOString());
  });

  it("não repete o mesmo ponto de grade", () => {
    const slots = [slot("s0", "08:00", { lastSentAt: at("08:10") }), slot("s1", "12:00"), slot("s2", "18:00")];
    expect(decideHabitTick(makeInput({ slots, now: at("08:12") }))).toBeNull();
    expect(decideHabitTick(makeInput({ slots, now: at("08:15") }))).toMatchObject({ slotIndex: 0 });
  });

  it("são 5 insistências: +0, +5, +10, +15, +20", () => {
    const fired: string[] = [];
    let last: Date | null = null;
    for (let m = 0; m <= 30; m++) {
      const slots = [slot("s0", "08:00", { lastSentAt: last }), slot("s1", "12:00"), slot("s2", "18:00")];
      const send = decideHabitTick(makeInput({ slots, now: new Date(at("08:00").getTime() + m * 60_000) }));
      if (send) {
        fired.push(send.time === "08:00" ? `+${m}` : "?");
        last = send.firedAt;
      }
    }
    expect(fired).toEqual(["+0", "+5", "+10", "+15", "+20"]);
  });

  it("a janela fecha aos 25 min e o horário é cancelado", () => {
    const slots = [slot("s0", "08:00", { lastSentAt: at("08:20") }), slot("s1", "12:00"), slot("s2", "18:00")];
    expect(decideHabitTick(makeInput({ slots, now: at("08:25") }))).toBeNull();
    expect(decideHabitTick(makeInput({ slots, now: at("09:00") }))).toBeNull();
  });

  it("horário seguinte assume quando o anterior esgotou", () => {
    const send = decideHabitTick(makeInput({ now: at("12:00") }));
    expect(send).toMatchObject({ slotId: "s1", slotIndex: 1 });
  });

  it("um horário nunca invade a janela do seguinte", () => {
    const slots = [slot("s0", "08:00"), slot("s1", "08:10")];
    const send = decideHabitTick(makeInput({ slots, targetCount: 2, now: at("08:12") }));
    expect(send).toMatchObject({ slotId: "s1" });
  });

  it("horário de 23:45 é cortado na meia-noite, não vaza para o dia seguinte", () => {
    const slots = [slot("s0", "23:45", { lastSentAt: at("23:55") })];
    const input = makeInput({ slots, targetCount: 1, now: parseEventAt("2026-06-19", "00:05") });
    expect(decideHabitTick(input)).toBeNull();
  });
});

describe("check cancela e desfazer reativa", () => {
  it("um check satisfaz o primeiro horário", () => {
    const slots = [slot("s0", "08:00", { lastSentAt: at("08:05") }), slot("s1", "12:00"), slot("s2", "18:00")];
    expect(decideHabitTick(makeInput({ slots, count: 1, now: at("08:10") }))).toBeNull();
  });

  it("desfazer de 3 para 2 reativa o índice 2", () => {
    const slots = [slot("s0", "08:00"), slot("s1", "12:00"), slot("s2", "18:00")];
    expect(decideHabitTick(makeInput({ slots, count: 3, now: at("18:05") }))).toBeNull();
    expect(decideHabitTick(makeInput({ slots, count: 2, now: at("18:05") }))).toMatchObject({ slotIndex: 2 });
  });

  it("desfazer fora da janela não ressuscita um aviso antigo", () => {
    const slots = [slot("s0", "08:00"), slot("s1", "12:00"), slot("s2", "18:00")];
    expect(decideHabitTick(makeInput({ slots, count: 1, now: at("19:00") }))).toBeNull();
  });

  it("pular desliga só aquele horário", () => {
    const slots = [slot("s0", "08:00", { skipped: true }), slot("s1", "12:00"), slot("s2", "18:00")];
    expect(decideHabitTick(makeInput({ slots, now: at("08:05") }))).toBeNull();
    expect(decideHabitTick(makeInput({ slots, now: at("12:00") }))).toMatchObject({ slotIndex: 1 });
  });
});

describe("meta menor que a lista de horários", () => {
  it("horário acima da meta não avisa", () => {
    const slots = [slot("s0", "08:00"), slot("s1", "12:00"), slot("s2", "18:00")];
    expect(decideHabitTick(makeInput({ slots, targetCount: 2, now: at("18:00") }))).toBeNull();
  });

  it("contagem herdada acima da meta não estoura o índice", () => {
    const slots = [slot("s0", "08:00"), slot("s1", "12:00"), slot("s2", "18:00")];
    expect(decideHabitTick(makeInput({ slots, targetCount: 2, count: 5, now: at("12:00") }))).toBeNull();
  });
});

describe("nextPendingSlot", () => {
  it("aponta o horário que o app deve oferecer para desligar", () => {
    expect(nextPendingSlot(makeInput({ count: 1, now: at("09:00") }))).toMatchObject({ index: 1 });
  });

  it("nada pendente depois de cumprir a meta", () => {
    expect(nextPendingSlot(makeInput({ count: 3, now: at("09:00") }))).toBeNull();
  });
});

describe("spDateKey", () => {
  it("usa o dia-calendário de SP, não o do servidor", () => {
    // 02:00 UTC de 19/06 ainda é 23:00 de 18/06 em SP.
    expect(spDateKey(new Date("2026-06-19T02:00:00.000Z"))).toBe("2026-06-18");
  });
});
