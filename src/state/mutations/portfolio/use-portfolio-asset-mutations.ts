import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createPortfolioAsset,
  deletePortfolioAsset,
  updatePortfolioAsset,
} from "@/data/repositories/portfolio";
import { setDividendTrackingAtomicRpc } from "@/data/rpc/portfolio";
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
import { userPreferencesKey } from "@/state/queries/use-user-preferences";
import type {
  DbInsert,
  DbUpdate,
  PortfolioAsset,
  SetDividendTrackingAssetItem,
  UserDividendEvent,
  UserPreferences,
} from "@/types";
import { invalidatePortfolioSuite, PORTFOLIO_QUERY_KEYS, triggerSurgicalQuoteSync } from "./portfolio-keys";

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

export interface UseSetDividendTrackingInput {
  trackingStartDate?: string | null;
  assets?: SetDividendTrackingAssetItem[];
  expectedTrackingStartDate?: string | null;
  silent?: boolean;
}

/**
 * Calibra cortes de proventos (piso global e/ou lotes individuais) via `set_dividend_tracking_atomic`.
 * Aplica os pisos gravados e eventos invalidados nos caches ativos antes do refetch.
 */
export function useSetDividendTracking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UseSetDividendTrackingInput) =>
      setDividendTrackingAtomicRpc({
        trackingStartDate: input.trackingStartDate ?? null,
        assets: input.assets ?? [],
        expectedTrackingStartDate: input.expectedTrackingStartDate ?? null,
      }),
    onSuccess: (result, variables) => {
      if (result.tracking_start_date !== undefined) {
        queryClient.setQueryData<UserPreferences | null>(userPreferencesKey, (prev) => {
          if (!prev) return prev;
          const prevCustom = prev.custom_settings ?? {};
          const prevDivAuto = prevCustom.dividendAutomation ?? {};
          return {
            ...prev,
            custom_settings: {
              ...prevCustom,
              dividendAutomation: {
                ...prevDivAuto,
                trackingStartDate: result.tracking_start_date,
              },
            },
          };
        });
      }

      if (result.updated_assets.length > 0) {
        const nextDatesByAssetId = new Map(
          result.updated_assets.map((item) => [item.asset_id, item.dividends_start_date]),
        );
        queryClient.setQueryData<PortfolioAsset[]>(PORTFOLIO_QUERY_KEYS.assets, (prev) => {
          if (!Array.isArray(prev)) return prev;
          return prev.map((asset) =>
            nextDatesByAssetId.has(asset.id)
              ? { ...asset, dividends_start_date: nextDatesByAssetId.get(asset.id) ?? null }
              : asset,
          );
        });
      }

      if (result.invalidated_event_ids.length > 0) {
        const invalidatedSet = new Set(result.invalidated_event_ids);
        queryClient.setQueryData<UserDividendEvent[]>(
          PORTFOLIO_QUERY_KEYS.userDividendEvents,
          (prev) => {
            if (!Array.isArray(prev)) return prev;
            return prev.map((ev) =>
              invalidatedSet.has(ev.id)
                ? {
                    ...ev,
                    quantity_on_com_date: 0,
                    gross_amount: 0,
                    net_amount: 0,
                    revision: (ev.revision ?? 1) + 1,
                  }
                : ev,
            );
          },
        );
      }

      void queryClient.invalidateQueries({ queryKey: userPreferencesKey });
      void invalidatePortfolioSuite(queryClient);

      if (!variables.silent) {
        const parts: string[] = [];
        if (result.updated_assets_count > 0) {
          parts.push(
            `${result.updated_assets_count} ${result.updated_assets_count === 1 ? "ativo calibrado" : "ativos calibrados"}`,
          );
        }
        if (result.affected_events_count > 0) {
          parts.push(
            `${result.affected_events_count} ${result.affected_events_count === 1 ? "pendência saneada" : "pendências saneadas"}`,
          );
        }
        if (result.protected_events_count > 0) {
          parts.push(
            `${result.protected_events_count} ${result.protected_events_count === 1 ? "edição anterior preservada" : "edições anteriores preservadas"}`,
          );
        }

        pushToast({
          title: "Acompanhamento de proventos atualizado",
          description:
            parts.length > 0
              ? parts.join(" · ")
              : "Data de corte salva e aplicada às projeções.",
          variant: "success",
        });
        triggerSensory("success");
      }
    },
    onError: (err, variables) => {
      if (!variables.silent) {
        pushToast({
          title: "Erro ao calibrar proventos",
          description: getErrorMessage(err),
          variant: "destructive",
        });
        triggerSensory("destructive");
      }
    },
  });
}
