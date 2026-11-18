import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import {
  isCashAssetClass,
  isFixedIncomeClass,
  isPrivateFixedIncomeTicker,
  isTesouroAsset,
} from "@/domain/portfolio";
import { useHighlightTarget } from "@/hooks/use-highlight-target";
import type { PortfolioAsset } from "@/types";

export interface UseResumoDeepLinksParams {
  assets: readonly PortfolioAsset[] | undefined;
  assetsLoading: boolean;
  rows: ReadonlyArray<{ assetId: string; source: string; priceBRL: number }>;
  onSyncQuotes: (assets: PortfolioAsset[]) => void;
  onOpenCashModal: () => void;
  onOpenCashProp?: () => void;
  onEditAsset: (asset: PortfolioAsset) => void;
}

export function useResumoDeepLinks({
  assets,
  assetsLoading,
  rows,
  onSyncQuotes,
  onOpenCashModal,
  onOpenCashProp,
  onEditAsset,
}: UseResumoDeepLinksParams) {
  const autoSyncedRef = useRef(false);
  const triggeredCashKeyRef = useRef<string | null>(null);
  const [searchParams] = useSearchParams();
  const { highlightId } = useHighlightTarget("q");
  const targetTicker = searchParams.get("ticker");

  const [detailAsset, setDetailAsset] = useState<PortfolioAsset | null>(null);
  const [dismissedHighlight, setDismissedHighlight] = useState(false);

  useEffect(() => {
    if (autoSyncedRef.current || assetsLoading || !assets) return;
    const assetsWithoutQuote = assets.filter((a) => {
      if (isCashAssetClass(a.asset_class)) return false;
      if (isFixedIncomeClass(a.asset_class) && !isTesouroAsset(a.ticker, a.asset_class)) return false;
      if (isPrivateFixedIncomeTicker(a.ticker)) return false;
      if (a.quantity <= 0) return false;
      const row = rows.find((r) => r.assetId === a.id);
      return !row || (row.source === "fallback" && row.priceBRL <= 0);
    });
    if (assetsWithoutQuote.length > 0) {
      autoSyncedRef.current = true;
      onSyncQuotes(assetsWithoutQuote);
    }
  }, [assets, assetsLoading, rows, onSyncQuotes]);

  const deepLinkedAsset = useMemo(() => {
    if (dismissedHighlight || (!highlightId && !targetTicker)) return null;
    return (
      (assets ?? []).find(
        (a) =>
          a.id === highlightId ||
          (targetTicker && a.ticker.toUpperCase() === targetTicker.toUpperCase()),
      ) ?? null
    );
  }, [dismissedHighlight, highlightId, targetTicker, assets]);

  const isDeepLinkedCash = Boolean(
    deepLinkedAsset &&
      (isCashAssetClass(deepLinkedAsset.asset_class) ||
        deepLinkedAsset.ticker.toUpperCase() === "CAIXA"),
  );

  // Propaga deep-link de Caixa para o modal controlado por InvestmentsPage quando onOpenCash existir
  useEffect(() => {
    const deepKey = `${highlightId ?? ""}:${targetTicker ?? ""}`;
    if (isDeepLinkedCash && onOpenCashProp && triggeredCashKeyRef.current !== deepKey) {
      triggeredCashKeyRef.current = deepKey;
      setDismissedHighlight(true);
      onOpenCashProp();
    }
  }, [isDeepLinkedCash, onOpenCashProp, highlightId, targetTicker]);

  const assetById = useCallback(
    (assetId: string): PortfolioAsset | undefined => (assets ?? []).find((a) => a.id === assetId),
    [assets],
  );

  const openDetail = useCallback(
    (assetId: string) => {
      const asset = assetById(assetId);
      if (!asset) return;
      if (isCashAssetClass(asset.asset_class) || asset.ticker.toUpperCase() === "CAIXA") {
        onOpenCashModal();
      } else {
        setDetailAsset(asset);
        setDismissedHighlight(false);
      }
    },
    [assetById, onOpenCashModal],
  );

  const openEdit = useCallback(
    (assetId: string) => {
      const asset = assetById(assetId);
      if (!asset) return;
      if (isCashAssetClass(asset.asset_class) || asset.ticker.toUpperCase() === "CAIXA") {
        onOpenCashModal();
      } else {
        onEditAsset(asset);
      }
    },
    [assetById, onOpenCashModal, onEditAsset],
  );

  return {
    highlightId,
    activeDetailAsset: detailAsset ?? (!isDeepLinkedCash ? deepLinkedAsset : null),
    isDeepLinkedCash,
    setDetailAsset,
    setDismissedHighlight,
    assetById,
    openDetail,
    openEdit,
  };
}
