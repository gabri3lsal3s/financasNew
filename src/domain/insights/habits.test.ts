import { describe, expect, it } from "vitest";
import { detectSpendingHabits } from "./habits";
import type { ExpenseLike } from "./recurrences";

describe("habits", () => {
  it("consolida múltiplos trajetos com nomes diferentes em um único hábito de transporte", () => {
    const expenses: ExpenseLike[] = [
      {
        id: "1",
        description: "Ida para Caju",
        month: "2026-11",
        date: "2026-11-03",
        valueCents: 2500,
        categoryId: "cat_transporte",
        categoryName: "Transporte",
        categoryIcon: "transporte",
      },
      {
        id: "2",
        description: "Ida para Glória",
        month: "2026-11",
        date: "2026-11-04",
        valueCents: 3000,
        categoryId: "cat_transporte",
        categoryName: "Transporte",
        categoryIcon: "transporte",
      },
      {
        id: "3",
        description: "Volta da Unic",
        month: "2026-11",
        date: "2026-11-05",
        valueCents: 2000,
        categoryId: "cat_transporte",
        categoryName: "Transporte",
        categoryIcon: "transporte",
      },
      {
        id: "4",
        description: "Ida para universidade",
        month: "2026-11",
        date: "2026-11-06",
        valueCents: 2500,
        categoryId: "cat_transporte",
        categoryName: "Transporte",
        categoryIcon: "transporte",
      },
    ];

    const habits = detectSpendingHabits(expenses, {
      todayISO: "2026-11-07",
      minOccurrences: 3,
    });

    expect(habits).toHaveLength(1);
    const habit = habits[0]!;
    expect(habit.key).toBe("habit:cat_transporte:mobility:commute");
    expect(habit.name).toBe("Deslocamentos e transporte");
    expect(habit.occurrencesCount).toBe(4);
    expect(habit.totalMonthCents).toBe(10000); // R$ 100,00
    expect(habit.averageTicketCents).toBe(2500); // R$ 25,00
    expect(habit.annualProjectedCents).toBe(120000); // R$ 1.200,00
    expect(habit.predominantDayLabel).toBe("Dias úteis");
    expect(habit.expenses).toHaveLength(4);
  });

  it("identifica microvazamento silencioso em cafés/lanches de baixo tíquete", () => {
    // 10 cafés de R$ 16,00 = R$ 160,00
    const expenses: ExpenseLike[] = Array.from({ length: 10 }, (_, i) => ({
      id: `coffee-${i}`,
      description: "Café e pão de queijo",
      month: "2026-11",
      date: `2026-11-${String(i + 1).padStart(2, "0")}`,
      valueCents: 1600,
      categoryId: "cat_alimentacao",
      categoryName: "Alimentação",
      categoryIcon: "alimentacao",
    }));

    const habits = detectSpendingHabits(expenses, {
      todayISO: "2026-11-12",
      monthlyIncomeCents: 300000, // R$ 3.000,00
    });

    expect(habits).toHaveLength(1);
    const coffeeHabit = habits[0]!;
    expect(coffeeHabit.isMicroLeakage).toBe(true);
    expect(coffeeHabit.averageTicketCents).toBe(1600);
    expect(coffeeHabit.totalMonthCents).toBe(16000);
  });

  it("não inclui assinaturas reais no motor de hábitos (mantém no trilho fixo)", () => {
    const expenses: ExpenseLike[] = [
      {
        id: "sub-1",
        description: "Netflix Mensal",
        month: "2026-11",
        date: "2026-11-01",
        valueCents: 5590,
        categoryId: "cat_streaming",
      },
      {
        id: "sub-2",
        description: "Netflix",
        month: "2026-11",
        date: "2026-11-02",
        valueCents: 5590,
        categoryId: "cat_streaming",
      },
      {
        id: "sub-3",
        description: "Netflix 4K",
        month: "2026-11",
        date: "2026-11-03",
        valueCents: 5590,
        categoryId: "cat_streaming",
      },
    ];

    const habits = detectSpendingHabits(expenses, { todayISO: "2026-11-07" });
    expect(habits).toHaveLength(0);
  });
});
