import { useEffect, useRef, useSyncExternalStore } from "react";
import { useAuth } from "./use-auth";
import { useSaveSplitExpense, useSignalSplitPayment } from "@/state";
import { isAppLocked, subscribeAppLock } from "@/services/native/app-lock";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";

export const PENDING_SPLIT_STORAGE_KEY = "axis_pending_split_expense";

export interface PendingSplitExpenseData {
  token: string;
  title: string;
  amountCents: number;
  date: string;
  participantId?: string;
  participantName?: string;
  categoryId?: string;
  categoryName?: string;
  categoryIcon?: string;
}

/**
 * Hook para processar despesas compartilhadas pendentes de auto-onboarding ou login tardio.
 * Aguarda a sessão ativa do usuário E o desbloqueio biométrico (caso o app esteja protegido).
 * Salva a despesa, sinaliza o pagamento Pix ao anfitrião e emite feedback sensorial e toast.
 */
export function usePendingSplitExpense() {
  const { session } = useAuth();
  const saveSplitMutation = useSaveSplitExpense();
  const signalSplitPaymentMutation = useSignalSplitPayment();
  const isLocked = useSyncExternalStore(subscribeAppLock, isAppLocked);
  const processingRef = useRef(false);

  useEffect(() => {
    // Só processa se houver usuário autenticado, app não bloqueado por biometria e não estiver em processamento
    if (!session?.user || isLocked || processingRef.current) return;

    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(PENDING_SPLIT_STORAGE_KEY) : null;
      if (!raw) return;

      const data = JSON.parse(raw) as Partial<PendingSplitExpenseData>;
      if (data && typeof data.amountCents === "number" && data.amountCents > 0) {
        processingRef.current = true;
        localStorage.removeItem(PENDING_SPLIT_STORAGE_KEY);

        const runSave = async () => {
          try {
            await saveSplitMutation.mutateAsync({
              title: data.title || "Racha de Despesa",
              amountCents: data.amountCents!,
              date: data.date,
              categoryId: data.categoryId,
            });

            if (data.token) {
              try {
                const participantName =
                  data.participantName ||
                  session.user.user_metadata?.name ||
                  session.user.user_metadata?.full_name ||
                  session.user.email?.split("@")[0] ||
                  "Amigo";

                await signalSplitPaymentMutation.mutateAsync({
                  token: data.token,
                  participantId: data.participantId,
                  participantName,
                  amountCents: data.amountCents!,
                });
              } catch (signalErr) {
                console.warn("Nao foi possivel sinalizar o pagamento:", signalErr);
              }
            }

            triggerSensory("success");
            pushToast({
              title: "Despesa salva com sucesso!",
              description: `A sua cota de ${(data.amountCents! / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} foi adicionada ao seu extrato.`,
              variant: "default",
            });
          } catch (err) {
            console.error("Falha ao salvar racha pendente:", err);
            triggerSensory("destructive");
          } finally {
            processingRef.current = false;
          }
        };

        void runSave();
      }
    } catch {
      localStorage.removeItem(PENDING_SPLIT_STORAGE_KEY);
      processingRef.current = false;
    }
  }, [session, isLocked, saveSplitMutation, signalSplitPaymentMutation]);
}
