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

  it("filtra feed por aba de negócio e sub-chips contextuais (dedutível, reembolso, transferências)", () => {
    const bizExpenses: Expense[] = [
      {
        id: "exp-pj-1",
        user_id: "u1",
        date: "2026-11-12",
        description: "Contador Online",
        value: 300,
        base_amount: 300,
        category_id: "cat-casa",
        payment_method: "pix",
        card_id: null,
        bill_competence: null,
        installments_total: 1,
        installment_number: 1,
        installment_group_id: null,
        report_weight: 1,
        scope: "business",
        is_tax_deductible: true,
        created_at: "2026-11-12T10:00:00Z",
      },
      {
        id: "exp-pj-card",
        user_id: "u1",
        date: "2026-11-13",
        description: "Google Cloud PJ",
        value: 150,
        base_amount: 150,
        category_id: "cat-casa",
        payment_method: "credit_card",
        card_id: "card-nubank",
        bill_competence: "2026-11",
        installments_total: 1,
        installment_number: 1,
        installment_group_id: null,
        report_weight: 1,
        scope: "business",
        is_tax_deductible: false,
        created_at: "2026-11-13T10:00:00Z",
      },
      {
        id: "exp-transfer",
        user_id: "u1",
        date: "2026-11-14",
        description: "Pró-Labore Transferência",
        value: 2000,
        base_amount: 2000,
        category_id: "cat-casa",
        payment_method: "transfer",
        card_id: null,
        bill_competence: null,
        installments_total: 1,
        installment_number: 1,
        installment_group_id: null,
        report_weight: 1,
        scope: "business",
        is_internal_transfer: true,
        transfer_kind: "pro_labore",
        transfer_pair_id: "pair-1",
        created_at: "2026-11-14T10:00:00Z",
      },
    ];

    const categoryById = new Map(categories.map((c) => [c.id, c]));

    // 1. Todos do negócio
    const allBiz = computePagedFeed({
      expenses: bizExpenses,
      incomes: [],
      filter: "business",
      businessSubFilter: "all",
      searchQuery: "",
      categoryById,
      visibleCount: 50,
      highlightId: null,
    });
    expect(allBiz.filteredFeedItems).toHaveLength(3);

    // 2. Dedutíveis
    const deductible = computePagedFeed({
      expenses: bizExpenses,
      incomes: [],
      filter: "business",
      businessSubFilter: "deductible",
      searchQuery: "",
      categoryById,
      visibleCount: 50,
      highlightId: null,
    });
    expect(deductible.filteredFeedItems.map((i) => i.id)).toEqual(["exp-pj-1"]);

    // 3. A Reembolsar (compras no cartão)
    const reimbursement = computePagedFeed({
      expenses: bizExpenses,
      incomes: [],
      filter: "business",
      businessSubFilter: "reimbursement",
      searchQuery: "",
      categoryById,
      visibleCount: 50,
      highlightId: null,
    });
    expect(reimbursement.filteredFeedItems.map((i) => i.id)).toEqual(["exp-pj-card"]);

    // 4. Transferências internas
    const transfers = computePagedFeed({
      expenses: bizExpenses,
      incomes: [],
      filter: "business",
      businessSubFilter: "transfers",
      searchQuery: "",
      categoryById,
      visibleCount: 50,
      highlightId: null,
    });
    expect(transfers.filteredFeedItems.map((i) => i.id)).toEqual(["exp-transfer"]);
  });
});
