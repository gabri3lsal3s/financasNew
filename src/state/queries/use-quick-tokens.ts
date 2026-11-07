import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createUserQuickTokenRpc,
  listUserQuickTokensRpc,
  revokeUserQuickTokenRpc,
} from "@/data/rpc";
import type { QuickToken } from "@/types";

export const QUICK_TOKENS_QUERY_KEY = ["quick-tokens"] as const;

export function useQuickTokens() {
  return useQuery<QuickToken[]>({
    queryKey: QUICK_TOKENS_QUERY_KEY,
    queryFn: async () => {
      return listUserQuickTokensRpc();
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

export function useCreateQuickToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      tokenHash,
      tokenPrefix,
      scopes,
    }: {
      name: string;
      tokenHash: string;
      tokenPrefix: string;
      scopes?: string[];
    }) => {
      return createUserQuickTokenRpc(name, tokenHash, tokenPrefix, scopes);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUICK_TOKENS_QUERY_KEY });
    },
  });
}

export function useRevokeQuickToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tokenId: string) => {
      return revokeUserQuickTokenRpc(tokenId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUICK_TOKENS_QUERY_KEY });
    },
  });
}
