import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createPortfolioAsset,
  deletePortfolioAsset,
  updatePortfolioAsset,
} from "@/data/repositories/portfolio";
import {
  isCashAssetClass,
  isCustomValuationAsset,
  isFixedIncomeClass,
  isPrivateFixedIncomeTicker,
  isTesouroAsset,
  normalizeTesouroTicker,
} from "@/domain/portfolio";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { DbInsert, DbUpdate, PortfolioAsset } from "@/types";
import { invalidatePortfolioSuite, triggerSurgicalQuoteSync } from "./portfolio-keys";

export function useCreatePortfolioAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<DbInsert<PortfolioAsset>, "user_id">) => {
      const created = await createPortfolioAsset(input);
      void triggerSurgicalQuoteSync(queryClient, {
        assets: [created],
        reason: "cache_miss",
        includeUsdFx: created.currency === "USD",
      });
      return created;
    },
    onSuccess: () => {
      void invalidatePortfolioSuite(queryClient);
      pushToast({
        title: "Ativo criado",
        description: "O novo ativo foi adicionado à sua carteira.",
        variant: "success",
      });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao criar ativo",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

function isMarketQuotedPortfolioAsset(asset: PortfolioAsset): boolean {
  const clean = (asset.ticker ?? "").trim().toUpperCase();
  if (!clean || clean === "CAIXA" || clean === "CASH" || clean.startsWith("CAIXA_") || clean.startsWith("CASH_")) {
    return false;
  }
  if ((Number(asset.quantity) || 0) <= 0) return false;
  if (isCashAssetClass(asset.asset_class ?? null)) return false;
  if (isFixedIncomeClass(asset.asset_class ?? null)) return false;
  if (isPrivateFixedIncomeTicker(clean) || isCustomValuationAsset(asset)) return false;
  if (isTesouroAsset(clean, asset.asset_class) || Boolean(normalizeTesouroTicker(clean))) return false;
  return true;
}

export function useUpdatePortfolioAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: DbUpdate<PortfolioAsset> }) =>
      updatePortfolioAsset(id, patch),
    onSuccess: (updated) => {
      void invalidatePortfolioSuite(queryClient);
      if (updated && isMarketQuotedPortfolioAsset(updated)) {
        void triggerSurgicalQuoteSync(queryClient, {
          assets: [updated],
          reason: "cache_miss",
          includeUsdFx: updated.currency === "USD",
        });
      }
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao atualizar ativo",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}

export function useDeletePortfolioAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assetId: string) => deletePortfolioAsset(assetId),
    onSuccess: () => {
      void invalidatePortfolioSuite(queryClient);
      pushToast({
        title: "Ativo excluído",
        description: "O ativo e todo o seu histórico foram removidos da carteira.",
        variant: "info",
      });
      triggerSensory("destructive");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao excluir ativo",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}
