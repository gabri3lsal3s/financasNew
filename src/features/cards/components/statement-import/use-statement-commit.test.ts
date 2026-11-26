import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReconciliationPlan } from "@/domain/reconciliation";
import { useStatementCommit } from "./use-statement-commit";

const mockMutateAsync = vi.fn();
const mockFetchReceipts = vi.fn();

vi.mock("@/state", () => ({
  fetchStatementReconciliationReceipts: (...args: unknown[]) => mockFetchReceipts(...args),
  useCommitStatementReconciliation: () => ({
    mutateAsync: (...args: unknown[]) => mockMutateAsync(...args),
    isPending: false,
  }),
  useUpsertStatementBlueprint: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  }),
}));

vi.mock("@/services/sensory", () => ({ triggerSensory: vi.fn() }));
vi.mock("@/services/toast", () => ({ pushToast: vi.fn() }));
vi.mock("@/services/merchant-learning", () => ({ autoLearnExpenseCategory: vi.fn() }));

function makePlannedExpense(idx: number): ReconciliationPlan["newExpensesToCreate"][number] {
  return {
    item: {
      transaction: {
        id: `tx-${idx}`,
        index: idx,
        date: "2026-08-05",
        rawDescription: `Compra ${idx}`,
        cleanDescription: `Compra ${idx}`,
        merchantCleanRaw: `Compra ${idx}`,
        amountCents: 1000,
        statementHash: `hash-${idx}`,
        isRefund: false,
        isPayment: false,
        occurrenceIndex: 1,
      },
      status: "unmatched_new",
      score: 0,
      suggestedCategoryId: "cat-1",
      selectedCategoryId: "cat-1",
      selected: true,
    },
    date: "2026-08-05",
    valueCents: 1000,
    categoryId: "cat-1",
    description: `Compra ${idx}`,
    installmentsTotal: 1,
    installmentNumber: 1,
    installmentGroupId: null,
    billCompetence: "2026-08",
    statementHash: `hash-${idx}`,
    chargeKind: "regular" as const,
    scope: "personal" as const,
    isTaxDeductible: false,
  };
}

function makePlan(expenses: ReturnType<typeof makePlannedExpense>[]): ReconciliationPlan {
  return {
    cardId: "card-1",
    competenceMonth: "2026-08",
    blockedByRollover: false,
    paidBillLocksRestricted: false,
    newExpensesToCreate: expenses,
    futureInstallmentsToProject: [],
    refundsToRegister: [],
    microAdjustmentsToApply: [],
    manualLinkAdjustments: [],
    competenceMovesToApply: [],
    expenseIdsToDelete: [],
    totalActionCount: expenses.length,
    pendingOptInCount: 0,
  };
}

describe("useStatementCommit — T3.5 retomada após reload com plano reconstruído", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recupera recibo do servidor após perda de resposta e remonta o fluxo sem duplicar lotes", async () => {
    const sourceHashes = Array.from({ length: 505 }, (_, i) => `hash-${i}`);
    const fullExpenses = Array.from({ length: 505 }, (_, i) => makePlannedExpense(i));

    // 1ª tentativa: Chunk 0 grava no servidor, Chunk 1 falha por perda de conexão
    mockFetchReceipts.mockResolvedValueOnce([]);
    mockMutateAsync
      .mockResolvedValueOnce({
        success: true,
        inserted_count: 500,
        projected_count: 0,
        skipped_count: 0,
        adjusted_count: 0,
        moved_count: 0,
        refunds_count: 0,
        deleted_count: 0,
      })
      .mockRejectedValueOnce(new Error("Network lost"));

    const onSuccess1 = vi.fn();
    const { result: firstHook, unmount } = renderHook(() =>
      useStatementCommit({
        userId: "user-1",
        onError: vi.fn(),
        onSuccessCloseOrStep: onSuccess1,
      }),
    );

    await act(async () => {
      await firstHook.current.handleConfirmCommit({
        plan: makePlan(fullExpenses),
        categoriesCount: 1,
        isReadOnlyMode: false,
        hasUnconfirmedCardMismatch: false,
        openBalanceBeforeCents: 0,
        draftBlueprint: null,
        onConsumeDraftBlueprint: vi.fn(),
        sourceHashes,
      });
    });

    expect(onSuccess1).not.toHaveBeenCalled();
    const firstImportId = mockMutateAsync.mock.calls[0]?.[0]?.importId;
    const firstPlanHash = mockMutateAsync.mock.calls[0]?.[0]?.planHash;
    expect(firstImportId).toBeTruthy();

    // Simula reload completo (desmonta hook) e reconstrução do plano apenas com os 5 itens pendentes
    unmount();

    mockFetchReceipts.mockResolvedValueOnce([
      {
        chunk_index: 0,
        result: {
          success: true,
          inserted_count: 500,
          projected_count: 0,
          skipped_count: 0,
          adjusted_count: 0,
          moved_count: 0,
          refunds_count: 0,
          deleted_count: 0,
        },
      },
    ]);
    mockMutateAsync.mockResolvedValueOnce({
      success: true,
      inserted_count: 5,
      projected_count: 0,
      skipped_count: 0,
      adjusted_count: 0,
      moved_count: 0,
      refunds_count: 0,
      deleted_count: 0,
    });

    const onSuccess2 = vi.fn();
    const { result: reloadedHook } = renderHook(() =>
      useStatementCommit({
        userId: "user-1",
        onError: vi.fn(),
        onSuccessCloseOrStep: onSuccess2,
      }),
    );

    await act(async () => {
      await reloadedHook.current.handleConfirmCommit({
        plan: makePlan(fullExpenses.slice(500)),
        categoriesCount: 1,
        isReadOnlyMode: false,
        hasUnconfirmedCardMismatch: false,
        openBalanceBeforeCents: 0,
        draftBlueprint: null,
        onConsumeDraftBlueprint: vi.fn(),
        sourceHashes,
      });
    });

    // Mesmo importId & planHash após reload, mesmo com plano reconstruído menor
    expect(mockFetchReceipts).toHaveBeenLastCalledWith({
      importId: firstImportId,
      cardId: "card-1",
      competenceMonth: "2026-08",
      planHash: firstPlanHash,
    });
    expect(mockMutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({
        importId: firstImportId,
        chunkIndex: 1,
        planHash: firstPlanHash,
      }),
    );
    expect(onSuccess2).toHaveBeenCalledWith(
      expect.objectContaining({
        insertedCount: 505,
      }),
    );
  });
});
