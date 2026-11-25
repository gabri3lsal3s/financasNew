import { sanitizeMerchantRawForLearning, type ReconciliationItem } from "@/domain/reconciliation";
import type { CreditCardScope } from "@/types";
import type { StatementItemPatch } from "./statement-import-types";
import {
  applyEditedReconciliationItem,
  createManualReconciliationItem,
  restoreIgnoredPaymentItem,
} from "./statement-reconcile-utils";

export function resolveSanitizedLearningRawName(
  tx: { merchantCleanRaw?: string; rawDescription: string; cleanDescription: string } | undefined,
  fallbackCleanDescription: string,
): string {
  if (!tx) {
    return sanitizeMerchantRawForLearning(fallbackCleanDescription) || fallbackCleanDescription;
  }
  return (
    tx.merchantCleanRaw ||
    sanitizeMerchantRawForLearning(tx.rawDescription) ||
    tx.cleanDescription ||
    fallbackCleanDescription
  );
}

export function toggleSingleItemSelection(
  items: readonly ReconciliationItem[],
  id: string,
): ReconciliationItem[] {
  return items.map((it) => (it.transaction.id === id ? { ...it, selected: !it.selected } : it));
}

export function setTabItemsSelection(
  items: readonly ReconciliationItem[],
  itemIds: readonly string[],
  selected: boolean,
): ReconciliationItem[] {
  const idSet = new Set(itemIds);
  if (idSet.size === 0) return [...items];
  return items.map((it) => (idSet.has(it.transaction.id) ? { ...it, selected } : it));
}

export function applyEditedItemToList(params: {
  items: readonly ReconciliationItem[];
  cardId: string;
  competenceMonth: string;
  id: string;
  updated: StatementItemPatch;
}): ReconciliationItem[] {
  const { items, cardId, competenceMonth, id, updated } = params;
  return items.map((it) =>
    it.transaction.id === id
      ? applyEditedReconciliationItem({ cardId, competenceMonth, current: it, updated })
      : it,
  );
}

export function prependManualItemToList(params: {
  items: readonly ReconciliationItem[];
  cardId: string;
  competenceMonth: string;
  item: StatementItemPatch;
}): ReconciliationItem[] {
  const { items, cardId, competenceMonth, item } = params;
  return [
    createManualReconciliationItem({ cardId, competenceMonth, item, index: items.length }),
    ...items,
  ];
}

export function toggleItemRefundInList(
  items: readonly ReconciliationItem[],
  id: string,
): ReconciliationItem[] {
  return items.map((it) => {
    if (it.transaction.id !== id) return it;
    const nextIsRefund = !it.transaction.isRefund;
    return {
      ...it,
      selected: true,
      ignoredByDefault: false,
      nature: nextIsRefund ? ("refund" as const) : ("purchase" as const),
      transaction: {
        ...it.transaction,
        isRefund: nextIsRefund,
        isPayment: false,
        nature: nextIsRefund ? ("refund" as const) : ("purchase" as const),
      },
    };
  });
}

export function restoreIgnoredPaymentInList(
  items: readonly ReconciliationItem[],
  id: string,
  targetMode: "purchase" | "refund",
): ReconciliationItem[] {
  return items.map((it) =>
    it.transaction.id === id ? restoreIgnoredPaymentItem(it, targetMode) : it,
  );
}

export function toggleItemScopeInList(
  items: readonly ReconciliationItem[],
  id: string,
  cardScope?: CreditCardScope,
): ReconciliationItem[] {
  return items.map((it) => {
    if (it.transaction.id !== id) return it;
    const current = it.scope ?? (cardScope === "business" ? "business" : "personal");
    const next = current === "business" ? "personal" : "business";
    return { ...it, scope: next, isTaxDeductible: next === "business" ? it.isTaxDeductible : false };
  });
}

export function setAllScopeInList(
  items: readonly ReconciliationItem[],
  scope: "personal" | "business",
): ReconciliationItem[] {
  return items.map((it) => ({
    ...it,
    scope,
    isTaxDeductible: scope === "business" ? it.isTaxDeductible : false,
  }));
}
