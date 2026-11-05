import { useQuery } from "@tanstack/react-query";
import {
  getPublicShareByToken,
  listMyPublicShares,
} from "@/data/repositories/public-shares";
import type { PublicShare, PublicShareKind } from "@/types";
import { STALE_TIMES } from "@/state/cache-policy";

export const publicShareTokenQueryKey = (token: string) => ["public-share", token] as const;
export const myPublicSharesQueryKey = (kind?: PublicShareKind) => ["my-public-shares", kind ?? "all"] as const;

export function usePublicShare(token: string | undefined | null) {
  return useQuery<PublicShare | null>({
    queryKey: publicShareTokenQueryKey(token ?? ""),
    queryFn: () => (token ? getPublicShareByToken(token) : null),
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
