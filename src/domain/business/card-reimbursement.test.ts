import { describe, expect, it } from "vitest";
import { buildCardReimbursementSourceRef, calculateMixedCardSplit } from "./card-reimbursement";

describe("card-reimbursement (Rateio Cartão Misto & Proteção Anti-Duplicidade)", () => {
  it("detecta parcela PJ restante e marca como reembolsado após registro via source_ref", () => {
    const sourceRef = buildCardReimbursementSourceRef("card-mix", "2026-11");
    expect(sourceRef).toBe("[REIMBURSEMENT]card-mix:2026-11");

    const expenses = [
      { value: 200, card_id: "card-mix", bill_competence: "2026-11", scope: "personal" as const },
      { value: 450, card_id: "card-mix", bill_competence: "2026-11", scope: "business" as const },
    ];

    const partial = calculateMixedCardSplit({
      cardId: "card-mix",
      competenceMonth: "2026-11",
      expenses,
      incomes: [{ value: 150, source_ref: sourceRef }],
    });

    expect(partial.personalCents).toBe(20_000);
    expect(partial.businessCents).toBe(45_000);
    expect(partial.reimbursedCents).toBe(15_000);
    expect(partial.pendingReimbursementCents).toBe(30_000);
    expect(partial.isFullyReimbursed).toBe(false);

    const settled = calculateMixedCardSplit({
      cardId: "card-mix",
      competenceMonth: "2026-11",
      expenses,
      incomes: [
        { value: 150, source_ref: sourceRef },
        { value: 300, source_ref: sourceRef },
      ],
    });
    expect(settled.pendingReimbursementCents).toBe(0);
    expect(settled.isFullyReimbursed).toBe(true);
  });
});
