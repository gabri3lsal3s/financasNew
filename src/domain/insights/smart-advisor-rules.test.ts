import { describe, expect, it } from "vitest";
import type { Budget, Category } from "@/types";
import {
  buildAdvisorCategoryBudgetsMap,
  buildAdvisorConfirmExpenseInput,
  buildAdvisorConfirmIncomeInput,
  computeDismissCooldownExpiry,
  computeEffectiveAdvisorSurplusCents,
  computeMonthlyAdvisorTotalCents,
  detectCardChargesDrain,
  evaluateSmartAdvisorInsights,
  mapRawExpensesToAdvisorLikes,
  mapRawIncomesToAdvisorLikes,
  mergeAndFilterValidDismissals,
  mergePersistedAdvisorDismissals,
  resolveIgnoreRecurrenceToast,
} from "./smart-advisor-rules";

const makeCategory = (id: string, name: string, icon: string | null = null): Category => ({
  id,
  user_id: "u1",
  type: "expense",
  name,
  icon,
  color: null,
  is_reserved: false,
  is_active: true,
});

describe("smart-advisor-rules (regras puras do SmartAdvisor)", () => {
  it("mergeAndFilterValidDismissals prioriza override local e descarta expirados da nuvem", () => {
    const now = 1_000_000;
    expect(
      mergeAndFilterValidDismissals({ a: 500 }, { b: 2_000_000 }, now, true, { c: 3_000_000 }),
    ).toEqual({ c: 3_000_000 });

    expect(
      mergeAndFilterValidDismissals(
        { expired: 500, active: 2_000_000 },
        { expiredCloud: 999_999, validCloud: 1_500_000 },
        now,
        false,
      ),
    ).toEqual({
      active: 2_000_000,
      validCloud: 1_500_000,
    });
  });

  it("computeDismissCooldownExpiry soma dias em milissegundos", () => {
    expect(computeDismissCooldownExpiry(1_000, 30)).toBe(1_000 + 30 * 86_400_000);
  });

  it("mapRawExpensesToAdvisorLikes e mapRawIncomesToAdvisorLikes aplicam report_weight e categoria", () => {
    const catMap = new Map<string, Category>([["c1", makeCategory("c1", "Streaming", "tv")]]);

    const mappedExp = mapRawExpensesToAdvisorLikes(
      [
        {
          month: "2026-10",
          data: [
            {
              id: "e1",
              description: "Netflix",
              date: "2026-10-05",
              value: 55.9,
              report_weight: 0.5,
              category_id: "c1",
            },
          ],
        },
      ],
      catMap,
    );

    expect(mappedExp).toEqual([
      {
        id: "e1",
        description: "Netflix",
        date: "2026-10-05",
        month: "2026-10",
        valueCents: 2795,
        categoryId: "c1",
        categoryName: "Streaming",
        categoryIcon: "tv",
        installmentGroupId: null,
        recurrenceId: null,
      },
    ]);

    const mappedInc = mapRawIncomesToAdvisorLikes(
      [
        [
          {
            id: "i1",
            description: "Salário",
            date: "2026-10-05",
            value: 5000,
            category_id: "c1",
          },
        ],
      ],
      "2026-10",
      catMap,
    );

    expect(mappedInc[0]?.month).toBe("2026-10");
    expect(mappedInc[0]?.valueCents).toBe(500000);
  });

  it("buildAdvisorCategoryBudgetsMap resolve limites efetivos por mês", () => {
    const categories = [makeCategory("c1", "Moradia"), makeCategory("c2", "Lazer")];
    const budgets: Budget[] = [
      { id: "b1", user_id: "u1", category_id: "c1", month: "2026-08", limit: 2000 },
    ];
    const map = buildAdvisorCategoryBudgetsMap(categories, budgets, "2026-10");
    expect(map.get("c1")).toBe(200000);
    expect(map.has("c2")).toBe(false);
  });

  it("computeMonthlyAdvisorTotalCents e computeEffectiveAdvisorSurplusCents respeitam Safe-to-Spend", () => {
    expect(
      computeMonthlyAdvisorTotalCents(
        [
          { month: "2026-10", valueCents: 120000 },
          { month: "2026-09", valueCents: 999999 },
        ],
        "2026-10",
        undefined,
      ),
    ).toBe(120000);

    expect(
      computeEffectiveAdvisorSurplusCents({
        monthlyIncomeCents: 500000,
        monthlyExpensesCents: 200000,
        committedObligationsCents: 250000,
        safeToSpendCents: 30000,
      }),
    ).toBe(30000);
  });

  it("evaluateSmartAdvisorInsights detecta cobrança duplicada e ordena candidatos elegíveis", () => {
    const res = evaluateSmartAdvisorInsights({
      allExpenses: [
        { id: "e1", description: "Netflix", date: "2026-10-05", month: "2026-10", valueCents: 5590, categoryId: "c1" },
        { id: "e2", description: "Netflix", date: "2026-10-18", month: "2026-10", valueCents: 5590, categoryId: "c1" },
        { id: "e3", description: "Netflix", date: "2026-09-05", month: "2026-09", valueCents: 5590, categoryId: "c1" },
      ],
      allIncomes: [],
      refMonth: "2026-10",
      todayISO: "2026-10-22",
      monthlyIncomeCents: 0,
      categoryBudgetsMap: new Map(),
      feedbackMap: {},
      month0Incomes: [],
      cards: [],
      household: null,
      incomeGoals: [],
      effectiveSurplusCents: 0,
      effectiveDismissals: {},
      nowMs: 1_000_000,
    });

    expect(res.eligibleInsights[0]?.themeKey).toBe("dup:sub:netflix");
    expect(res.eligibleInsights[0]?.priority).toBe(1);
  });

  it("evaluateSmartAdvisorInsights suprime candidatos com base em suppressedThemeKeys", () => {
    const res = evaluateSmartAdvisorInsights({
      allExpenses: [
        { id: "e1", description: "Netflix", date: "2026-10-05", month: "2026-10", valueCents: 5590, categoryId: "c1" },
        { id: "e2", description: "Netflix", date: "2026-10-18", month: "2026-10", valueCents: 5590, categoryId: "c1" },
        { id: "e3", description: "Netflix", date: "2026-09-05", month: "2026-09", valueCents: 5590, categoryId: "c1" },
      ],
      allIncomes: [],
      refMonth: "2026-10",
      todayISO: "2026-10-22",
      monthlyIncomeCents: 0,
      categoryBudgetsMap: new Map(),
      feedbackMap: {},
      month0Incomes: [],
      cards: [],
      household: null,
      incomeGoals: [],
      effectiveSurplusCents: 0,
      effectiveDismissals: {},
      nowMs: 1_000_000,
      suppressedThemeKeys: ["dup:sub:netflix"],
    });

    expect(res.eligibleInsights.some((i) => i.themeKey === "dup:sub:netflix")).toBe(false);
  });

  it("resolveIgnoreRecurrenceToast e builders de confirmação produzem payloads exatos", () => {
    expect(resolveIgnoreRecurrenceToast("already_cancelled").sensory).toBe("success");
    expect(resolveIgnoreRecurrenceToast("not_subscription").variant).toBe("info");
    expect(resolveIgnoreRecurrenceToast("one_off").title).toBe("Despesa pontual silenciada");
    expect(resolveIgnoreRecurrenceToast("ignore").title).toBe("Gasto ignorado");

    expect(
      buildAdvisorConfirmIncomeInput({ name: "Freela", valueCents: 250000, categoryId: "c1" }, "2026-10-22"),
    ).toEqual({
      description: "Freela",
      value: 2500,
      category_id: "c1",
      date: "2026-10-22",
      receive_type: "pix",
      report_weight: 1,
      source_ref: null,
    });

    expect(
      buildAdvisorConfirmExpenseInput(
        { name: "Spotify", valueCents: 3490, categoryId: "c1", cardId: "card-1" },
        "2026-10-22",
      ),
    ).toEqual({
      value: 34.9,
      date: "2026-10-22",
      categoryId: "c1",
      paymentMethod: "credit_card",
      cardId: "card-1",
      description: "Spotify",
      reportWeight: 1,
      installments: [{ date: "2026-10-22", value: 34.9, billCompetence: null }],
    });
  });

  it("detectCardChargesDrain gera insight acionável quando juros e multas superam o limiar", () => {
    const expenses = [
      { value: 15.0, charge_kind: "interest" as const },
      { value: 10.0, charge_kind: "fine" as const },
      { value: 100.0, charge_kind: "regular" as const },
    ];

    const result = detectCardChargesDrain(expenses, 2000);
    expect(result.hasDrain).toBe(true);
    expect(result.totalInterestCents).toBe(1500);
    expect(result.totalFineCents).toBe(1000);
    expect(result.totalDrainCents).toBe(2500);
    expect(result.chargeCount).toBe(2);
    expect(result.insight?.themeKey).toBe("charges:drain");
    expect(result.insight?.primaryAction?.kind).toBe("navigate_cards");
  });

  it("detectCardChargesDrain não gera insight quando abaixo do limiar", () => {
    const expenses = [
      { value: 5.0, charge_kind: "interest" as const },
      { value: 100.0, charge_kind: "regular" as const },
    ];

    const result = detectCardChargesDrain(expenses, 2000);
    expect(result.hasDrain).toBe(false);
    expect(result.insight).toBeNull();
  });

  it("mergePersistedAdvisorDismissals suporta merge concorrente, revogação pontual, limpeza total e poda de expirados", () => {
    const now = 1_000_000;
    const current = {
      "dup:netflix": now + 50_000,
      "habit:cafe": now + 20_000,
      expired: now - 10,
    };

    // patch undefined preserva atual
    expect(mergePersistedAdvisorDismissals(current, undefined, now)).toBe(current);

    // merge preservando outras chaves válidas e podando expirado
    expect(
      mergePersistedAdvisorDismissals(current, { "calib:academia": now + 90_000 }, now),
    ).toEqual({
      "dup:netflix": now + 50_000,
      "habit:cafe": now + 20_000,
      "calib:academia": now + 90_000,
    });

    // revogação via valor 0 remove apenas a chave alvo
    expect(
      mergePersistedAdvisorDismissals(current, { "dup:netflix": 0 }, now),
    ).toEqual({
      "habit:cafe": now + 20_000,
    });

    // limpeza total com {}
    expect(mergePersistedAdvisorDismissals(current, {}, now)).toEqual({});
  });
});
