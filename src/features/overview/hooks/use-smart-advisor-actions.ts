import { useCallback } from "react";
import { DEFAULT_DISMISS_DAYS } from "@/domain/insights/advisor";
import type { QualifiedDismissReason } from "@/domain/insights/feedback";
import { normalizeText } from "@/domain/insights/shared";
import {
  buildAdvisorConfirmExpenseInput,
  buildAdvisorConfirmIncomeInput,
  resolveIgnoreRecurrenceToast,
} from "@/domain/insights/smart-advisor-rules";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  useCreateExpense,
  useCreateIncome,
  useDeleteExpense,
  useDeleteIncome,
  useSetFeedback,
} from "@/state";

export interface SmartAdvisorActionSensoryOptions {
  skipSensory?: boolean;
}

interface UseSmartAdvisorActionsParams {
  todayISOStr: string;
  activeThemeKey?: string;
  dismiss: (themeKey?: string, days?: number) => void;
}

/**
 * Encapsula as ações assíncronas do SmartAdvisor (calibração de recorrências,
 * marcação essencial e registro rápido de rendas/despesas com opção de desfazer).
 */
export function useSmartAdvisorActions({
  todayISOStr,
  activeThemeKey,
  dismiss,
}: UseSmartAdvisorActionsParams) {
  const setFeedbackMutation = useSetFeedback();
  const createIncomeMutation = useCreateIncome();
  const deleteIncomeMutation = useDeleteIncome();
  const createExpenseMutation = useCreateExpense();
  const deleteExpenseMutation = useDeleteExpense();

  const confirmRecurrence = useCallback(
    async (occurrenceKey: string) => {
      await setFeedbackMutation.mutateAsync({ occurrenceKey, decision: "confirm" });
      triggerSensory("success");
      pushToast({
        title: "Recorrência confirmada",
        description: "O motor agora monitora esse gasto como fixo.",
      });
    },
    [setFeedbackMutation],
  );

  const ignoreRecurrence = useCallback(
    async (
      occurrenceKey: string,
      reason: QualifiedDismissReason | "ignore" = "ignore",
      options?: SmartAdvisorActionSensoryOptions,
    ) => {
      await setFeedbackMutation.mutateAsync({ occurrenceKey, decision: reason });
      const spec = resolveIgnoreRecurrenceToast(reason);
      if (!options?.skipSensory) {
        triggerSensory(spec.sensory);
      }
      pushToast({
        title: spec.title,
        description: spec.description,
        ...(reason === "ignore" ? {} : { variant: spec.variant }),
      });
    },
    [setFeedbackMutation],
  );

  const markAsEssential = useCallback(
    async (
      occurrenceKey: string,
      displayName?: string,
      options?: SmartAdvisorActionSensoryOptions,
    ) => {
      await setFeedbackMutation.mutateAsync({ occurrenceKey, decision: "essential" });
      if (!options?.skipSensory) {
        triggerSensory("action");
      }
      const name = displayName ?? "Esta despesa";
      pushToast({
        title: "Marcado como essencial",
        description: `${name} foi classificado como essencial e não será sugerido para corte.`,
        duration: 5000,
        variant: "success",
        action: {
          label: "Desfazer",
          onClick: () => {
            void setFeedbackMutation.mutateAsync({ occurrenceKey, decision: null });
            triggerSensory("action");
            pushToast({
              title: "Decisão desfeita",
              description: `${name} voltou ao monitoramento regular de sugestões.`,
              variant: "info",
            });
          },
        },
      });
    },
    [setFeedbackMutation],
  );

  const confirmIncome = useCallback(
    async (payload: { name: string; valueCents: number; categoryId: string; date?: string }) => {
      const created = await createIncomeMutation.mutateAsync(
        buildAdvisorConfirmIncomeInput(payload, todayISOStr),
      );
      const keyToDismiss = activeThemeKey ?? `income:${normalizeText(payload.name)}`;
      dismiss(keyToDismiss, DEFAULT_DISMISS_DAYS);
      triggerSensory("success");
      pushToast({
        title: "Entrada confirmada",
        description: `Renda de ${payload.name} registrada com sucesso.`,
        action: {
          label: "Desfazer",
          onClick: () => {
            if (created?.id) {
              void deleteIncomeMutation.mutateAsync(created.id);
              triggerSensory("action");
              pushToast({
                title: "Entrada desfeita",
                description: `Renda de ${payload.name} foi removida.`,
              });
            }
          },
        },
      });
    },
    [createIncomeMutation, deleteIncomeMutation, todayISOStr, activeThemeKey, dismiss],
  );

  const confirmExpense = useCallback(
    async (payload: {
      name: string;
      valueCents: number;
      categoryId: string;
      date?: string;
      forma?: string;
      cardId?: string;
    }) => {
      const createdId = await createExpenseMutation.mutateAsync(
        buildAdvisorConfirmExpenseInput(payload, todayISOStr),
      );
      const keyToDismiss = activeThemeKey ?? `missing_expense:${normalizeText(payload.name)}`;
      dismiss(keyToDismiss, DEFAULT_DISMISS_DAYS);
      triggerSensory("success");
      pushToast({
        title: "Pagamento confirmado",
        description: `Despesa de ${payload.name} registrada com sucesso.`,
        duration: 5000,
        variant: "success",
        action: {
          label: "Desfazer",
          onClick: () => {
            if (createdId) {
              void deleteExpenseMutation.mutateAsync({ expenseId: createdId, mode: "single" });
              triggerSensory("action");
              pushToast({
                title: "Pagamento desfeito",
                description: `Despesa de ${payload.name} foi removida.`,
                variant: "info",
              });
            }
          },
        },
      });
    },
    [createExpenseMutation, deleteExpenseMutation, todayISOStr, activeThemeKey, dismiss],
  );

  return {
    confirmRecurrence,
    ignoreRecurrence,
    markAsEssential,
    confirmIncome,
    confirmExpense,
  };
}
