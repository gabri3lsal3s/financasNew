import { useEffect, useRef } from "react";
import { useAuth } from "./use-auth";
import { useSaveSplitExpense } from "@/state";

export const PENDING_SPLIT_STORAGE_KEY = "axis_pending_split_expense";

export interface PendingSplitExpenseData {
  token: string;
  title: string;
  amountCents: number;
  date: string;
}

/**
 * Hook para processar despesas compartilhadas pendentes de auto-onboarding.
 * Executa automaticamente quando o usuário confirma e ativa sua sessão.
 */
export function usePendingSplitExpense() {
  const { session } = useAuth();
  const saveSplitMutation = useSaveSplitExpense();
  const processedRef = useRef(false);

  useEffect(() => {
    if (!session?.user || processedRef.current) return;

    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(PENDING_SPLIT_STORAGE_KEY) : null;
      if (!raw) return;

      const data = JSON.parse(raw) as Partial<PendingSplitExpenseData>;
      if (data && typeof data.amountCents === "number" && data.amountCents > 0) {
        processedRef.current = true;
        localStorage.removeItem(PENDING_SPLIT_STORAGE_KEY);

        void saveSplitMutation.mutateAsync({
          title: data.title || "Racha de Despesa",
          amountCents: data.amountCents,
          date: data.date,
        });
      }
    } catch {
      localStorage.removeItem(PENDING_SPLIT_STORAGE_KEY);
    }
  }, [session, saveSplitMutation]);
}
