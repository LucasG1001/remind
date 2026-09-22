import { describe, it, expect } from "vitest";
import { buildUpdateSet, nextPositionSql } from "./sqlUpdate.js";

// A aritmética de placeholders ($i ↔ nextIndex ↔ posição do id) é onde um off-by-one
// produz `WHERE id = $4` apontando para o valor de outra coluna.
const COLUMN_MAP = { title: "title", notes: "notes", eventAt: "event_at" } as const;

describe("buildUpdateSet", () => {
  it("patch vazio não produz SET e deixa o id em $1", () => {
    const { sets, values, nextIndex } = buildUpdateSet({}, COLUMN_MAP);
    expect(sets).toEqual([]);
    expect(values).toEqual([]);
    expect(nextIndex).toBe(1);
  });

  it("um campo: o placeholder do id vem logo depois dele", () => {
    const { sets, values, nextIndex } = buildUpdateSet({ title: "x" }, COLUMN_MAP);
    expect(sets).toEqual(["title = $1"]);
    expect(values).toEqual(["x"]);
    expect(nextIndex).toBe(2);
  });

  it("numera na ordem do columnMap, não na do patch", () => {
    const { sets, values, nextIndex } = buildUpdateSet({ eventAt: "d", title: "t" }, COLUMN_MAP);
    expect(sets).toEqual(["title = $1", "event_at = $2"]);
    expect(values).toEqual(["t", "d"]);
    expect(nextIndex).toBe(3);
  });

  it("null é valor a gravar; undefined é campo ausente", () => {
    const { sets, values, nextIndex } = buildUpdateSet(
      { notes: null, title: undefined },
      COLUMN_MAP
    );
    expect(sets).toEqual(["notes = $1"]);
    expect(values).toEqual([null]);
    expect(nextIndex).toBe(2);
  });
});

describe("nextPositionSql", () => {
  it("primeira posição de uma tabela vazia é 0", () => {
    expect(nextPositionSql("habits")).toContain("COALESCE(MAX(position), -1) + 1");
  });

  it("aceita escopo", () => {
    expect(nextPositionSql("cards", "list_id = $1")).toContain("WHERE list_id = $1");
  });
});
