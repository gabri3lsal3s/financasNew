import * as stateHooks from "@/state";
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

const noopAsyncFalse = async () => false;
const noopVoid = () => undefined;
const noopAsyncUndefined = async () => undefined;

const DEFAULT_BUSINESS_MODE: SafeBusinessModeResult = {
  isBusinessModeEnabled: false,
  businessProfile: null,
  toggleBusinessMode: noopAsyncFalse,
  updateBusinessProfile: noopAsyncFalse,
  isLoading: false,
  isPending: false,
};

const DEFAULT_VIEW_SCOPE: SafeViewScopeResult = {
  viewScope: "all",
  effectiveViewScope: "all",
  setViewScope: noopVoid,
  isBusinessModeEnabled: false,
};

const EMPTY_INCOMES: Income[] = [];
const DEFAULT_INCOMES_RESULT: SafeIncomesResult = {
  data: EMPTY_INCOMES,
  isLoading: false,
  error: null,
  refetch: noopAsyncUndefined,
};

const DEFAULT_DELETE_PAIR_MUTATION = {
  mutateAsync: async () => ({
    transferPairId: "",
    deletedExpenseCount: 0,
    deletedIncomeCount: 0,
  }),
  isPending: false,
} as unknown as ReturnType<typeof stateHooks.useDeleteInternalTransferPair>;

function getOptionalStateHook<TArgs extends unknown[], TResult>(
  key: string,
  fallback: (...args: TArgs) => TResult,
): (...args: TArgs) => TResult {
  try {
    if (Reflect.ownKeys(stateHooks).includes(key)) {
      const candidate = (stateHooks as Record<string, unknown>)[key];
      if (typeof candidate === "function") {
        return candidate as (...args: TArgs) => TResult;
      }
    }
  } catch {
    // Em testes com mock parcial do barrel `@/state`, o Proxy ESM do Vitest v4 lança erro ao acessar chaves ausentes.
  }
  return fallback;
}

function useFallbackBusinessMode(): SafeBusinessModeResult {
  return DEFAULT_BUSINESS_MODE;
}

function useFallbackViewScope(): SafeViewScopeResult {
  return DEFAULT_VIEW_SCOPE;
}

function useFallbackIncomes(): SafeIncomesResult {
  return DEFAULT_INCOMES_RESULT;
}

function useFallbackDeleteInternalTransferPair() {
  return DEFAULT_DELETE_PAIR_MUTATION;
}

/**
 * Resolve `useBusinessMode` tolerando suites de teste legadas que mockam `@/state`
 * sem os hooks introduzidos no Modo Negócio.
 */
export function useSafeBusinessMode(): SafeBusinessModeResult {
  const useImpl = getOptionalStateHook("useBusinessMode", useFallbackBusinessMode);
  return useImpl();
}

/**
 * Resolve `useViewScope` tolerando suites legadas que mockam `@/state` parcialmente.
 */
export function useSafeViewScope(): SafeViewScopeResult {
  const useImpl = getOptionalStateHook("useViewScope", useFallbackViewScope);
  return useImpl();
}

/**
 * Resolve `useIncomes` tolerando mocks parciais de `@/state` (ex.: `cards-page.test.tsx`).
 */
export function useSafeIncomes(
  month: string,
  options?: { enabled?: boolean },
): SafeIncomesResult {
  const useImpl = getOptionalStateHook<
    [month: string, options?: { enabled?: boolean }],
    SafeIncomesResult
  >("useIncomes", useFallbackIncomes);
  return useImpl(month, options);
}

/**
 * Resolve `useDeleteInternalTransferPair` tolerando suites legadas com mock parcial de `@/state`.
 */
export function useSafeDeleteInternalTransferPair(): ReturnType<
  typeof stateHooks.useDeleteInternalTransferPair
> {
  const useImpl = getOptionalStateHook(
    "useDeleteInternalTransferPair",
    useFallbackDeleteInternalTransferPair,
  );
  return useImpl();
}
