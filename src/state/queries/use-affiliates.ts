import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  attributeReferralRpc,
  getAffiliateDashboardDataRpc,
  getOrCreateAffiliatePartnerRpc,
  updateAffiliatePixRpc,
} from "@/data/rpc";
import type { AffiliateDashboardData } from "@/types";

export const AFFILIATE_DASHBOARD_QUERY_KEY = ["affiliate-dashboard"] as const;

export function useAffiliateDashboard() {
  return useQuery<AffiliateDashboardData | null>({
    queryKey: AFFILIATE_DASHBOARD_QUERY_KEY,
    queryFn: async () => {
      return getAffiliateDashboardDataRpc();
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

export function useGetOrCreateAffiliatePartner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pixKey,
      pixKeyType,
    }: {
      pixKey?: string | null;
      pixKeyType?: string | null;
    } = {}) => {
      return getOrCreateAffiliatePartnerRpc(pixKey, pixKeyType);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AFFILIATE_DASHBOARD_QUERY_KEY });
    },
  });
}

export function useUpdateAffiliatePix() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pixKey,
      pixKeyType,
    }: {
      pixKey: string;
      pixKeyType: string;
    }) => {
      return updateAffiliatePixRpc(pixKey, pixKeyType);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AFFILIATE_DASHBOARD_QUERY_KEY });
    },
  });
}

export function useAttributeReferral() {
  return useMutation({
    mutationFn: async (referralCode: string) => {
      return attributeReferralRpc(referralCode);
    },
  });
}
