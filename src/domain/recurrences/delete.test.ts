import { describe, expect, it } from "vitest";
import { resolveOccurrenceDeleteIds } from "./delete";
import type { RecurrenceOccurrence } from "./types";

function occurrence(id: string, recurrenceId: string, occurrenceNumber: number): RecurrenceOccurrence {
  return { id, recurrenceId, date: "2026-01-10", occurrenceNumber, valueCents: 100 };
}

const occurrences: RecurrenceOccurrence[] = [
  occurrence("o1", "r1", 1),
  occurrence("o2", "r1", 2),
  occurrence("o3", "r1", 3),
];

describe("resolveOccurrenceDeleteIds", () => {
  it("single remove apenas a ocorrência-alvo", () => {
    expect(resolveOccurrenceDeleteIds(occurrences, "o2", "single")).toEqual(["o2"]);
  });

  it("all remove todas as ocorrências da mesma recorrência", () => {
    expect(resolveOccurrenceDeleteIds(occurrences, "o2", "all").sort()).toEqual(["o1", "o2", "o3"]);
  });

  it("subsequent remove a ocorrência-alvo e as seguintes", () => {
    expect(resolveOccurrenceDeleteIds(occurrences, "o2", "subsequent")).toEqual(["o2", "o3"]);
  });

  it("subsequent da primeira ocorrência remove a recorrência inteira", () => {
    expect(resolveOccurrenceDeleteIds(occurrences, "o1", "subsequent")).toEqual(["o1", "o2", "o3"]);
  });

  it("all não mistura ocorrências de recorrências distintas", () => {
    const other = occurrence("o9", "r2", 1);
    expect(resolveOccurrenceDeleteIds([...occurrences, other], "o1", "all")).toEqual(["o1", "o2", "o3"]);
  });

  it("ocorrência fora da lista (cache vazio) remove apenas o id informado", () => {
    expect(resolveOccurrenceDeleteIds([], "desconhecida", "all")).toEqual(["desconhecida"]);
  });
});
