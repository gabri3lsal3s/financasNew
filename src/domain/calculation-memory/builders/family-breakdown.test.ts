import { describe, expect, it } from "vitest";
import {
  buildFamilySettlementBreakdown,
  buildFamilyCeilingBreakdown,
  type FamilySettlementMemberData,
} from "./family-breakdown";

describe("family-breakdown", () => {
  it("deve montar breakdown para membro credor (a receber via Pix)", () => {
    const member: FamilySettlementMemberData = {
      userId: "user-1",
      displayName: "Ana",
      spentCents: 350000, // R$ 3.500,00
      fairShareCents: 200000, // R$ 2.000,00
      netBalanceCents: 150000, // + R$ 1.500,00
    };

    const breakdown = buildFamilySettlementBreakdown(member, {
      householdTotalSpentCents: 400000,
      splitRuleDescription: "Divisão 50/50",
      periodLabel: "Agosto/2026",
    });

    expect(breakdown.title).toBe("Acerto Familiar: Ana");
    expect(breakdown.result.label).toBe("A Receber via Pix");
    expect(breakdown.result.rawValue).toBe(150000);
    expect(breakdown.steps[1]?.rawValue).toBe(350000);
    expect(breakdown.steps[2]?.rawValue).toBe(200000);
    expect(breakdown.steps[3]?.rawValue).toBe(150000);
    expect(breakdown.copyText).toContain("A Receber via Pix: R$ 1.500,00");
  });

  it("deve montar breakdown para membro devedor (a pagar via Pix)", () => {
    const member: FamilySettlementMemberData = {
      userId: "user-2",
      displayName: "Carlos",
      spentCents: 50000, // R$ 500,00
      fairShareCents: 200000, // R$ 2.000,00
      netBalanceCents: -150000, // - R$ 1.500,00
    };

    const breakdown = buildFamilySettlementBreakdown(member, {
      householdTotalSpentCents: 400000,
      splitRuleDescription: "Divisão 50/50",
      periodLabel: "Agosto/2026",
    });

    expect(breakdown.title).toBe("Acerto Familiar: Carlos");
    expect(breakdown.result.label).toBe("A Pagar via Pix");
    expect(breakdown.result.rawValue).toBe(150000);
    expect(breakdown.steps[1]?.rawValue).toBe(50000);
    expect(breakdown.steps[2]?.rawValue).toBe(200000);
    expect(breakdown.steps[3]?.rawValue).toBe(150000);
    expect(breakdown.copyText).toContain("A Pagar via Pix: R$ 1.500,00");
  });

  it("deve montar breakdown do teto familiar quando dentro do limite", () => {
    const breakdown = buildFamilyCeilingBreakdown({
      monthlyCeilingCents: 500000,
      totalSpentCents: 350000,
      spentPercentage: 70,
      membersSummary: [
        { name: "Ana", spentCents: 200000 },
        { name: "Carlos", spentCents: 150000 },
      ],
    });

    expect(breakdown.title).toBe("Teto de Gastos Familiar");
    expect(breakdown.result.label).toBe("Margem Restante");
    expect(breakdown.result.rawValue).toBe(150000); // 500000 - 350000
    expect(breakdown.steps).toHaveLength(5);
  });

  it("deve montar breakdown do teto familiar quando estourado", () => {
    const breakdown = buildFamilyCeilingBreakdown({
      monthlyCeilingCents: 500000,
      totalSpentCents: 620000,
      spentPercentage: 124,
    });

    expect(breakdown.result.label).toBe("Excesso Orçamentário");
    expect(breakdown.result.rawValue).toBe(120000);
    expect(breakdown.copyText).toContain("Excesso Orçamentário: R$ 1.200,00");
  });
});
