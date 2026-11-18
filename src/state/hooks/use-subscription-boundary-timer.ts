import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { USER_ACCESS_KEY, USER_SUBSCRIPTION_KEY } from "../queries/use-user-access";

interface SubscriptionBoundaryParams {
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  enabled?: boolean;
}

const MAX_TIMEOUT_MS = 2147483647; // 2^31 - 1 (teto máximo de 32 bits para setTimeout no JS)
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Hook de fronteira temporal de assinatura (Fase 4 - Transições Reativas sem F5).
 * Agenda um timer para a virada exata de expiração de trial ou vigência Pro,
 * invalidando as queries do TanStack Query no segundo exato do encerramento.
 * Também monitora o retorno de foco na aba (`visibilitychange`).
 */
export function useSubscriptionBoundaryTimer({
  trialEndsAt,
  currentPeriodEnd,
  enabled = true,
}: SubscriptionBoundaryParams): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const now = Date.now();
    const boundaries: number[] = [];

    if (trialEndsAt) {
      const trialMs = new Date(trialEndsAt).getTime();
      if (!isNaN(trialMs) && trialMs > now) {
        boundaries.push(trialMs);
      }
    }

    if (currentPeriodEnd) {
      const periodMs = new Date(currentPeriodEnd).getTime();
      if (!isNaN(periodMs) && periodMs > now) {
        boundaries.push(periodMs);
      }
    }

    if (boundaries.length === 0) return;

    // Próxima fronteira temporal a ser atingida
    const nextBoundaryMs = Math.min(...boundaries);
    const delayMs = nextBoundaryMs - now + 1000; // +1s de margem de segurança pós-virada

    // Se o vencimento estiver dentro das próximas 24h, agenda virada instantânea
    if (delayMs > 0 && delayMs <= TWENTY_FOUR_HOURS_MS) {
      const safeDelay = Math.min(delayMs, MAX_TIMEOUT_MS);
      const timerId = window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: USER_SUBSCRIPTION_KEY });
        void queryClient.invalidateQueries({ queryKey: USER_ACCESS_KEY });
      }, safeDelay);

      return () => {
        window.clearTimeout(timerId);
      };
    }
  }, [trialEndsAt, currentPeriodEnd, enabled, queryClient]);

  // Revalidação em retorno de visibilidade (ex: usuário pagou em outra aba/app e voltou ao Axir)
  useEffect(() => {
    if (!enabled) return;

    let lastCheck = Date.now();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const elapsed = Date.now() - lastCheck;
        if (elapsed > 15_000) {
          // Mais de 15 segundos em background
          lastCheck = Date.now();
          void queryClient.invalidateQueries({ queryKey: USER_SUBSCRIPTION_KEY });
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, queryClient]);
}
