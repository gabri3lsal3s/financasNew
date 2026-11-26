import {
  useBusinessMode,
  useDeleteInternalTransferPair,
  useIncomes,
  useViewScope,
} from "@/state";
import type { BusinessProfileSettings, Income, ViewScope } from "@/types";

export interface SafeBusinessModeResult {
  isBusinessModeEnabled: boolean;
  businessProfile: BusinessProfileSettings | null | undefined;
  toggleBusinessMode: (enabled: boolean) => Promise<void | boolean>;
  updateBusinessProfile: (patch: BusinessProfileSettings) => Promise<void | boolean>;
  isLoading: boolean;
  isPending: boolean;
}

export interface SafeViewScopeResult {
  viewScope: ViewScope;
  effectiveViewScope: ViewScope;
  setViewScope: (scope: ViewScope) => void;
  isBusinessModeEnabled: boolean;
}

export interface SafeIncomesResult {
  data: Income[] | undefined;
  isLoading: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
}

/**
 * Resolve `useBusinessMode` via import nomeado direto do barrel `@/state`.
 */
export function useSafeBusinessMode(): SafeBusinessModeResult {
  return useBusinessMode();
}

/**
 * Resolve `useViewScope` via import nomeado direto do barrel `@/state`.
 */
export function useSafeViewScope(): SafeViewScopeResult {
  return useViewScope();
}

/**
 * Resolve `useIncomes` via import nomeado direto do barrel `@/state`.
 */
export function useSafeIncomes(
  month: string,
  options?: { enabled?: boolean },
): SafeIncomesResult {
  return useIncomes(month, options);
}

/**
 * Resolve `useDeleteInternalTransferPair` via import nomeado direto do barrel `@/state`.
 */
export function useSafeDeleteInternalTransferPair(): ReturnType<
  typeof useDeleteInternalTransferPair
> {
  return useDeleteInternalTransferPair();
}
