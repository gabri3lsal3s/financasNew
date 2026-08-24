import { describe, expect, it } from "vitest";
import { analyzeCashGap } from "./cash-gap";

describe("analyzeCashGap — Radar Preditivo de Descasamento de Fluxo (§F51)", () => {
  it("detecta descasamento quando saídas superam o saldo antes da data de entrada do salário", () => {
    const result = analyzeCashGap({
      currentBalanceCents: 50000, // R$ 500,00 em conta
      today: "2026-09-01",
      daysAhead: 20,
      obligations: [
        {
          id: "inv-nubank",
          name: "Fatura Nubank",
          dueDate: "2026-09-05",
          amountCents: 120000, // R$ 1.200,00 (saldo fica -700,00)
          kind: "invoice",
        },
        {
          id: "debt-aluguel",
          name: "Aluguel",
          dueDate: "2026-09-10",
          amountCents: 150000, // R$ 1.500,00 (saldo fica -2.200,00)
          kind: "debt",
        },
      ],
      inflows: [
        {
          id: "salario",
          name: "Salário Mensal",
          expectedDate: "2026-09-15",
          amountCents: 600000, // R$ 6.000,00 (cobre tudo no dia 15)
        },
      ],
    });

    expect(result.isCashGapDetected).toBe(true);
    expect(result.gapDate).toBe("2026-09-05");
    expect(result.daysUntilGap).toBe(4);
    expect(result.severity).toBe("warning");
    expect(result.maxDeficitCents).toBe(220000); // R$ 2.200,00 de déficit máximo
    expect(result.nextInflowDate).toBe("2026-09-15");
    expect(result.causingObligations).toHaveLength(2);
    expect(result.recommendationMessage).toContain("05/09");
    expect(result.recommendationMessage).toContain("15/09");
    expect(result.runway.length).toBe(20);
  });

  it("classifica como critical quando o gap ocorre em menos de 3 dias", () => {
    const result = analyzeCashGap({
      currentBalanceCents: 10000, // R$ 100,00
      today: "2026-09-01",
      obligations: [
        {
          id: "boleto",
          name: "Boleto Condomínio",
          dueDate: "2026-09-02",
          amountCents: 60000,
          kind: "debt",
        },
      ],
      inflows: [],
    });

    expect(result.isCashGapDetected).toBe(true);
    expect(result.daysUntilGap).toBe(1);
    expect(result.severity).toBe("critical");
    expect(result.gapDate).toBe("2026-09-02");
    expect(result.maxDeficitCents).toBe(50000);
  });

  it("retorna isCashGapDetected = false quando o saldo é suficiente em todos os dias", () => {
    const result = analyzeCashGap({
      currentBalanceCents: 500000, // R$ 5.000,00
      today: "2026-09-01",
      obligations: [
        {
          id: "inv-1",
          name: "Fatura",
          dueDate: "2026-09-10",
          amountCents: 100000,
          kind: "invoice",
        },
      ],
      inflows: [],
    });

    expect(result.isCashGapDetected).toBe(false);
    expect(result.severity).toBe("none");
    expect(result.gapDate).toBeNull();
    expect(result.maxDeficitCents).toBe(0);
    expect(result.recommendationMessage).toBeNull();
  });
});
