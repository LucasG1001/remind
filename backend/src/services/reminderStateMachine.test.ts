import { describe, it, expect } from "vitest";
import { decide, initialSchedule, finishOccurrence } from "./reminderStateMachine.js";
import { parseEventAt, toSpParts } from "../lib/dateUtils.js";
import type { Reminder } from "../types/reminder.js";

const ID = "11111111-2222-4333-8444-555555555555";

function makeReminder(over: Partial<Reminder>): Reminder {
  return {
    id: ID,
    title: "Reunião",
    notes: null,
    eventAt: parseEventAt("2026-06-18", "14:00").toISOString(),
    isAllDay: false,
    recurInterval: null,
    recurUnit: null,
    recurWeekday: null,
    recurMode: "fixed",
    recurAnchorAt: null,
    status: "active",
    phase: "pending",
    nextNotifyAt: null,
    notifyCount: 0,
    maxNotify: 10,
    acknowledged: false,
    acknowledgedAt: null,
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

describe("initialSchedule", () => {
  it("evento com hora no futuro começa 30 min antes", () => {
    const event = parseEventAt("2026-06-18", "14:00");
    const now = parseEventAt("2026-06-18", "10:00");
    const s = initialSchedule(event, false, now);
    expect(s.phase).toBe("pending");
    expect(toSpParts(s.nextNotifyAt)).toMatchObject({ hour: 13, minute: 30 });
  });

  it("evento de dia inteiro começa na véspera às 08:00", () => {
    const event = parseEventAt("2026-06-18", null);
    const now = parseEventAt("2026-06-10", null);
    const s = initialSchedule(event, true, now);
    expect(s.phase).toBe("pending");
    expect(toSpParts(s.nextNotifyAt)).toMatchObject({ day: 17, hour: 8 });
  });

  it("criado entre 30 e 5 min antes pula o aviso de 30 min", () => {
    const event = parseEventAt("2026-06-18", "14:00");
    const now = parseEventAt("2026-06-18", "13:50"); // 10 min antes
    const s = initialSchedule(event, false, now);
    expect(s.phase).toBe("pre");
    expect(toSpParts(s.nextNotifyAt)).toMatchObject({ hour: 13, minute: 55 }); // 5 min antes
  });

  it("criado a menos de 5 min antes vai direto para o horário", () => {
    const event = parseEventAt("2026-06-18", "14:00");
    const now = parseEventAt("2026-06-18", "13:58");
    const s = initialSchedule(event, false, now);
    expect(s.phase).toBe("due");
    expect(toSpParts(s.nextNotifyAt)).toMatchObject({ hour: 14, minute: 0 });
  });
});

describe("decide (com hora)", () => {
  it("pending → pre (aviso de 30 min), incrementa contador", () => {
    const r = makeReminder({ phase: "pending", notifyCount: 0 });
    const { patch } = decide(r, parseEventAt("2026-06-18", "13:30"));
    expect(patch.phase).toBe("pre");
    expect(patch.notifyCount).toBe(1);
    // próximo disparo é 5 min antes do evento (14:00 → 13:55)
    expect(toSpParts(patch.nextNotifyAt as Date)).toMatchObject({ hour: 13, minute: 55 });
  });

  it("pre → due (aviso de 5 min), dispara no horário do evento", () => {
    const r = makeReminder({ phase: "pre", notifyCount: 1 });
    const { patch } = decide(r, parseEventAt("2026-06-18", "13:55"));
    expect(patch.phase).toBe("due");
    expect(toSpParts(patch.nextNotifyAt as Date)).toMatchObject({ hour: 14, minute: 0 });
  });

  it("fora do ar até depois do evento: não manda a contagem de 30 min atrasada", () => {
    const r = makeReminder({ phase: "pending", notifyCount: 0 });
    const { message, patch } = decide(r, parseEventAt("2026-06-18", "16:00"));
    expect(message.title).not.toContain("30 minutos");
    expect(patch.phase).toBe("nag");
  });

  it("volta poucos minutos depois do evento: manda o aviso da hora", () => {
    const r = makeReminder({ phase: "pending", notifyCount: 0 });
    const { message, patch } = decide(r, parseEventAt("2026-06-18", "14:02"));
    expect(message.title).toContain("É agora");
    expect(patch.phase).toBe("at");
  });

  it("due → at (no horário), começa o nag", () => {
    const now = new Date("2026-06-18T17:00:00.000Z");
    const r = makeReminder({ phase: "due", notifyCount: 2 });
    const { patch } = decide(r, now);
    expect(patch.phase).toBe("at");
    expect(patch.nextNotifyAt?.getTime()).toBe(now.getTime() + 15 * 60 * 1000);
  });

  it("nag se repete a cada 15 min", () => {
    const now = new Date("2026-06-18T17:00:00.000Z");
    const r = makeReminder({ phase: "at", notifyCount: 3 });
    const { patch } = decide(r, now);
    expect(patch.phase).toBe("nag");
    expect(patch.nextNotifyAt?.getTime()).toBe(now.getTime() + 15 * 60 * 1000);
  });

  it("cap atingido para de avisar mas mantém o evento único ativo (atrasado)", () => {
    const r = makeReminder({ phase: "nag", notifyCount: 10, maxNotify: 10 });
    const { patch } = decide(r, new Date());
    expect(patch.status).toBeUndefined();
    expect(patch.nextNotifyAt).toBeNull();
  });

  it("cap atingido em evento recorrente também só para de avisar (não avança sozinho)", () => {
    const r = makeReminder({
      phase: "nag",
      notifyCount: 10,
      maxNotify: 10,
      recurInterval: 1,
      recurUnit: "week",
    });
    const { patch } = decide(r, new Date());
    expect(patch.status).toBeUndefined();
    expect(patch.eventAt).toBeUndefined();
    expect(patch.nextNotifyAt).toBeNull();
  });

  it("soneca vencida antes do evento retoma a trilha sem mover o compromisso", () => {
    const now = parseEventAt("2026-06-18", "13:45");
    const r = makeReminder({ phase: "snoozed", notifyCount: 0 });
    const { message, patch } = decide(r, now);
    expect(message.title).toContain("Voltei");
    expect(patch.phase).toBe("pre");
    // o aviso de 5 min (13:55) e o "é agora" (14:00) continuam valendo
    expect(toSpParts(patch.nextNotifyAt as Date)).toMatchObject({ hour: 13, minute: 55 });
    expect(patch.eventAt).toBeUndefined();
  });

  it("soneca vencida depois do evento volta ao nag de 15 min", () => {
    const now = parseEventAt("2026-06-18", "14:30");
    const r = makeReminder({ phase: "snoozed", notifyCount: 4 });
    const { patch } = decide(r, now);
    expect(patch.phase).toBe("nag");
    expect(patch.nextNotifyAt?.getTime()).toBe(now.getTime() + 15 * 60 * 1000);
    expect(patch.eventAt).toBeUndefined();
  });
});

describe("decide (dia inteiro)", () => {
  it("pending → day_before com disparo às 08:00 do dia", () => {
    const r = makeReminder({ isAllDay: true, eventAt: parseEventAt("2026-06-18", null).toISOString(), phase: "pending" });
    const { patch } = decide(r, new Date());
    expect(patch.phase).toBe("day_before");
    expect(toSpParts(patch.nextNotifyAt as Date)).toMatchObject({ day: 18, hour: 8 });
  });

  it("no dia envia o aviso e para de notificar, mantendo ativo (atrasado)", () => {
    const r = makeReminder({ isAllDay: true, phase: "day_before" });
    const { patch } = decide(r, new Date());
    expect(patch.status).toBeUndefined();
    expect(patch.phase).toBe("morning");
    expect(patch.nextNotifyAt).toBeNull();
  });

  it("soneca do aviso da véspera preserva o bom dia do dia do evento", () => {
    const now = parseEventAt("2026-06-17", "08:15");
    const r = makeReminder({
      isAllDay: true,
      eventAt: parseEventAt("2026-06-18", null).toISOString(),
      phase: "snoozed",
    });
    const { message, patch } = decide(r, now);
    expect(message.title).toContain("Voltei");
    expect(patch.phase).toBe("day_before");
    expect(toSpParts(patch.nextNotifyAt as Date)).toMatchObject({ day: 18, hour: 8 });
  });

  it("soneca do aviso do dia encerra o ciclo depois de voltar", () => {
    const now = parseEventAt("2026-06-18", "08:15");
    const r = makeReminder({
      isAllDay: true,
      eventAt: parseEventAt("2026-06-18", null).toISOString(),
      phase: "snoozed",
    });
    const { patch } = decide(r, now);
    expect(patch.phase).toBe("morning");
    expect(patch.nextNotifyAt).toBeNull();
    expect(patch.eventAt).toBeUndefined();
  });
});

describe("finishOccurrence", () => {
  it("recorrente reinicia ciclo na próxima data", () => {
    const r = makeReminder({
      recurInterval: 6,
      recurUnit: "month",
      recurWeekday: 6,
      recurAnchorAt: parseEventAt("2026-06-18", "14:00").toISOString(),
      notifyCount: 5,
    });
    const patch = finishOccurrence(r, new Date());
    expect(patch.status).toBe("active");
    expect(patch.notifyCount).toBe(0);
    expect(patch.acknowledged).toBe(false);
  });

  it("único vira done", () => {
    const patch = finishOccurrence(makeReminder({}), new Date());
    expect(patch.status).toBe("done");
  });

  it("fixo: avança na grade da âncora, ignorando event_at remarcado", () => {
    // Âncora segunda 10h; ocorrência atual remarcada p/ 14h.
    const r = makeReminder({
      recurInterval: 1,
      recurUnit: "week",
      recurWeekday: 1,
      recurMode: "fixed",
      recurAnchorAt: parseEventAt("2026-06-15", "10:00").toISOString(),
      eventAt: parseEventAt("2026-06-15", "14:00").toISOString(),
    });
    const patch = finishOccurrence(r, parseEventAt("2026-06-15", "14:30"));
    const next = toSpParts(patch.eventAt as Date);
    expect(next).toMatchObject({ day: 22, hour: 10, minute: 0, weekday: 1 });
    expect(patch.recurAnchorAt).toEqual(patch.eventAt);
  });

  it("fixo: sem âncora cai no fallback para event_at", () => {
    const r = makeReminder({
      recurInterval: 1,
      recurUnit: "week",
      recurMode: "fixed",
      recurAnchorAt: null,
      eventAt: parseEventAt("2026-06-15", "10:00").toISOString(),
    });
    const patch = finishOccurrence(r, parseEventAt("2026-06-15", "14:00"));
    expect(toSpParts(patch.eventAt as Date)).toMatchObject({ day: 22, hour: 10 });
  });

  it("fixo abandonado: um único concluir salta a grade até a próxima ocorrência futura", () => {
    // Âncora segunda 15/06 10:00, semanal; o usuário só volta ao app em 20/07.
    const r = makeReminder({
      recurInterval: 1,
      recurUnit: "week",
      recurMode: "fixed",
      recurAnchorAt: parseEventAt("2026-06-15", "10:00").toISOString(),
      eventAt: parseEventAt("2026-06-15", "10:00").toISOString(),
    });
    const patch = finishOccurrence(r, parseEventAt("2026-07-20", "14:00"));
    // 27/07, não 22/06: sem o catch-up cada concluir devolvia uma data já vencida.
    expect(toSpParts(patch.eventAt as Date)).toMatchObject({ month: 6, day: 27, hour: 10 });
    expect(patch.phase).toBe("pending");
  });

  it("relativo: avança a partir de now, preservando dia-da-semana e hora da âncora", () => {
    // Âncora sábado 10h; confirma numa terça 15h.
    const r = makeReminder({
      recurInterval: 6,
      recurUnit: "month",
      recurWeekday: 6,
      recurMode: "relative",
      recurAnchorAt: parseEventAt("2026-06-20", "10:00").toISOString(),
      eventAt: parseEventAt("2026-06-20", "10:00").toISOString(),
    });
    const patch = finishOccurrence(r, parseEventAt("2026-06-23", "15:00"));
    const next = toSpParts(patch.eventAt as Date);
    // ~6 meses após 2026-06-23 → dezembro/2026, ajustado p/ sábado, às 10h.
    expect(next).toMatchObject({ year: 2026, month: 11, hour: 10, minute: 0, weekday: 6 });
    expect(patch.recurAnchorAt).toEqual(patch.eventAt);
  });
});
