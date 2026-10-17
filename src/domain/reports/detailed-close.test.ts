import { describe, expect, it } from "vitest";
import { buildDetailedClose, type DetailedCloseExpenseInput } from "./detailed-close";

const resolvers = {
  categoryName: (id: string) => (id === "c1" ? "Alimentação" : id === "c2" ? "Lazer" : "Outra"),
  cardName: (id: string) => (id === "card1" ? "Nubank" : null),
  paymentMethodLabel: (m: string) => (m === "credit" ? "Cartão de crédito" : m === "pix" ? "Pix" : m),
  weekdayLabel: (date: string) => (date === "2026-08-12" ? "Quarta" : "Sábado"),
};

function expense(overrides: Partial<DetailedCloseExpenseInput> = {}): DetailedCloseExpenseInput {
  return {
    id: "e1",
    date: "2026-08-12",
    description: "Mercado",
    paymentMethod: "credit",
    cardId: "card1",
    installmentsTotal: 1,
    installmentNumber: 1,
    installmentGroupId: null,
    categoryId: "c1",
    valueCents: 10000,
    ...overrides,
  };
}

describe("buildDetailedClose (F22 evolução — fechamento detalhado do período)", () => {
  it("agrupa por categoria com total desc e por dia com data asc", () => {
    const result = buildDetailedClose(
      [
        expense({ id: "a", categoryId: "c2", date: "2026-08-05", valueCents: 5000 }),
        expense({ id: "b", categoryId: "c1", date: "2026-08-20", valueCents: 3000 }),
        expense({ id: "c", categoryId: "c1", date: "2026-08-12", valueCents: 10000 }),
        expense({ id: "d", categoryId: "c1", date: "2026-08-12", valueCents: 2000 }),
      ],
      resolvers,
    );
    expect(result.map((c) => c.name)).toEqual(["Alimentação", "Lazer"]); // 15.000 > 5.000
    const alimentacao = result[0]!;
    expect(alimentacao.totalCents).toBe(15000);
    // Dias em ordem crescente: 12/08 (12.000) → 20/08 (3.000).
    expect(alimentacao.days.map((d) => d.date)).toEqual(["2026-08-12", "2026-08-20"]);
    // Dentro do dia: maior valor primeiro (Mercado 100 antes de 20).
    expect(alimentacao.days[0]!.entries.map((e) => e.valueCents)).toEqual([10000, 2000]);
  });

  it("resolve rótulos de método, cartão e parcela por entrada", () => {
    const result = buildDetailedClose(
      [
        expense({ id: "e1", paymentMethod: "credit", cardId: "card1", installmentGroupId: "g1", installmentsTotal: 3, installmentNumber: 2 }),
        expense({ id: "e2", paymentMethod: "pix", cardId: null, description: null }),
      ],
      resolvers,
    );
    const entries = result[0]!.days[0]!.entries;
    expect(entries).toHaveLength(2);
    const credit = entries.find((e) => e.id === "e1")!;
    expect(credit.paymentMethodLabel).toBe("Cartão de crédito");
    expect(credit.cardName).toBe("Nubank");
    expect(credit.installmentLabel).toBe("2/3");
    const pix = entries.find((e) => e.id === "e2")!;
    expect(pix.paymentMethodLabel).toBe("Pix");
    expect(pix.cardName).toBeNull();
    expect(pix.installmentLabel).toBeNull();
    expect(pix.description).toBe("Sem descrição");
  });

  it("dia expõe label curto, dia da semana e subtotal", () => {
    const result = buildDetailedClose(
      [expense({ valueCents: 4000 }), expense({ valueCents: 6000 })],
      resolvers,
    );
    const day = result[0]!.days[0]!;
    expect(day.label).toBe("12/8");
    expect(day.weekdayLabel).toBe("Quarta");
    expect(day.totalCents).toBe(10000);
  });

  it("retorna lista vazia sem despesas", () => {
    expect(buildDetailedClose([], resolvers)).toEqual([]);
  });

  it("garante a invariante hierárquica centavo a centavo entre entradas, dias e categorias", () => {
    const expenses = [
      expense({ id: "1", categoryId: "c1", date: "2026-08-10", valueCents: 1234 }),
      expense({ id: "2", categoryId: "c1", date: "2026-08-10", valueCents: 5678 }),
      expense({ id: "3", categoryId: "c1", date: "2026-08-12", valueCents: 9012 }),
      expense({ id: "4", categoryId: "c2", date: "2026-08-12", valueCents: 3456 }),
    ];

    const categories = buildDetailedClose(expenses, resolvers);
    for (const cat of categories) {
      const sumDays = cat.days.reduce((acc, d) => acc + d.totalCents, 0);
      expect(cat.totalCents).toBe(sumDays);
      for (const day of cat.days) {
        const sumEntries = day.entries.reduce((acc, e) => acc + e.valueCents, 0);
        expect(day.totalCents).toBe(sumEntries);
      }
    }
  });
});
