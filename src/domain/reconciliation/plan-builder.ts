import { inferBusinessTaxDeductibility } from "@/domain/business/tax-shield";
import type { TransactionScope } from "@/types";
import { projectFutureInstallments } from "./series-detector";
import type {
  PendingLinkAdjustment,
  PlannedExpenseToCreate,
  PlannedFutureInstallmentToProject,
  PlannedRefundToRegister,
  ReconciliationItem,
  ReconciliationPlan,
  ReconciliationPlanCompetenceMove,
  ReconciliationPlanMicroAdjustment,
  StatementCommitCompetenceMoveRow,
  StatementCommitExpenseRow,
  StatementCommitLinkAdjustmentRow,
  StatementCommitRefundRow,
} from "./contracts";

export interface BuildReconciliationPlanParams {
  cardId: string;
  competenceMonth: string;
  cardScope?: "personal" | "business" | "mixed";
  items: readonly ReconciliationItem[];
  fallbackCategoryId: string;
  reservedChargesCategoryId?: string | null;
  pendingLinkAdjustments?: ReadonlyMap<string, PendingLinkAdjustment>;
  suppressedMicroAdjustmentExpenseIds?: ReadonlySet<string>;
  approvedCompetenceMoveTxIds?: ReadonlySet<string>;
  queuedDeleteExpenseIds?: readonly string[];
  isRolledOver?: boolean;
  isPaidBill?: boolean;
  lockedCompetences?: ReadonlySet<string>;
  generateGroupId?: () => string;
}

const DEFAULT_UUID_GEN = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "00000000-0000-4000-8000-000000000000";
};

function centsToDecimalBrl(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

function resolveItemCategoryId(
  item: ReconciliationItem,
  fallbackCategoryId: string,
  reservedChargesCategoryId?: string | null,
): string {
  if (
    item.transaction.inferredChargeKind &&
    item.transaction.inferredChargeKind !== "regular" &&
    reservedChargesCategoryId
  ) {
    return reservedChargesCategoryId;
  }
  return item.selectedCategoryId || item.suggestedCategoryId || fallbackCategoryId;
}

function resolveItemScopeAndDeductibility(
  item: ReconciliationItem,
  cardScope: "personal" | "business" | "mixed",
): { scope: TransactionScope; isTaxDeductible: boolean } {
  const scope: TransactionScope =
    item.scope ?? (cardScope === "business" ? "business" : "personal");
  const isTaxDeductible =
    scope === "business"
      ? (item.isTaxDeductible ??
          inferBusinessTaxDeductibility({
            description: item.transaction.cleanDescription,
          }).isDeductible)
      : false;
  return { scope, isTaxDeductible };
}

/**
 * Monta o plano estruturado da revisão (Estágio 3 — D2, D9, D14, G9):
 * - Opt-out automático: novas compras, parcelas futuras faltantes K+1..N, estornos inéditos e microajustes <= R$ 0,05 com sinal forte;
 * - Opt-in explícito: ajustes manuais, movimentações de competência vizinha e exclusões cirúrgicas em staging;
 * - Fatura rolada bloqueia 100% das escritas; fatura quitada permite Blocos D/E e bloqueia Blocos A/B/C.
 */
export function buildReconciliationPlan(
  params: BuildReconciliationPlanParams,
): ReconciliationPlan {
  const {
    cardId,
    competenceMonth,
    cardScope = "personal",
    items,
    fallbackCategoryId,
    reservedChargesCategoryId = null,
    pendingLinkAdjustments,
    suppressedMicroAdjustmentExpenseIds,
    approvedCompetenceMoveTxIds,
    queuedDeleteExpenseIds = [],
    isRolledOver = false,
    isPaidBill = false,
    lockedCompetences,
    generateGroupId = DEFAULT_UUID_GEN,
  } = params;

  if (isRolledOver) {
    return {
      cardId,
      competenceMonth,
      blockedByRollover: true,
      paidBillLocksRestricted: true,
      newExpensesToCreate: [],
      futureInstallmentsToProject: [],
      refundsToRegister: [],
      microAdjustmentsToApply: [],
      manualLinkAdjustments: [],
      competenceMovesToApply: [],
      expenseIdsToDelete: [],
      totalActionCount: 0,
      pendingOptInCount: 0,
    };
  }

  const paidBillLocksRestricted = Boolean(
    isPaidBill || lockedCompetences?.has(competenceMonth),
  );

  const newExpensesToCreate: PlannedExpenseToCreate[] = [];
  const futureInstallmentsToProject: PlannedFutureInstallmentToProject[] = [];
  const refundsToRegister: PlannedRefundToRegister[] = [];
  const microAdjustmentsToApply: ReconciliationPlanMicroAdjustment[] = [];
  const manualLinkAdjustments: PendingLinkAdjustment[] = [];
  const competenceMovesToApply: ReconciliationPlanCompetenceMove[] = [];
  const handledAdjustmentExpenseIds = new Set<string>();

  let pendingOptInCount = 0;

  if (!paidBillLocksRestricted && pendingLinkAdjustments) {
    for (const adj of pendingLinkAdjustments.values()) {
      manualLinkAdjustments.push(adj);
      handledAdjustmentExpenseIds.add(adj.expenseId);
    }
  }

  for (const item of items) {
    const tx = item.transaction;
    if (tx.isPayment || item.ignoredByDefault) continue;

    // 1. Estornos (Bloco E — permitido mesmo em fatura quitada para compor histórico/saldo)
    if (tx.isRefund) {
      if (item.status === "unmatched_new" && item.selected) {
        const entry: PlannedRefundToRegister = {
          item,
          amountCents: tx.amountCents,
          date: tx.date,
          note: tx.cleanDescription || "Estorno de cartão",
          competenceMonth,
          statementHash: tx.statementHash,
        };
        refundsToRegister.push(entry);
      }
      continue;
    }

    // 2. Conciliações prováveis com divergência de centavos (Bloco B)
    if (item.status === "probable_match" && item.matchedExpenseId) {
      if (handledAdjustmentExpenseIds.has(item.matchedExpenseId)) {
        continue;
      }

      const diffCents =
        item.matchedExpenseValueCents !== undefined
          ? Math.abs(tx.amountCents - item.matchedExpenseValueCents)
          : 0;

      const isStrongMicroAdjustment =
        diffCents > 0 &&
        diffCents <= 5 &&
        item.score >= 65 &&
        item.hasStrongSemanticSignal === true;

      if (
        isStrongMicroAdjustment &&
        !paidBillLocksRestricted &&
        !suppressedMicroAdjustmentExpenseIds?.has(item.matchedExpenseId)
      ) {
        microAdjustmentsToApply.push({
          expenseId: item.matchedExpenseId,
          description: item.matchedExpenseDescription ?? tx.cleanDescription,
          originalValueCents: item.matchedExpenseValueCents ?? tx.amountCents,
          newValueCents: tx.amountCents,
          differenceCents: diffCents,
          statementHash: tx.statementHash,
          isAutoOptOut: true,
        });
        handledAdjustmentExpenseIds.add(item.matchedExpenseId);
      } else if (!paidBillLocksRestricted) {
        pendingOptInCount++;
      }
      continue;
    }

    // 3. Compras encontradas em competência vizinha M-1 / M+1 (Bloco C — opt-in)
    if (item.status === "unmatched_new" && item.crossCompetenceMatch) {
      const originLocked =
        paidBillLocksRestricted ||
        Boolean(lockedCompetences?.has(item.crossCompetenceMatch.currentBillCompetence));

      if (approvedCompetenceMoveTxIds?.has(tx.id)) {
        if (!originLocked) {
          competenceMovesToApply.push({
            expenseId: item.crossCompetenceMatch.expenseId,
            description: item.crossCompetenceMatch.expenseDescription,
            fromCompetenceMonth: item.crossCompetenceMatch.currentBillCompetence,
            toCompetenceMonth: competenceMonth,
            statementHash: item.crossCompetenceMatch.statementHash || tx.statementHash,
          });
        }
        continue;
      }

      if (!item.selected) {
        if (!originLocked) {
          pendingOptInCount++;
        }
        continue;
      }
    }

    // 4. Novas compras válidas + projeção exclusiva K+1..N (Bloco D — opt-out)
    if (item.status === "unmatched_new" && item.selected && tx.amountCents > 0) {
      const categoryId = resolveItemCategoryId(
        item,
        fallbackCategoryId,
        reservedChargesCategoryId,
      );
      const { scope, isTaxDeductible } = resolveItemScopeAndDeductibility(item, cardScope);
      const inst = tx.installment;
      const installmentsTotal = inst && inst.total > 1 ? inst.total : 1;
      const installmentNumber = inst && inst.total > 1 ? inst.current : 1;

      // G9: toda despesa parcelada (installmentsTotal > 1) exige UUID não-nulo compartilhado com K+1..N
      const installmentGroupId =
        installmentsTotal > 1
          ? (item.seriesAnalysis?.existingInstallmentGroupId ?? generateGroupId())
          : null;

      const chargeKind =
        tx.inferredChargeKind && tx.inferredChargeKind !== "regular"
          ? tx.inferredChargeKind
          : installmentsTotal > 1
            ? "installment"
            : "regular";

      newExpensesToCreate.push({
        item,
        date: tx.date,
        valueCents: tx.amountCents,
        categoryId,
        description: tx.cleanDescription,
        installmentsTotal,
        installmentNumber,
        installmentGroupId,
        billCompetence: competenceMonth,
        statementHash: tx.statementHash,
        chargeKind,
        scope,
        isTaxDeductible,
      });

      if (
        item.projectSeries &&
        installmentsTotal > installmentNumber &&
        installmentGroupId
      ) {
        const missingList = item.seriesAnalysis?.missingFutureInstallments;
        if (missingList === undefined || missingList.length > 0) {
          const projected = projectFutureInstallments({
            currentInstallment: installmentNumber,
            totalInstallments: installmentsTotal,
            installmentValueCents: tx.amountCents,
            baseDate: tx.date,
            baseCompetence: competenceMonth,
            description: tx.cleanDescription,
            categoryId,
            cardId,
            installmentGroupId,
            missingInstallments: missingList,
            scope,
            isTaxDeductible,
          });

          for (const p of projected) {
            futureInstallmentsToProject.push({
              installmentNumber: p.installmentNumber,
              installmentsTotal: p.installmentsTotal,
              date: p.date,
              billCompetence: p.billCompetence,
              valueCents: p.valueCents,
              description: p.description,
              categoryId: p.categoryId,
              installmentGroupId,
              statementHash: p.statementHash ?? tx.statementHash,
              scope: p.scope ?? scope,
              isTaxDeductible: Boolean(p.isTaxDeductible),
            });
          }
        }
      }
    }
  }

  const expenseIdsToDelete = paidBillLocksRestricted
    ? []
    : Array.from(new Set(queuedDeleteExpenseIds.filter(Boolean)));

  const totalActionCount =
    newExpensesToCreate.length +
    futureInstallmentsToProject.length +
    refundsToRegister.length +
    microAdjustmentsToApply.length +
    manualLinkAdjustments.length +
    competenceMovesToApply.length +
    expenseIdsToDelete.length;

  return {
    cardId,
    competenceMonth,
    blockedByRollover: false,
    paidBillLocksRestricted,
    newExpensesToCreate,
    futureInstallmentsToProject,
    refundsToRegister,
    microAdjustmentsToApply,
    manualLinkAdjustments,
    competenceMovesToApply,
    expenseIdsToDelete,
    totalActionCount,
    pendingOptInCount,
  };
}

export interface CommitReconciliationPlanPayload {
  expenses: StatementCommitExpenseRow[];
  linkAdjustments: StatementCommitLinkAdjustmentRow[];
  competenceMoves: StatementCommitCompetenceMoveRow[];
  refunds: StatementCommitRefundRow[];
  deleteExpenseIds: string[];
}

/**
 * Serializa `ReconciliationPlan` para os parâmetros snake_case do RPC
 * `commit_statement_reconciliation`, prontos para particionamento em lotes `<= 500`.
 */
export function toCommitReconciliationPlanPayload(
  plan: ReconciliationPlan,
): CommitReconciliationPlanPayload {
  const expenses: StatementCommitExpenseRow[] = [
    ...plan.newExpensesToCreate.map((exp) => ({
      date: exp.date,
      value: centsToDecimalBrl(exp.valueCents),
      category_id: exp.categoryId,
      description: exp.description,
      installments_total: exp.installmentsTotal,
      installment_number: exp.installmentNumber,
      installment_group_id: exp.installmentGroupId,
      bill_competence: exp.billCompetence,
      report_weight: 1.0,
      statement_hash: exp.statementHash,
      charge_kind: exp.chargeKind,
      scope: exp.scope,
      is_tax_deductible: exp.isTaxDeductible,
      is_projected: false,
    })),
    ...plan.futureInstallmentsToProject.map((proj) => ({
      date: proj.date,
      value: centsToDecimalBrl(proj.valueCents),
      category_id: proj.categoryId,
      description: proj.description,
      installments_total: proj.installmentsTotal,
      installment_number: proj.installmentNumber,
      installment_group_id: proj.installmentGroupId,
      bill_competence: proj.billCompetence,
      report_weight: 1.0,
      statement_hash: proj.statementHash,
      charge_kind: "installment",
      scope: proj.scope,
      is_tax_deductible: proj.isTaxDeductible,
      is_projected: true,
    })),
  ];

  const linkAdjustments: StatementCommitLinkAdjustmentRow[] = [
    ...plan.microAdjustmentsToApply.map((m) => ({
      expense_id: m.expenseId,
      new_value: centsToDecimalBrl(m.newValueCents),
      statement_hash: m.statementHash,
    })),
    ...plan.manualLinkAdjustments.map((adj) => ({
      expense_id: adj.expenseId,
      new_value: centsToDecimalBrl(adj.newValueCents),
      statement_hash: adj.statementHash,
    })),
  ];

  const competenceMoves: StatementCommitCompetenceMoveRow[] =
    plan.competenceMovesToApply.map((mv) => ({
      expense_id: mv.expenseId,
      target_competence: mv.toCompetenceMonth,
      statement_hash: mv.statementHash,
    }));

  const refunds: StatementCommitRefundRow[] = plan.refundsToRegister.map((ref) => ({
    amount: centsToDecimalBrl(ref.amountCents),
    date: ref.date,
    note: ref.note,
    competence_month: ref.competenceMonth,
    statement_hash: ref.statementHash,
  }));

  return {
    expenses,
    linkAdjustments,
    competenceMoves,
    refunds,
    deleteExpenseIds: [...plan.expenseIdsToDelete],
  };
}
