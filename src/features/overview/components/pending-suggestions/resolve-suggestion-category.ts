import { findBestMatchingCategory } from "@/domain/insights";
import {
  inferCategoryKeyword,
  lookupMerchantCategory,
  type MerchantCategoryMapping,
  type ParsedBankTransaction,
} from "@/domain/notifications";
import type { Category } from "@/types";

/**
 * Resolve a categoria mais provável para uma transação detectada via notificação.
 */
export function resolveCategoryForSuggestion(
  sug: ParsedBankTransaction,
  categories: Category[],
  selectedId?: string,
  merchantMemory?: MerchantCategoryMapping,
): Category | undefined {
  if (selectedId) {
    const found = categories.find((c) => c.id === selectedId);
    if (found) return found;
  }

  if (sug.merchant && merchantMemory) {
    const memorized = lookupMerchantCategory(sug.merchant, merchantMemory);
    if (memorized) {
      const found = categories.find(
        (c) =>
          c.id === memorized ||
          c.icon === memorized ||
          c.name.toLowerCase().includes(memorized.toLowerCase()),
      );
      if (found) return found;
    }
  }

  if (sug.categorySlug) {
    const match = findBestMatchingCategory(categories, sug.categorySlug);
    if (match) return match;
  }

  const inferredSlug = inferCategoryKeyword(sug.description || sug.merchant || "");
  if (inferredSlug) {
    const match = findBestMatchingCategory(categories, inferredSlug);
    if (match) return match;
  }

  return (
    categories.find(
      (c) =>
        c.name.toLowerCase().includes("outros") ||
        c.name.toLowerCase().includes("geral") ||
        c.name.toLowerCase().includes("diversos"),
    ) || categories[0]
  );
}
