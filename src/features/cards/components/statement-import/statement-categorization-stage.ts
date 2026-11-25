import {
  matchCategoryBySlug,
  resolveMerchantIdentity,
  type CanonicalCategorySlug,
  type MerchantLearningMemory,
} from "@/domain/notifications";
import {
  detectInstallmentSeriesState,
  predictCategoryForDescription,
  type CategoryPredictionSource,
  type ExistingExpenseForReconciliation,
  type ExistingRefundForReconciliation,
  type ReconciliationItem,
  type StatementTransaction,
} from "@/domain/reconciliation";
import { categorizeDescriptionsBatchWithAi } from "@/services/ai-assistant";
import type { Category } from "@/types";
import { MAX_AI_CATEGORIZE_BATCH_ITEMS } from "../../../../../supabase/functions/_shared/ai-schemas";
import { sanitizeDescriptionForStatementMicroAi } from "./statement-file-loader";
import { resolveReservedChargesCategoryId, runStatementReconciliation } from "./statement-reconcile-mappers";

const NO_HISTORY_SENTINEL = "__NO_HISTORY_MATCH__";

export interface SyncBatchCategorizationParams {
  transactions: StatementTransaction[];
  existingExpenses: ExistingExpenseForReconciliation[];
  adjacentExpenses: ExistingExpenseForReconciliation[];
  existingRefunds: ExistingRefundForReconciliation[];
  allCardExpenses: ExistingExpenseForReconciliation[];
  competenceMonth: string;
  cardScope?: "personal" | "business" | "mixed";
  categories: readonly Category[];
  history: CategoryPredictionSource[];
  defaultCategoryId: string;
  userMemory: MerchantLearningMemory;
  userId?: string | null;
  isReadOnlyMode: boolean;
  aiExtractionEnabled: boolean;
  canRunPassiveCategorizeBatch: boolean;
  officialTotalValidated?: boolean;
  isMultiImageOverlapRisk?: boolean;
  signal: AbortSignal;
  onStatusMessage?: (msg: string) => void;
}

/**
 * Estágio 3 + D4: categorização local (D12 encargos -> histórico -> merchant -> catálogo)
 * seguida por 1 lote síncrono `categorize_batch` (máx. 40, teto 4s, com reserva do último crédito)
 * ANTES de abrir a conferência.
 */
export async function runSyncBatchCategorization(params: SyncBatchCategorizationParams) {
  const reservedChargesCatId = resolveReservedChargesCategoryId(params.categories);

  const runPass = (
    txList: StatementTransaction[],
    aiHits?: ReadonlyMap<string, { friendlyName: string; categoryId: string }>,
  ) => {
    const recon = runStatementReconciliation({
      transactions: txList,
      existingExpenses: params.existingExpenses,
      adjacentExpenses: params.adjacentExpenses,
      existingRefunds: params.existingRefunds,
      history: params.history,
      defaultCategoryId: params.defaultCategoryId,
      reservedChargesCategoryId: reservedChargesCatId,
      cardScope: params.cardScope,
      officialTotalValidated: params.officialTotalValidated,
      isMultiImageOverlapRisk: params.isMultiImageOverlapRisk,
    });

    const unknowns = new Map<string, { cleanText: string; totalAmountCents: number }>();
    const items = recon.items.map((rawItem) => {
      const inst = rawItem.transaction.installment;
      const seriesAnalysis =
        inst && inst.total > 1
          ? detectInstallmentSeriesState({
              transaction: rawItem.transaction,
              competenceMonth: params.competenceMonth,
              existingExpenses: params.allCardExpenses,
              cardScope: params.cardScope,
            })
          : undefined;

      const item: ReconciliationItem =
        seriesAnalysis !== undefined
          ? {
              ...rawItem,
              seriesAnalysis,
              projectSeries:
                seriesAnalysis !== null &&
                seriesAnalysis.state !== "state_4_already_projected" &&
                seriesAnalysis.missingFutureInstallments.length > 0,
            }
          : rawItem;

      if (item.status !== "unmatched_new" || item.ignoredByDefault || item.transaction.isRefund) {
        return item;
      }

      if (
        item.transaction.inferredChargeKind &&
        item.transaction.inferredChargeKind !== "regular" &&
        reservedChargesCatId
      ) {
        return {
          ...item,
          suggestedCategoryId: reservedChargesCatId,
          selectedCategoryId: reservedChargesCatId,
        };
      }

      const aiHit =
        aiHits?.get(item.transaction.cleanDescription.trim().toLowerCase()) ??
        aiHits?.get(item.transaction.rawDescription.trim().toLowerCase());
      if (aiHit) {
        return {
          ...item,
          suggestedCategoryId: aiHit.categoryId,
          selectedCategoryId: aiHit.categoryId,
          transaction: {
            ...item.transaction,
            cleanDescription: aiHit.friendlyName || item.transaction.cleanDescription,
          },
        };
      }

      if (
        predictCategoryForDescription(
          item.transaction.cleanDescription,
          params.history,
          NO_HISTORY_SENTINEL,
        ) !== NO_HISTORY_SENTINEL
      ) {
        return item;
      }

      const idn = resolveMerchantIdentity({
        merchantOrDescription: item.transaction.cleanDescription,
        rawText: item.transaction.rawDescription,
        userMemory: params.userMemory,
      });
      if (idn.categorySlug) {
        const cat = matchCategoryBySlug(
          [...params.categories],
          idn.categorySlug as CanonicalCategorySlug | string,
        );
        if (cat) {
          return {
            ...item,
            suggestedCategoryId: cat.id,
            selectedCategoryId: cat.id,
            transaction: {
              ...item.transaction,
              cleanDescription: idn.friendlyName || item.transaction.cleanDescription,
            },
          };
        }
      }

      const cleanTrim = item.transaction.cleanDescription.trim();
      const key = cleanTrim.toLowerCase();
      if (key) {
        const prev = unknowns.get(key);
        unknowns.set(key, {
          cleanText: cleanTrim,
          totalAmountCents: (prev?.totalAmountCents ?? 0) + item.transaction.amountCents,
        });
      }
      return item;
    });

    return {
      items,
      unmatchedExistingExpenses: recon.unmatchedExistingExpenses,
      appDuplicates: recon.appDuplicates ?? [],
      unknowns,
    };
  };

  let state = runPass(params.transactions);
  const topUnknowns = [...state.unknowns.entries()]
    .sort((a, b) => b[1].totalAmountCents - a[1].totalAmountCents)
    .slice(0, MAX_AI_CATEGORIZE_BATCH_ITEMS);

  const canCallAi =
    topUnknowns.length > 0 &&
    params.categories.length > 1 &&
    !params.isReadOnlyMode &&
    params.aiExtractionEnabled &&
    params.canRunPassiveCategorizeBatch &&
    (typeof navigator === "undefined" || navigator.onLine !== false);

  if (canCallAi && !params.signal.aborted) {
    params.onStatusMessage?.("Organizando categorias...");
    try {
      const batch = topUnknowns
        .map(([key, e]) => ({
          key,
          cleanText: e.cleanText,
          sanitized: sanitizeDescriptionForStatementMicroAi(e.cleanText),
        }))
        .filter((e) => e.sanitized.length > 0);

      if (batch.length > 0) {
        const res = await categorizeDescriptionsBatchWithAi({
          descriptions: batch.map((b) => b.sanitized),
          categories: params.categories.map((c) => ({ id: c.id, name: c.name })),
          userId: params.userId,
          isReadOnlyMode: params.isReadOnlyMode,
          featureEnabled: params.aiExtractionEnabled,
          priority: "passive",
          signal: params.signal,
        });

        if (res.ok && !params.signal.aborted) {
          const allowed = new Set(params.categories.map((c) => c.id));
          const hits = new Map<string, { friendlyName: string; categoryId: string }>();
          for (const item of res.data.items) {
            const src = batch[item.index];
            if (src && item.categoryId && allowed.has(item.categoryId)) {
              const hit = {
                friendlyName: item.canonicalMerchant || item.friendlyName || src.cleanText,
                categoryId: item.categoryId,
              };
              hits.set(src.key, hit);
              hits.set(hit.friendlyName.trim().toLowerCase(), hit);
            }
          }
          if (hits.size > 0) {
            const enrichedTxs = params.transactions.map((tx) => {
              const hit =
                hits.get(tx.cleanDescription.trim().toLowerCase()) ??
                hits.get(tx.rawDescription.trim().toLowerCase());
              return hit ? { ...tx, cleanDescription: hit.friendlyName || tx.cleanDescription } : tx;
            });
            state = runPass(enrichedTxs, hits);
          }
        }
      }
    } catch {
      // Degrada silenciosamente mantendo categorização local
    }
  }

  return {
    items: state.items,
    unmatchedExistingExpenses: state.unmatchedExistingExpenses,
    appDuplicates: state.appDuplicates,
  };
}
