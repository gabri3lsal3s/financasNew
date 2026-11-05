import { describe, expect, it } from "vitest";
import { resolveDebtDeleteIds, type DebtLike } from "./delete";

describe("resolveDebtDeleteIds", () => {
  const sampleDebts: DebtLike[] = [
    { id: "d1", due_date: "2026-01-10", installment_group_id: "group-1" },
    { id: "d2", due_date: "2026-02-10", installment_group_id: "group-1" },
    { id: "d3", due_date: "2026-03-10", installment_group_id: "group-1" },
    { id: "d4", due_date: "2026-04-10", installment_group_id: "group-1" },
    { id: "single-1", due_date: "2026-05-10", installment_group_id: null },
    { id: "other-group", due_date: "2026-02-10", installment_group_id: "group-2" },
  ];

  it("retorna apenas o id alvo quando mode é 'single'", () => {
    const ids = resolveDebtDeleteIds(sampleDebts, "d2", "single");
    expect(ids).toEqual(["d2"]);
  });

  it("retorna apenas o id alvo quando a dívida não possui installment_group_id", () => {
    const ids = resolveDebtDeleteIds(sampleDebts, "single-1", "all");
    expect(ids).toEqual(["single-1"]);
  });

  it("retorna todas as parcelas do mesmo grupo quando mode é 'all'", () => {
    const ids = resolveDebtDeleteIds(sampleDebts, "d2", "all");
    expect(ids).toEqual(["d1", "d2", "d3", "d4"]);
  });

  it("retorna esta parcela e as posteriores quando mode é 'subsequent'", () => {
    const ids = resolveDebtDeleteIds(sampleDebts, "d2", "subsequent");
    expect(ids).toEqual(["d2", "d3", "d4"]);
  });

  it("retorna apenas a última parcela se ela for selecionada em 'subsequent'", () => {
    const ids = resolveDebtDeleteIds(sampleDebts, "d4", "subsequent");
    expect(ids).toEqual(["d4"]);
  });

  it("retorna apenas o id informado se o id alvo não constar na lista", () => {
    const ids = resolveDebtDeleteIds(sampleDebts, "non-existent", "all");
    expect(ids).toEqual(["non-existent"]);
  });
});
