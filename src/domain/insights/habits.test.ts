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

  it("Cenário 3 (Viagens & Pontuais): 4 restaurantes de viagem na semana não geram hábito anual recorrente", () => {
    const tripExpenses: ExpenseLike[] = [
      { id: "t1", description: "Restaurante Orla", month: "2026-11", date: "2026-11-02", valueCents: 9500, categoryId: "cat_alim", tripId: "trip-ferias" },
      { id: "t2", description: "Restaurante Centro", month: "2026-11", date: "2026-11-03", valueCents: 11000, categoryId: "cat_alim", tripId: "trip-ferias" },
      { id: "t3", description: "Jantar Hotel", month: "2026-11", date: "2026-11-04", valueCents: 13000, categoryId: "cat_alim", tripId: "trip-ferias" },
      { id: "t4", description: "Almoço Praia", month: "2026-11", date: "2026-11-05", valueCents: 8800, categoryId: "cat_alim", tripId: "trip-ferias" },
    ];

    expect(detectSpendingHabits(tripExpenses, { todayISO: "2026-11-08" })).toHaveLength(0);

    // Também respeita oneOffExpenseIds e currentMonthOneOffKeys
    const oneOffExpenses: ExpenseLike[] = [
      { id: "o1", description: "Café Praça", month: "2026-11", date: "2026-11-02", valueCents: 1800, categoryId: "cat_alim" },
      { id: "o2", description: "Café Esquina", month: "2026-11", date: "2026-11-03", valueCents: 1800, categoryId: "cat_alim" },
      { id: "o3", description: "Café Livraria", month: "2026-11", date: "2026-11-04", valueCents: 1800, categoryId: "cat_alim" },
    ];
    expect(
      detectSpendingHabits(oneOffExpenses, {
        todayISO: "2026-11-08",
        currentMonthOneOffKeys: new Set(["habit:cat_alim:food:coffee_snacks"]),
      }),
    ).toHaveLength(0);
    expect(
      detectSpendingHabits(oneOffExpenses, {
        todayISO: "2026-11-08",
        oneOffExpenseIds: new Set(["o1"]),
        minOccurrences: 3,
      }),
    ).toHaveLength(0);
  });

  it("suaviza projeção anual com M-1..M-3 e expõe isRecurringAcrossMonths + categoryBudgetCents", () => {
    const currentDelivery: ExpenseLike[] = [
      { id: "d1", description: "iFood Lanche", month: "2026-11", date: "2026-11-02", valueCents: 4000, categoryId: "cat_delivery" },
      { id: "d2", description: "iFood Jantar", month: "2026-11", date: "2026-11-04", valueCents: 4000, categoryId: "cat_delivery" },
      { id: "d3", description: "iFood Almoço", month: "2026-11", date: "2026-11-06", valueCents: 4000, categoryId: "cat_delivery" },
    ];

    // Caso A: há 3 meses históricos (M-1..M-3) de outras despesas, mas o hábito só surgiu agora -> dilui por 4 meses em vez de x12
    const otherHistory: ExpenseLike[] = [
      { id: "h-ago", description: "Supermercado", month: "2026-08", date: "2026-08-10", valueCents: 50000, categoryId: "cat_merc" },
      { id: "h-set", description: "Supermercado", month: "2026-09", date: "2026-09-10", valueCents: 50000, categoryId: "cat_merc" },
      { id: "h-out", description: "Supermercado", month: "2026-10", date: "2026-10-10", valueCents: 50000, categoryId: "cat_merc" },
    ];

    const isolatedMonth = detectSpendingHabits(currentDelivery, {
      todayISO: "2026-11-10",
      historicalExpenses: otherHistory,
      categoryBudgets: new Map([["cat_delivery", 60000]]),
    });
    expect(isolatedMonth).toHaveLength(1);
    expect(isolatedMonth[0]?.isRecurringAcrossMonths).toBe(false);
    expect(isolatedMonth[0]?.historicalMonthlyMedianCents).toBeUndefined();
    expect(isolatedMonth[0]?.categoryBudgetCents).toBe(60000);
    // 12.000 / 4 * 12 = 36.000 (não 144.000!)
    expect(isolatedMonth[0]?.annualProjectedCents).toBe(36000);

    // Caso B: hábito já recorrente nos meses anteriores -> usa mediana intermensal
    const recurringHistory: ExpenseLike[] = [
      ...otherHistory,
      { id: "r-ago", description: "iFood Pedido", month: "2026-08", date: "2026-08-12", valueCents: 20000, categoryId: "cat_delivery" },
      { id: "r-set", description: "iFood Pedido", month: "2026-09", date: "2026-09-12", valueCents: 24000, categoryId: "cat_delivery" },
      { id: "r-out", description: "iFood Pedido", month: "2026-10", date: "2026-10-12", valueCents: 22000, categoryId: "cat_delivery" },
    ];
    const recurringHabits = detectSpendingHabits(currentDelivery, {
      todayISO: "2026-11-10",
      historicalExpenses: recurringHistory,
    });
    expect(recurringHabits[0]?.isRecurringAcrossMonths).toBe(true);
    expect(recurringHabits[0]?.historicalMonthlyMedianCents).toBe(22000);
    expect(recurringHabits[0]?.annualProjectedCents).toBe(21000 * 12);
  });
});
