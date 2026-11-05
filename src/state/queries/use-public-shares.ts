import { useQuery } from "@tanstack/react-query";
import {
  getPublicShareByToken,
  getSharedFamilyBudgetByToken,
  getSharedGoalTrackerByToken,
  listMyPublicShares,
} from "@/data/repositories/public-shares";
import type {
  PublicShare,
  PublicShareKind,
  SharedFamilyBudgetResult,
  SharedGoalTrackerResult,
} from "@/types";
import { STALE_TIMES } from "@/state/cache-policy";

export const publicShareTokenQueryKey = (token: string) => ["public-share", token] as const;
export const myPublicSharesQueryKey = (kind?: PublicShareKind) => ["my-public-shares", kind ?? "all"] as const;
export const sharedFamilyBudgetQueryKey = (token: string, month?: string | null) =>
  ["shared-family-budget", token, month ?? "current"] as const;
export const sharedGoalTrackerQueryKey = (token: string) =>
  ["shared-goal-tracker", token] as const;

export function usePublicShare(token: string | undefined | null) {
  return useQuery<PublicShare | null>({
    queryKey: publicShareTokenQueryKey(token ?? ""),
    queryFn: () => (token ? getPublicShareByToken(token) : null),
    enabled: Boolean(token && token.trim().length > 0),
    staleTime: STALE_TIMES.transactional,
  });
}

export function useSharedFamilyBudget(token: string | undefined | null, month?: string | null) {
  return useQuery<SharedFamilyBudgetResult | null>({
    queryKey: sharedFamilyBudgetQueryKey(token ?? "", month),
    queryFn: () => (token ? getSharedFamilyBudgetByToken(token, month) : null),
    enabled: Boolean(token && token.trim().length > 0),
    staleTime: STALE_TIMES.transactional,
  });
}

export function useSharedGoalTracker(token: string | undefined | null) {
  return useQuery<SharedGoalTrackerResult | null>({
    queryKey: sharedGoalTrackerQueryKey(token ?? ""),
    queryFn: () => (token ? getSharedGoalTrackerByToken(token) : null),
    enabled: Boolean(token && token.trim().length > 0),
    staleTime: STALE_TIMES.transactional,
  });
}


export function useMyPublicShares(kind?: PublicShareKind) {
  return useQuery<PublicShare[]>({
    queryKey: myPublicSharesQueryKey(kind),
    queryFn: () => listMyPublicShares(kind),
    staleTime: STALE_TIMES.transactional,
  });
}

