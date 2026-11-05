import { useMemo } from "react";
import {
  DEFAULT_EMERGENCY_CONFIG,
  resolveEmergencyFundComposition,
  type EmergencyFundComposition,
  type PortfolioPositionRowLike,
} from "@/domain/projection";
import type { EmergencyFundConfig } from "@/types";
import { useUserPreferences } from "./use-user-preferences";
import { usePortfolioPosition } from "./use-portfolio-position";
import { useRealCashBalance } from "./use-real-cash-balance";
import { useUpdateCustomSettings } from "@/state/mutations/use-preference-mutations";

export interface UseEmergencyFundCompositionOptions {
  realCashCents?: number;
  monthlyExpensesCents?: number;
}

export interface UseEmergencyFundCompositionResult {
  composition: EmergencyFundComposition;
  config: EmergencyFundConfig;
  updateConfig: (patch: Partial<EmergencyFundConfig>) => Promise<void>;
  isLoading: boolean;
  isUpdating: boolean;
  portfolioRows: PortfolioPositionRowLike[];
}

/**
 * Hook unificado que orquestra a composição dinâmica da Reserva de Emergência.
 * Sincroniza em tempo real as configurações salvas na nuvem com o caixa real
 * e com a posição de custódia da carteira de investimentos.
 */
export function useEmergencyFundComposition(
  options: UseEmergencyFundCompositionOptions = {},
): UseEmergencyFundCompositionResult {
  const preferencesQuery = useUserPreferences();
  const position = usePortfolioPosition();
  const realCashQuery = useRealCashBalance();
  const updateSettingsMutation = useUpdateCustomSettings();

  const config: EmergencyFundConfig = useMemo(() => {
    const saved = preferencesQuery.data?.custom_settings?.emergencyFundConfig;
    return {
      ...DEFAULT_EMERGENCY_CONFIG,
      ...(saved ?? {}),
    };
  }, [preferencesQuery.data?.custom_settings?.emergencyFundConfig]);

  const effectiveRealCashCents =
    options.realCashCents ??
    Math.max(0, realCashQuery.cashBalance?.currentBalanceCents ?? 0);

  const portfolioRows: PortfolioPositionRowLike[] = useMemo(() => {
    return (position.rows ?? []).map((r) => ({
      assetId: r.assetId,
      ticker: r.ticker,
      assetClass: r.assetClass,
      quantity: r.quantity,
      valueBRL: r.valueBRL,
      netValueBRL: r.netValueBRL,
      isCash: r.isCash,
      isMatured: r.isMatured,
      maturityDate: r.maturityDate,
    }));
  }, [position.rows]);

  const composition = useMemo(() => {
    return resolveEmergencyFundComposition({
      config,
      realCashCents: effectiveRealCashCents,
      portfolioRows,
      monthlyExpensesCents: options.monthlyExpensesCents,
    });
  }, [config, effectiveRealCashCents, portfolioRows, options.monthlyExpensesCents]);

  const updateConfig = async (patch: Partial<EmergencyFundConfig>) => {
    const nextConfig: EmergencyFundConfig = {
      ...config,
      ...patch,
    };
    await updateSettingsMutation.mutateAsync({
      emergencyFundConfig: nextConfig,
    });
  };

  const isLoading =
    preferencesQuery.isLoading ||
    position.isLoading ||
    (options.realCashCents === undefined && realCashQuery.isLoading);

  return {
    composition,
    config,
    updateConfig,
    isLoading,
    isUpdating: updateSettingsMutation.isPending,
    portfolioRows,
  };
}
