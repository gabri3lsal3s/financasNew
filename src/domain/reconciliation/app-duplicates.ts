import { jaccardTokens, tokenize } from "@/domain/predictions";
import type {
  AppDuplicateCandidate,
  ExistingExpenseForReconciliation,
  ReconciliationItem,
} from "./contracts";

const MAX_DUPLICATE_DAYS_DIFF = 3;

function daysBetweenIso(a: string, b: string): number {
  const ta = new Date(`${a}T00:00:00`).getTime();
  const tb = new Date(`${b}T00:00:00`).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((ta - tb) / 86_400_000));
}

function normalizeDescriptionForCompare(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function haveCompatibleInstallments(
  a: ExistingExpenseForReconciliation,
  b: ExistingExpenseForReconciliation,
): boolean {
  const aIsInstallment = (a.installmentsTotal ?? 1) > 1;
  const bIsInstallment = (b.installmentsTotal ?? 1) > 1;
  if (!aIsInstallment || !bIsInstallment) return true;
  return (
    a.installmentNumber === b.installmentNumber &&
    a.installmentsTotal === b.installmentsTotal
  );
}

/**
 * Avalia se duas despesas cadastradas no aplicativo têm alta probabilidade de
 * serem um lançamento duplicado (ex.: cadastrado manualmente dois dias seguidos).
 */
export function areAppExpensesLikelyDuplicate(
  a: ExistingExpenseForReconciliation,
  b: ExistingExpenseForReconciliation,
): { matched: boolean; reason: string } {
  if (a.id === b.id) return { matched: false, reason: "" };
  if (a.valueCents <= 0 || a.valueCents !== b.valueCents) {
    return { matched: false, reason: "" };
  }
  if (!haveCompatibleInstallments(a, b)) {
    return { matched: false, reason: "" };
  }

  const diffDays = daysBetweenIso(a.date, b.date);
  if (diffDays > MAX_DUPLICATE_DAYS_DIFF) {
    return { matched: false, reason: "" };
  }

  const normA = normalizeDescriptionForCompare(a.description);
  const normB = normalizeDescriptionForCompare(b.description);
  const exactDesc = Boolean(normA && normB && normA === normB);
  const containedDesc = Boolean(
    normA.length >= 4 &&
      normB.length >= 4 &&
      (normA.includes(normB) || normB.includes(normA)),
  );
  const sim = jaccardTokens(tokenize(a.description), tokenize(b.description));

  if (exactDesc || containedDesc || sim >= 0.4) {
    const dayLabel =
      diffDays === 0
        ? "mesmo dia"
        : diffDays === 1
          ? "1 dia de diferença"
          : `${diffDays} dias de diferença`;
    return {
      matched: true,
      reason: `Mesmo valor e descrição semelhante (${dayLabel})`,
    };
  }

  if (diffDays <= 1 && a.categoryId && a.categoryId === b.categoryId) {
    return {
      matched: true,
      reason:
        diffDays === 0
          ? "Mesmo valor, mesma categoria e mesmo dia"
          : "Mesmo valor, mesma categoria e 1 dia de diferença",
    };
  }

  return { matched: false, reason: "" };
}

/**
 * Detecta possíveis despesas duplicadas já cadastradas no app:
 * 1) Uma despesa excedente em `unmatchedExistingExpenses` que duplica uma despesa já conciliada na fatura;
 * 2) Duas despesas excedentes em `unmatchedExistingExpenses` idênticas/semelhantes entre si.
 */
export function findAppDuplicateCandidates(params: {
  items: readonly ReconciliationItem[];
  existingExpenses: readonly ExistingExpenseForReconciliation[];
  unmatchedExistingExpenses: readonly ExistingExpenseForReconciliation[];
}): AppDuplicateCandidate[] {
  const { items, existingExpenses, unmatchedExistingExpenses } = params;
  if (unmatchedExistingExpenses.length === 0) return [];

  const existingById = new Map(existingExpenses.map((e) => [e.id, e]));
  const matchedExpenses: ExistingExpenseForReconciliation[] = [];
  for (const it of items) {
    if (
      (it.status === "exact_match" || it.status === "probable_match") &&
      it.matchedExpenseId
    ) {
      const found = existingById.get(it.matchedExpenseId);
      if (found) matchedExpenses.push(found);
    }
  }

  const candidates: AppDuplicateCandidate[] = [];
  const usedDuplicateIds = new Set<string>();

  // 1. Excedente no app que duplica uma despesa já conciliada na fatura
  for (const unmatched of unmatchedExistingExpenses) {
    if (usedDuplicateIds.has(unmatched.id)) continue;
    for (const matched of matchedExpenses) {
      const check = areAppExpensesLikelyDuplicate(matched, unmatched);
      if (check.matched) {
        usedDuplicateIds.add(unmatched.id);
        candidates.push({
          id: `app-dup:${matched.id}:${unmatched.id}`,
          keepExpense: matched,
          duplicateExpense: unmatched,
          keepIsMatchedOnStatement: true,
          reason: `${check.reason} — a principal já está conciliada com esta fatura`,
        });
        break;
      }
    }
  }

  // 2. Duplicatas entre despesas que sobraram sem par na fatura
  const remaining = unmatchedExistingExpenses.filter((e) => !usedDuplicateIds.has(e.id));
  for (let i = 0; i < remaining.length; i++) {
    const first = remaining[i]!;
    if (usedDuplicateIds.has(first.id)) continue;

    for (let j = i + 1; j < remaining.length; j++) {
      const second = remaining[j]!;
      if (usedDuplicateIds.has(second.id)) continue;

      const check = areAppExpensesLikelyDuplicate(first, second);
      if (check.matched) {
        // Prefere manter a que já tem statementHash ou a mais antiga por data
        const keepFirst =
          Boolean(first.statementHash) && !second.statementHash
            ? true
            : !first.statementHash && Boolean(second.statementHash)
              ? false
              : first.date <= second.date;

        const keepExpense = keepFirst ? first : second;
        const duplicateExpense = keepFirst ? second : first;
        usedDuplicateIds.add(duplicateExpense.id);
        candidates.push({
          id: `app-dup:${keepExpense.id}:${duplicateExpense.id}`,
          keepExpense,
          duplicateExpense,
          keepIsMatchedOnStatement: false,
          reason: check.reason,
        });
      }
    }
  }

  return candidates;
}
