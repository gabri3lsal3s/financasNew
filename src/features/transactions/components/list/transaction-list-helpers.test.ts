import { describe, expect, it } from "vitest";
import type { MerchantLearningMemory } from "@/domain/notifications";
import type { Category, Expense } from "@/types";
import { computePagedFeed } from "./transaction-list-helpers";

const categories: Category[] = [
  {
    id: "cat-casa",
    user_id: "u1",
    name: "Casa",
    icon: "home",
    color: "#3B82F6",
    type: "expense",
    is_reserved: false,
    is_active: true,
  },
  {
    id: "cat-mercado",
    user_id: "u1",
    name: "Mercado",
    icon: "shopping-cart",
    color: "#10B981",
    type: "expense",
    is_reserved: false,
    is_active: true,
  },
];

const expenses: Expense[] = [
  {
    id: "exp-1",
    user_id: "u1",
    date: "2026-11-10",
    description: "REDE MOLEZA",
    value: 270,
    base_amount: 270,
    category_id: "cat-casa",
    payment_method: "credit_card",
    card_id: "card-nubank",
    bill_competence: "2026-11",
    installments_total: 3,
    installment_number: 1,
    installment_group_id: "grp-1",
    report_weight: 1,
    created_at: "2026-11-10T10:00:00Z",
  },
  {
    id: "exp-2",
    user_id: "u1",
    date: "2026-11-11",
    description: "Padaria Central",
    value: 45,
    base_amount: 45,
    category_id: "cat-mercado",
    payment_method: "pix",
    card_id: null,
    bill_competence: null,
    installments_total: 1,
    installment_number: 1,
    installment_group_id: null,
    report_weight: 1,
    created_at: "2026-11-11T10:00:00Z",
  },
];

describe("transaction-list-helpers — computePagedFeed com Busca Semântica", () => {
  it("aplica filtros estruturados de valor, parcelamento e tags semânticas do merchantLearning", () => {
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const cardById = new Map([["card-nubank", "Nubank"]]);
    const merchantLearning: MerchantLearningMemory = {
      tax_moleza: {
        friendlyName: "Rede Moleza",
        categorySlug: "cat-casa",
        rawAliases: ["REDE MOLEZA"],
        semanticTags: ["eletrica", "reforma"],
        usageCount: 2,
        lastUsedAt: "2026-11-10T12:00:00.000Z",
      },
    };

    const res = computePagedFeed({
      expenses,
      incomes: [],
      filter: "all",
      searchQuery: "reforma parcelado acima de 100",
      categoryById,
      cardById,
      merchantLearning,
      referenceMonth: "2026-11",
      todayISO: "2026-11-23",
      highlightId: null,
      visibleCount: 50,
    });

    expect(res.filteredFeedItems).toHaveLength(1);
    expect(res.filteredFeedItems[0]?.id).toBe("exp-1");
    expect(res.structuredFilterBadges).toContain("Parcelado");
    expect(res.structuredFilterBadges.some((b) => /Acima de R\$\s*100,00/.test(b))).toBe(true);

    const byCard = computePagedFeed({
      expenses,
      incomes: [],
      filter: "all",
      searchQuery: "nubank",
      categoryById,
      cardById,
      merchantLearning,
      referenceMonth: "2026-11",
      todayISO: "2026-11-23",
      highlightId: null,
      visibleCount: 50,
    });
    expect(byCard.filteredFeedItems.map((i) => i.id)).toEqual(["exp-1"]);
  });
});
