import { describe, it, expect } from "vitest";
import {
  parseTimeToMinutes,
  minutesToTime,
  toHhMm,
  durationMinutes,
  addMinutesToTime,
  floorToQuarter,
  checkTimeWindow,
  isValidTime,
} from "./timeWindow.js";

describe("parseTimeToMinutes", () => {
  it("converte horários válidos", () => {
    expect(parseTimeToMinutes("00:00")).toBe(0);
    expect(parseTimeToMinutes("19:15")).toBe(1155);
    expect(parseTimeToMinutes("23:59")).toBe(1439);
  });

  it("rejeita formatos fora de HH:MM", () => {
    for (const bad of ["7:30", "24:00", "19:60", "", "19:00:00", "abc"]) {
      expect(parseTimeToMinutes(bad)).toBeNull();
    }
  });
});

describe("minutesToTime", () => {
  it("formata com zero à esquerda", () => {
    expect(minutesToTime(0)).toBe("00:00");
    expect(minutesToTime(540)).toBe("09:00");
    expect(minutesToTime(1155)).toBe("19:15");
  });

  it("recusa minuto fora do dia", () => {
    expect(() => minutesToTime(1440)).toThrow(RangeError);
  });
});

describe("toHhMm", () => {
  it("corta os segundos que o pg devolve em colunas TIME", () => {
    expect(toHhMm("19:00:00")).toBe("19:00");
    expect(toHhMm("19:00")).toBe("19:00");
    expect(toHhMm(null)).toBeNull();
  });
});

describe("durationMinutes", () => {
  it("mede a janela", () => {
    expect(durationMinutes("19:00", "20:00")).toBe(60);
    expect(durationMinutes("20:00", "20:40")).toBe(40);
    expect(durationMinutes("19:00", "19:00")).toBe(0);
  });

  it("devolve negativo quando o fim vem antes (caso meia-noite)", () => {
    expect(durationMinutes("23:00", "01:00")).toBe(-1320);
  });
});

describe("addMinutesToTime", () => {
  it("soma dentro do dia", () => {
    expect(addMinutesToTime("19:00", 90)).toBe("20:30");
    expect(addMinutesToTime("23:00", 59)).toBe("23:59");
    expect(addMinutesToTime("00:00", 15)).toBe("00:15");
  });

  it("devolve null em vez de virar a madrugada", () => {
    expect(addMinutesToTime("23:00", 60)).toBeNull();
    expect(addMinutesToTime("23:30", 60)).toBeNull();
  });
});

describe("floorToQuarter", () => {
  it("desce para o quarto de hora tocado", () => {
    expect(floorToQuarter("07:37")).toBe("07:30");
    expect(floorToQuarter("07:00")).toBe("07:00");
    expect(floorToQuarter("07:59")).toBe("07:45");
    expect(floorToQuarter("07:14")).toBe("07:00");
    expect(floorToQuarter("23:59")).toBe("23:45");
  });
});

describe("checkTimeWindow", () => {
  it("aceita hábito sem horário", () => {
    expect(checkTimeWindow(null, null)).toBeNull();
  });

  it("exige as duas pontas", () => {
    expect(checkTimeWindow("19:00", null)).toBe("incomplete");
    expect(checkTimeWindow(null, "19:00")).toBe("incomplete");
  });

  it("aceita a partir de 15 minutos", () => {
    expect(checkTimeWindow("19:00", "19:15")).toBeNull();
    expect(checkTimeWindow("20:00", "20:40")).toBeNull();
  });

  it("recusa janela curta demais", () => {
    expect(checkTimeWindow("19:00", "19:14")).toBe("tooShort");
  });

  it("recusa fim antes ou igual ao início", () => {
    expect(checkTimeWindow("19:00", "19:00")).toBe("reversed");
    expect(checkTimeWindow("23:00", "01:00")).toBe("reversed");
  });
});

describe("isValidTime", () => {
  it("valida a faixa e não só o formato", () => {
    expect(isValidTime("00:00")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
    expect(isValidTime("99:99")).toBe(false);
  });
});
