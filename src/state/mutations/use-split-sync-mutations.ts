import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createLinkedReceivableDebt, deleteDebt, listDebts, updateDebt } from "@/data/repositories/debts";
import { updateExpense } from "@/data/repositories/expenses";
import {
  createPublicShare,
  deletePublicShare,
  findSplitShareByExpenseOrGroup,
  regeneratePublicShare,
  updatePublicSharePayload,
} from "@/data/repositories/public-shares";
import { todayISO } from "@/domain/debts";
import {
  applySplitSettlementTransition,
  normalizeSplitParticipants,
  recalculateSplitPayloadOnEdit,
  resolveSplitExpirationIso,
  sumExpectedFromFriendsCents,
  sumSettledFromFriendsCents,
  type RecalculateSplitOnEditResult,
  type SplitEditInput,
  type SplitSettlementAction,
  type SplitSettlementTransitionResult,
} from "@/domain/finance";
import type { PixKeyType } from "@/domain/pix";
import { AppError, getErrorMessage } from "@/services/errors";
import { cancelDueReminderNotification } from "@/services/native";
import {
  deleteAllSplitExpenses,
  resolveSplitTargetExpenses,
  syncExpenseFieldsFromSplit,
  syncSplitDebtStatus,
  syncSplitExpenseReportWeights,
} from "@/services/split-sync";
import { pushToast } from "@/services/toast";
import type { Debt, Expense, PublicShare, SplitSharePayload } from "@/types";
import { budgetsKey } from "../queries/use-budgets";
import { cardExpensesKey } from "../queries/use-card-payments";
import { debtsKey } from "../queries/use-debts";
import { expensesKey } from "../queries/use-expenses";
import {
  myPublicSharesMutationKey,
  publicShareQueryKey,
  publicSharesQueryKey,
} from "./use-public-share-mutations";

export const SPLIT_SYNC_INVALIDATION_KEYS = [
  myPublicSharesMutationKey,
  publicShareQueryKey,
  publicSharesQueryKey,
  expensesKey,
  cardExpensesKey,
  debtsKey,
  ["overview"] as const,
  ["insights"] as const,
  budgetsKey,
  ["reports"] as const,
] as const;

export async function invalidateSplitEcosystem(queryClient: QueryClient): Promise<void> {
  await Promise.all(
    SPLIT_SYNC_INVALIDATION_KEYS.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey: [...queryKey] }),
    ),
  );
}

export interface CreateLinkedSplitInput {
  token?: string;
  payload: SplitSharePayload;
  expenseId?: string | null;
  installmentGroupId?: string | null;
  linkedDebtId?: string | null;
  title: string;
  date: string;
  dueDate?: string | null;
  installmentsCount?: number | null;
  friendsExpectedCents: number;
}

export interface CreateLinkedSplitResult {
  share: PublicShare;
  debt: Debt | null;
}

/**
 * Cria um racha vinculado 1:1 a uma despesa (ou grupo de parcelas) e cria
 * automaticamente a conta a receber correspondente em Dívidas.
 */
export function useCreateLinkedSplit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateLinkedSplitInput): Promise<CreateLinkedSplitResult> => {
      const expenseId = input.expenseId ?? input.payload.expense_id ?? null;
      const installmentGroupId =
        input.installmentGroupId ?? input.payload.installment_group_id ?? null;

      if (expenseId || installmentGroupId) {
        const existing = await findSplitShareByExpenseOrGroup(expenseId, installmentGroupId);
        if (existing) {
          throw new AppError(
            "validation",
            'Esta despesa já possui um racha vinculado. Use "Gerenciar Racha" para editar ou cobrar.',
            null,
          );
        }
      }

      let debtId = input.linkedDebtId ?? input.payload.debt_id ?? null;
      let createdDebt: Debt | null = null;

      if (!debtId && (expenseId || installmentGroupId)) {
        const allDebts = await listDebts().catch(() => []);
        const existingDebt = allDebts.find(
          (d) =>
            d.type === "receivable" &&
            !d.paid_at &&
            ((expenseId && d.expense_id === expenseId) ||
              (installmentGroupId && d.installment_group_id === installmentGroupId)),
        );
        if (existingDebt) {
          debtId = existingDebt.id;
          createdDebt = existingDebt;
          const expectedTitle = `Racha: ${input.title.trim() || "Despesa"}`;
          const expectedAmount = Number((input.friendsExpectedCents / 100).toFixed(2));
          if (
            input.friendsExpectedCents > 0 &&
            (existingDebt.amount !== expectedAmount || existingDebt.name !== expectedTitle)
          ) {
            createdDebt = await updateDebt(existingDebt.id, {
              name: expectedTitle,
              amount: expectedAmount,
            }).catch(() => existingDebt);
          }
        }
      }

      if (!debtId && input.friendsExpectedCents > 0) {
        try {
          createdDebt = await createLinkedReceivableDebt({
            name: `Racha: ${input.title.trim() || "Despesa"}`,
            amount: Number((input.friendsExpectedCents / 100).toFixed(2)),
            due_date: input.dueDate || todayISO(),
            expense_id: expenseId,
            installment_group_id: installmentGroupId,
          });
          debtId = createdDebt.id;
        } catch (err) {
          console.warn("Não foi possível criar cobrança vinculada ao racha:", err);
        }
      }

      const expiresAt = resolveSplitExpirationIso(input.date, input.installmentsCount);
      const enrichedPayload: SplitSharePayload = {
        ...input.payload,
        expense_id: expenseId ?? undefined,
        installment_group_id: installmentGroupId ?? undefined,
        debt_id: debtId ?? undefined,
        due_date: input.dueDate ?? input.payload.due_date,
      };

      const share = await createPublicShare({
        kind: "split",
        token: input.token,
        payload: enrichedPayload as unknown as Record<string, unknown>,
        expiresAt,
        expenseId,
        installmentGroupId,
        debtId,
      });

      return { share, debt: createdDebt };
    },
    onSuccess: () => {
      void invalidateSplitEcosystem(queryClient);
    },
    onError: (error) => {
      pushToast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });
}

export interface ApplySplitSettlementInput {
  share: PublicShare;
  action: SplitSettlementAction;
  linkedDebt?: Debt | null;
  installmentsTotal?: number;
}

export interface ApplySplitSettlementResult {
  share: PublicShare;
  transition: SplitSettlementTransitionResult;
  debt: Debt | null;
}

/**
 * Executa qualquer transição de baixa/estorno/confirmação de sinal/finalização/reabertura,
 * sincronizando `public_shares`, `expenses.report_weight` e `debts` em uma cadeia atômica de app.
 */
export function useApplySplitSettlement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      share,
      action,
      linkedDebt,
      installmentsTotal,
    }: ApplySplitSettlementInput): Promise<ApplySplitSettlementResult> => {
      const payload = share.payload as unknown as SplitSharePayload;
      const transition = applySplitSettlementTransition(payload, action);
      const isPaused = Boolean(transition.nextPayload.public_page_paused);

      const updatedShare = await updatePublicSharePayload(
        share.id,
        transition.nextPayload as unknown as Record<string, unknown>,
        { isRevoked: transition.isCompleted || isPaused },
      );

      const expenseId = share.expense_id || transition.nextPayload.expense_id || "";
      const groupId = share.installment_group_id || transition.nextPayload.installment_group_id || null;
      const hostId = transition.nextPayload.participants.find((p) => p.is_host)?.id;

      if (expenseId) {
        await syncSplitExpenseReportWeights({
          expenseId,
          participants: transition.nextPayload.participants,
          installments: transition.nextPayload.participant_installments,
          installmentsMode: transition.nextPayload.installments_mode,
          hostId,
          totalCents: transition.nextPayload.total_cents,
          groupId,
        });
      }

      const isMultiInstallment = Boolean(
        (installmentsTotal && installmentsTotal > 1) ||
          (transition.nextPayload.installments_count ?? 1) > 1 ||
          groupId,
      );

      const debt = await syncSplitDebtStatus({
        linkedDebt,
        debtId: share.debt_id || transition.nextPayload.debt_id || null,
        expenseId: expenseId || null,
        groupId,
        title: transition.nextPayload.title,
        dueDate: transition.nextPayload.due_date ?? null,
        remainingReceivableCents: transition.remainingReceivableCents,
        hostNetCostCents: transition.hostNetCostCents,
        isCompleted: transition.isCompleted,
        isMultiInstallment,
        shouldCreateIfMissing: action.type === "reopen" && !transition.isCompleted,
      });

      return { share: updatedShare, transition, debt };
    },
    onSuccess: (result, variables) => {
      if (result.transition.isCompleted) {
        const debtId =
          result.debt?.id ||
          variables.linkedDebt?.id ||
          variables.share.debt_id ||
          result.transition.nextPayload.debt_id ||
          null;
        if (debtId) {
          void cancelDueReminderNotification(`debt:${debtId}`);
        }
      }
      void invalidateSplitEcosystem(queryClient);
    },
    onError: (error) => {
      pushToast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });
}

export interface UpdateSplitComprehensiveInput {
  share: PublicShare;
  edit: SplitEditInput;
  linkedDebt?: Debt | null;
  expiresAt?: string | null;
  regenerateToken?: boolean;
  syncExpense?: boolean;
  installmentsTotal?: number;
}

export interface UpdateSplitComprehensiveResult {
  share: PublicShare;
  result: RecalculateSplitOnEditResult;
  debt: Debt | null;
}

/**
 * Atualiza integralmente um racha (dados do rateio, participantes, valores, Pix,
 * privacidade/pausa, expiração/regeneração) sincronizando Despesa, report_weight e Dívida.
 */
export function useUpdateSplitComprehensive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      share,
      edit,
      linkedDebt,
      expiresAt,
      regenerateToken,
      syncExpense = true,
      installmentsTotal,
    }: UpdateSplitComprehensiveInput): Promise<UpdateSplitComprehensiveResult> => {
      const currentPayload = share.payload as unknown as SplitSharePayload;
      const result = recalculateSplitPayloadOnEdit(currentPayload, edit);
      const isPaused = Boolean(result.nextPayload.public_page_paused);

      const expenseId = share.expense_id || result.nextPayload.expense_id || "";
      const groupId = share.installment_group_id || result.nextPayload.installment_group_id || null;
      const hostId = result.nextPayload.participants.find((p) => p.is_host)?.id;

      if (syncExpense && expenseId) {
        await syncExpenseFieldsFromSplit({
          expenseId,
          groupId,
          description: result.nextPayload.title,
          totalCents: result.nextPayload.total_cents,
          date: result.nextPayload.date,
        });
      }

      if (expenseId) {
        await syncSplitExpenseReportWeights({
          expenseId,
          participants: result.nextPayload.participants,
          installments: result.nextPayload.participant_installments,
          installmentsMode: result.nextPayload.installments_mode,
          hostId,
          totalCents: result.nextPayload.total_cents,
          groupId,
        });
      }

      const isMultiInstallment = Boolean(
        (installmentsTotal && installmentsTotal > 1) ||
          (result.nextPayload.installments_count ?? 1) > 1 ||
          groupId,
      );

      const syncedDebt = await syncSplitDebtStatus({
        linkedDebt,
        debtId: share.debt_id || result.nextPayload.debt_id || null,
        expenseId: expenseId || null,
        groupId,
        title: result.nextPayload.title,
        dueDate: edit.dueDate ?? result.nextPayload.due_date ?? null,
        remainingReceivableCents: result.remainingReceivableCents,
        hostNetCostCents: result.hostNetCostCents,
        isCompleted: result.isCompleted,
        isMultiInstallment,
        shouldCreateIfMissing: !result.isCompleted,
      });

      const payloadWithLinks: SplitSharePayload = {
        ...result.nextPayload,
        debt_id: syncedDebt?.id ?? result.nextPayload.debt_id,
      };

      const nextExpiresAt =
        expiresAt !== undefined
          ? expiresAt
          : resolveSplitExpirationIso(
              edit.date,
              edit.installmentsCount ?? currentPayload.installments_count,
            );

      let updatedShare = regenerateToken
        ? await regeneratePublicShare(share.id, {
            kind: "split",
            payload: payloadWithLinks as unknown as Record<string, unknown>,
            expiresAt: nextExpiresAt,
          })
        : await updatePublicSharePayload(
            share.id,
            payloadWithLinks as unknown as Record<string, unknown>,
            {
              isRevoked: result.isCompleted || isPaused,
              ...(expiresAt !== undefined ? { expiresAt } : {}),
              ...(syncedDebt?.id && !share.debt_id ? { debtId: syncedDebt.id } : {}),
            },
          );

      if (regenerateToken && (result.isCompleted || isPaused || (syncedDebt?.id && !share.debt_id))) {
        updatedShare = await updatePublicSharePayload(
          updatedShare.id,
          payloadWithLinks as unknown as Record<string, unknown>,
          {
            isRevoked: result.isCompleted || isPaused,
            ...(syncedDebt?.id ? { debtId: syncedDebt.id } : {}),
          },
        );
      }

      return { share: updatedShare, result, debt: syncedDebt };
    },
    onSuccess: () => {
      void invalidateSplitEcosystem(queryClient);
    },
    onError: (error) => {
      pushToast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });
}

export interface SyncSplitFromExpenseEditInput {
  share: PublicShare;
  expense: Expense;
  nextTitle?: string | null;
  nextTotalCents: number;
  nextDate: string;
  linkedDebt?: Debt | null;
}

/**
 * Propaga edição feita na tela de Detalhes/Edição da Despesa para o racha vinculado,
 * recalculando cotas, BR Code, report_weight e cobrança em Dívidas sem sobrescrever a despesa em loop.
 */
export function useSyncSplitFromExpenseEdit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      share,
      expense,
      nextTitle,
      nextTotalCents,
      nextDate,
      linkedDebt,
    }: SyncSplitFromExpenseEditInput) => {
      const currentPayload = share.payload as unknown as SplitSharePayload;
      const participants = normalizeSplitParticipants(currentPayload);
      const edit: SplitEditInput = {
        title: (nextTitle ?? "").trim() || currentPayload.title || "Racha de Despesa",
        totalCents: nextTotalCents,
        date: nextDate || currentPayload.date,
        splitMode: currentPayload.split_mode ?? "equal",
        remainderPolicy: currentPayload.remainder_policy ?? "host",
        scaleCustomProportionally: true,
        participants: participants.map((p) => ({
          id: p.id,
          name: p.name,
          isHost: Boolean(p.is_host),
          fixedCents: p.share_cents,
        })),
        installmentsCount:
          expense.installments_total > 1
            ? expense.installments_total
            : currentPayload.installments_count,
        installmentsMode: currentPayload.installments_mode,
        pixKey: currentPayload.pix_key ?? "",
        pixKeyType: (currentPayload.pix_key_type as PixKeyType) ?? "cpf",
        hostName:
          currentPayload.host_name ??
          participants.find((p) => p.is_host)?.name ??
          "Anfitrião",
        hostCity: currentPayload.host_city ?? "Brasil",
        customNote: currentPayload.custom_note,
        showParticipantsList: currentPayload.show_participants_list,
        publicPagePaused: currentPayload.public_page_paused,
        dueDate: currentPayload.due_date,
        categoryId: expense.category_id,
      };

      const result = recalculateSplitPayloadOnEdit(currentPayload, edit);
      const isPaused = Boolean(result.nextPayload.public_page_paused);

      const updatedShare = await updatePublicSharePayload(
        share.id,
        result.nextPayload as unknown as Record<string, unknown>,
        { isRevoked: result.isCompleted || isPaused },
      );

      const expenseId = share.expense_id || result.nextPayload.expense_id || expense.id;
      const groupId =
        share.installment_group_id ||
        result.nextPayload.installment_group_id ||
        expense.installment_group_id ||
        null;
      const hostId = result.nextPayload.participants.find((p) => p.is_host)?.id;

      await syncSplitExpenseReportWeights({
        expenseId,
        participants: result.nextPayload.participants,
        installments: result.nextPayload.participant_installments,
        installmentsMode: result.nextPayload.installments_mode,
        hostId,
        totalCents: result.nextPayload.total_cents,
        groupId,
      });

      const isMultiInstallment = Boolean(
        expense.installments_total > 1 ||
          (result.nextPayload.installments_count ?? 1) > 1 ||
          groupId,
      );

      await syncSplitDebtStatus({
        linkedDebt,
        debtId: share.debt_id || result.nextPayload.debt_id || null,
        expenseId,
        groupId,
        title: result.nextPayload.title,
        dueDate: result.nextPayload.due_date ?? null,
        remainingReceivableCents: result.remainingReceivableCents,
        hostNetCostCents: result.hostNetCostCents,
        isCompleted: result.isCompleted,
        isMultiInstallment,
        shouldCreateIfMissing: !result.isCompleted,
      });

      return { share: updatedShare, result };
    },
    onSuccess: () => {
      void invalidateSplitEcosystem(queryClient);
    },
  });
}

export interface SyncSplitFromDebtSettleInput {
  share: PublicShare;
  debt: Debt;
  settledAmountCents: number;
}

/**
 * Mantém o racha e todas as parcelas de despesa sincronizados quando o usuário quita
 * a conta a receber vinculada diretamente na aba Dívidas (`SettleDialog`).
 */
export function useSyncSplitFromDebtSettle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ share, debt, settledAmountCents }: SyncSplitFromDebtSettleInput) => {
      const payload = share.payload as unknown as SplitSharePayload;
      const participants = normalizeSplitParticipants(payload);
      const settledBefore = sumSettledFromFriendsCents(participants);
      const expectedFriends = sumExpectedFromFriendsCents(participants);
      const remainingReceivable = Math.max(0, expectedFriends - settledBefore);

      let transition: SplitSettlementTransitionResult;
      if (settledAmountCents >= remainingReceivable) {
        transition = applySplitSettlementTransition(payload, { type: "settle_all" });
      } else {
        const unpaidGuests = participants.filter((p) => !p.is_host && !p.is_settled);
        if (unpaidGuests.length === 1 && unpaidGuests[0]?.id && settledAmountCents > 0) {
          const guest = unpaidGuests[0];
          const partial = applySplitSettlementTransition(payload, {
            type: "settle_custom_participant",
            participantId: guest.id!,
            settledCents: Number(guest.settled_cents ?? 0) + settledAmountCents,
          });
          transition = applySplitSettlementTransition(partial.nextPayload, {
            type: "finalize_as_is",
          });
        } else {
          transition = applySplitSettlementTransition(payload, { type: "finalize_as_is" });
        }
      }

      const updatedShare = await updatePublicSharePayload(
        share.id,
        transition.nextPayload as unknown as Record<string, unknown>,
        { isRevoked: true },
      );

      const expenseId =
        share.expense_id || transition.nextPayload.expense_id || debt.expense_id || "";
      const groupId =
        share.installment_group_id ||
        transition.nextPayload.installment_group_id ||
        debt.installment_group_id ||
        null;
      const hostId = transition.nextPayload.participants.find((p) => p.is_host)?.id;

      if (expenseId) {
        await syncSplitExpenseReportWeights({
          expenseId,
          participants: transition.nextPayload.participants,
          installments: transition.nextPayload.participant_installments,
          installmentsMode: transition.nextPayload.installments_mode,
          hostId,
          totalCents: transition.nextPayload.total_cents,
          groupId,
        });
      }

      return { share: updatedShare, transition };
    },
    onSuccess: (_result, variables) => {
      if (variables.debt.id) {
        void cancelDueReminderNotification(`debt:${variables.debt.id}`);
      }
      void invalidateSplitEcosystem(queryClient);
    },
  });
}

export interface DeleteLinkedSplitInput {
  share: PublicShare;
  linkedDebt?: Debt | null;
  deleteExpense: boolean;
}

/**
 * Exclui o racha e opcionalmente exclui a despesa vinculada ou restaura seu `report_weight` para 1.0,
 * limpando também cobranças vinculadas em aberto.
 */
export function useDeleteLinkedSplit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ share, linkedDebt, deleteExpense }: DeleteLinkedSplitInput) => {
      const payload = share.payload as unknown as SplitSharePayload;
      const expenseId = share.expense_id || payload.expense_id || "";
      const groupId = share.installment_group_id || payload.installment_group_id || null;
      const debtId = share.debt_id || payload.debt_id || linkedDebt?.id || null;

      await deletePublicShare(share.id);

      if (deleteExpense) {
        if (expenseId) {
          await deleteAllSplitExpenses({ expenseId, groupId });
        }
        if (debtId) {
          await deleteDebt(debtId).catch(() => {});
        }
        return { deletedExpense: true, debtId };
      }

      if (expenseId) {
        const { targetExpenses } = await resolveSplitTargetExpenses(expenseId, groupId);
        for (const exp of targetExpenses) {
          if (exp.report_weight !== 1) {
            await updateExpense(exp.id, { report_weight: 1 });
          }
        }
      }

      if (debtId && !linkedDebt?.paid_at) {
        await deleteDebt(debtId).catch(() => {});
      }

      return { deletedExpense: false, debtId };
    },
    onSuccess: (result, variables) => {
      const payload = variables.share.payload as unknown as SplitSharePayload;
      const debtId =
        result.debtId ||
        variables.linkedDebt?.id ||
        variables.share.debt_id ||
        payload.debt_id ||
        null;
      if (debtId) {
        void cancelDueReminderNotification(`debt:${debtId}`);
      }
      void invalidateSplitEcosystem(queryClient);
    },
    onError: (error) => {
      pushToast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });
}
