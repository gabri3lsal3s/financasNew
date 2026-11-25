import { useCallback, useState } from "react";
import {
  buildStatementCommitChunks,
  STATEMENT_COMMIT_CHUNK_SIZE,
  toCloudBlueprintRules,
  toCommitReconciliationPlanPayload,
  validateBlueprintWithShadowReplay,
  type ReconciliationPlan,
} from "@/domain/reconciliation";
import { getErrorMessage } from "@/services/errors";
import { autoLearnExpenseCategory } from "@/services/merchant-learning";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  useCommitStatementReconciliation,
  useUpsertStatementBlueprint,
  type CommitStatementReconciliationParams,
  type CommitStatementReconciliationResult,
} from "@/state";
import type {
  DraftStatementBlueprintSession,
  StatementCommitRetryState,
  StatementCommitSummary,
  StatementImportProgress,
} from "./statement-import-types";

const emptyCommitResult = (): CommitStatementReconciliationResult => ({
  success: true, inserted_count: 0, projected_count: 0, skipped_count: 0, adjusted_count: 0, moved_count: 0, refunds_count: 0, deleted_count: 0,
});

function mergeCommitResults(acc: CommitStatementReconciliationResult, res: CommitStatementReconciliationResult): CommitStatementReconciliationResult {
  return {
    success: acc.success && (res.success ?? true),
    inserted_count: acc.inserted_count + (res.inserted_count ?? 0),
    projected_count: acc.projected_count + (res.projected_count ?? 0),
    skipped_count: acc.skipped_count + (res.skipped_count ?? 0),
    adjusted_count: acc.adjusted_count + (res.adjusted_count ?? 0),
    moved_count: acc.moved_count + (res.moved_count ?? 0),
    refunds_count: acc.refunds_count + (res.refunds_count ?? 0),
    deleted_count: acc.deleted_count + (res.deleted_count ?? 0),
  };
}

function buildSuccessToastTitle(acc: CommitStatementReconciliationResult): string {
  if (acc.inserted_count === 0 && acc.skipped_count > 0 && acc.adjusted_count === 0 && acc.refunds_count === 0 && acc.deleted_count === 0) {
    return `Nenhum novo lançamento criado (${acc.skipped_count} ${acc.skipped_count === 1 ? "já existia" : "já existiam"} no aplicativo).`;
  }
  const insertedText = `${acc.inserted_count} ${acc.inserted_count === 1 ? "lançamento criado" : "lançamentos criados"}`;
  const skippedText = acc.skipped_count > 0 ? ` (${acc.skipped_count} duplicatas ignoradas)` : "";
  const adjustedText = acc.adjusted_count > 0 ? ` · ${acc.adjusted_count} despesa(s) vinculada(s)` : "";
  const projectedText = acc.projected_count > 0 ? ` · ${acc.projected_count} parcelas futuras projetadas` : "";
  return `Fatura importada com sucesso: ${insertedText}${skippedText}${adjustedText}${projectedText}.`;
}

export interface UseStatementCommitParams {
  onError: (msg: string | null) => void;
  onSuccessCloseOrStep: (summary: StatementCommitSummary) => void;
}

export function useStatementCommit({ onError, onSuccessCloseOrStep }: UseStatementCommitParams) {
  const commitMutation = useCommitStatementReconciliation();
  const upsertBlueprintMutation = useUpsertStatementBlueprint();

  const [importProgress, setImportProgress] = useState<StatementImportProgress | null>(null);
  const [commitRetryState, setCommitRetryState] = useState<StatementCommitRetryState | null>(null);
  const [commitSummary, setCommitSummary] = useState<StatementCommitSummary | null>(null);

  const persistApprovedBlueprintDraft = useCallback(
    async (draft: DraftStatementBlueprintSession | null, cardId: string, competenceMonth: string, closingDay?: number | null) => {
      if (!draft) return;
      try {
        const replay = validateBlueprintWithShadowReplay({
          blueprint: draft.blueprint, spatialLines: draft.spatialLines, rawLines: draft.rawLines, cardId, competenceMonth, closingDay,
          officialTotalCents: draft.officialTotalCents, cycleNetTargetCents: draft.cycleNetTargetCents, previousBalanceCents: draft.previousBalanceCents, paymentsCents: draft.paymentsCents,
        });
        if (replay.passed && (draft.blueprint.fileKind === "pdf_text" || draft.blueprint.fileKind === "text")) {
          await upsertBlueprintMutation.mutateAsync({
            fingerprint: draft.blueprint.fingerprint, issuerKey: draft.blueprint.issuerKey, issuerName: draft.blueprint.issuerName,
            fileKind: draft.blueprint.fileKind, rulesJson: toCloudBlueprintRules(draft.blueprint),
          });
        }
      } catch { /* persistência de blueprint na nuvem é não-bloqueante */ }
    },
    [upsertBlueprintMutation],
  );

  const runChunkSequence = useCallback(
    async (params: {
      chunks: CommitStatementReconciliationParams[]; startIndex: number; initialAccumulated: CommitStatementReconciliationResult;
      cardId: string; competenceMonth: string; closingDay?: number | null; openBalanceBeforeCents: number;
      itemsForLearning: ReadonlyArray<{ cleanDescription: string; merchantCleanRaw?: string; selectedCategoryId: string }>;
      draftBlueprint: DraftStatementBlueprintSession | null;
    }) => {
      const totalExpenses = Math.max(1, params.chunks.reduce((acc, c) => acc + (c.expenses?.length ?? 0), 0));
      let processed = params.chunks.slice(0, params.startIndex).reduce((acc, c) => acc + (c.expenses?.length ?? 0), 0);
      let accumulated = { ...params.initialAccumulated };

      setImportProgress({ currentChunk: params.startIndex + 1, totalChunks: params.chunks.length, percent: Math.round((processed / totalExpenses) * 100), processedItems: processed, totalItems: totalExpenses });

      for (let i = params.startIndex; i < params.chunks.length; i++) {
        const chunk = params.chunks[i]!;
        try {
          const res = await commitMutation.mutateAsync(chunk);
          accumulated = mergeCommitResults(accumulated, res);
          processed += chunk.expenses?.length ?? 0;
          setImportProgress({ currentChunk: Math.min(i + 2, params.chunks.length), totalChunks: params.chunks.length, percent: Math.round((processed / totalExpenses) * 100), processedItems: processed, totalItems: totalExpenses });
        } catch (err) {
          const msg = getErrorMessage(err);
          setCommitRetryState({ pendingChunkIndex: i, totalChunks: params.chunks.length, chunks: params.chunks, accumulated, lastError: msg, cardId: params.cardId, competenceMonth: params.competenceMonth, openBalanceAfterCents: params.openBalanceBeforeCents, itemsForLearning: params.itemsForLearning, draftBlueprint: params.draftBlueprint });
          triggerSensory("error");
          onError(msg);
          pushToast({ variant: "destructive", title: "Não foi possível importar a fatura", description: msg });
          setImportProgress(null);
          return null;
        }
      }

      setCommitRetryState(null);
      setImportProgress(null);
      await persistApprovedBlueprintDraft(params.draftBlueprint, params.cardId, params.competenceMonth, params.closingDay);

      try {
        const seen = new Set<string>();
        for (const item of params.itemsForLearning) {
          if (!item.selectedCategoryId) continue;
          const merchantClean = (item.merchantCleanRaw || item.cleanDescription).trim();
          const key = `${merchantClean.toLowerCase()}|${item.selectedCategoryId}`;
          if (!merchantClean || seen.has(key)) continue;
          seen.add(key);
          autoLearnExpenseCategory(item.cleanDescription.trim(), item.selectedCategoryId, undefined, merchantClean);
        }
      } catch { /* aprendizado local não bloqueia */ }

      triggerSensory("success");
      const summary: StatementCommitSummary = {
        insertedCount: accumulated.inserted_count, projectedCount: accumulated.projected_count, skippedCount: accumulated.skipped_count,
        adjustedCount: accumulated.adjusted_count, movedCount: accumulated.moved_count, refundsCount: accumulated.refunds_count,
        deletedCount: accumulated.deleted_count, openBalanceAfterCents: params.openBalanceBeforeCents,
      };
      setCommitSummary(summary);
      pushToast({ variant: "default", title: buildSuccessToastTitle(accumulated) });
      onSuccessCloseOrStep(summary);
      return summary;
    },
    [commitMutation, onError, onSuccessCloseOrStep, persistApprovedBlueprintDraft],
  );

  const handleConfirmCommit = useCallback(
    async (params: {
      plan: ReconciliationPlan; closingDay?: number | null; categoriesCount: number; isReadOnlyMode: boolean;
      hasUnconfirmedCardMismatch: boolean; openBalanceBeforeCents: number; draftBlueprint: DraftStatementBlueprintSession | null; onConsumeDraftBlueprint: () => void;
    }) => {
      if (params.isReadOnlyMode) {
        const msg = "Modo somente leitura ativo. Não é possível importar lançamentos.";
        triggerSensory("error"); onError(msg); pushToast({ variant: "destructive", title: "Importação indisponível", description: msg });
        return null;
      }
      if (params.plan.blockedByRollover) {
        triggerSensory("error"); onError("Esta fatura já foi rolada/refinanciada e não permite importação.");
        return null;
      }
      if (params.hasUnconfirmedCardMismatch) {
        triggerSensory("error"); onError("Confirme o cartão de destino antes de aplicar a fatura.");
        return null;
      }
      if (params.plan.totalActionCount === 0) {
        const draft = params.draftBlueprint;
        params.onConsumeDraftBlueprint();
        await persistApprovedBlueprintDraft(draft, params.plan.cardId, params.plan.competenceMonth, params.closingDay);
        triggerSensory("success");
        pushToast({ variant: "default", title: "Conferência concluída", description: "Todos os lançamentos desta fatura já estão conciliados no aplicativo." });
        const zeroSummary: StatementCommitSummary = { insertedCount: 0, projectedCount: 0, skippedCount: 0, adjustedCount: 0, movedCount: 0, refundsCount: 0, deletedCount: 0, openBalanceAfterCents: params.openBalanceBeforeCents };
        setCommitSummary(zeroSummary);
        onSuccessCloseOrStep(zeroSummary);
        return zeroSummary;
      }
      if (params.plan.newExpensesToCreate.length > 0 && params.categoriesCount === 0) {
        const msg = "Nenhuma categoria de despesa foi encontrada. Crie ao menos uma categoria de despesa antes de importar a fatura.";
        triggerSensory("error"); onError(msg); pushToast({ variant: "destructive", title: "Categoria obrigatória", description: msg });
        return null;
      }

      onError(null);
      const addedNewCents = params.plan.newExpensesToCreate.reduce((sum, e) => sum + e.item.transaction.amountCents, 0);
      const addedRefundsCents = params.plan.refundsToRegister.reduce((sum, r) => sum + r.amountCents, 0);
      const adjustmentsDeltaCents = [...params.plan.microAdjustmentsToApply, ...params.plan.manualLinkAdjustments].reduce((sum, a) => sum + (a.differenceCents ?? (a.newValueCents - a.originalValueCents)), 0);
      const estimatedOpenBalanceAfterCents = Math.max(0, params.openBalanceBeforeCents + addedNewCents + adjustmentsDeltaCents - addedRefundsCents);

      const payload = toCommitReconciliationPlanPayload(params.plan);
      const chunks = buildStatementCommitChunks(payload, STATEMENT_COMMIT_CHUNK_SIZE).map((c) => ({
        cardId: params.plan.cardId, competenceMonth: params.plan.competenceMonth, expenses: c.expenses,
        linkAdjustments: c.linkAdjustments, competenceMoves: c.competenceMoves, refunds: c.refunds, deleteExpenseIds: c.deleteExpenseIds,
      }));
      const draft = params.draftBlueprint;
      params.onConsumeDraftBlueprint();
      return runChunkSequence({
        chunks, startIndex: 0, initialAccumulated: emptyCommitResult(), cardId: params.plan.cardId, competenceMonth: params.plan.competenceMonth,
        closingDay: params.closingDay, openBalanceBeforeCents: estimatedOpenBalanceAfterCents,
        itemsForLearning: params.plan.newExpensesToCreate.map((exp) => ({ cleanDescription: exp.item.transaction.cleanDescription, merchantCleanRaw: exp.item.transaction.merchantCleanRaw, selectedCategoryId: exp.categoryId })),
        draftBlueprint: draft,
      });
    },
    [onError, onSuccessCloseOrStep, persistApprovedBlueprintDraft, runChunkSequence],
  );

  const handleRetryPendingChunks = useCallback(
    async (closingDay?: number | null) => {
      if (!commitRetryState) return null;
      onError(null);
      return runChunkSequence({
        chunks: commitRetryState.chunks, startIndex: commitRetryState.pendingChunkIndex, initialAccumulated: commitRetryState.accumulated,
        cardId: commitRetryState.cardId, competenceMonth: commitRetryState.competenceMonth, closingDay, openBalanceBeforeCents: commitRetryState.openBalanceAfterCents,
        itemsForLearning: commitRetryState.itemsForLearning, draftBlueprint: commitRetryState.draftBlueprint,
      });
    },
    [commitRetryState, onError, runChunkSequence],
  );

  return {
    isPending: commitMutation.isPending || importProgress !== null,
    importProgress, commitRetryState, commitSummary,
    clearCommitState: useCallback(() => { setCommitRetryState(null); setCommitSummary(null); setImportProgress(null); }, []),
    handleConfirmCommit, handleRetryPendingChunks,
  };
}
