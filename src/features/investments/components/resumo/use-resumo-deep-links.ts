import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { isCashAssetClass } from "@/domain/portfolio";
import { useHighlightTarget } from "@/hooks/use-highlight-target";
import type { PortfolioAsset } from "@/types";

export interface UseResumoDeepLinksParams {
  assets: readonly PortfolioAsset[] | undefined;
  onOpenCashModal: () => void;
  onOpenCashProp?: () => void;
  onEditAsset: (asset: PortfolioAsset) => void;
}

export function useResumoDeepLinks({
  assets,
  onOpenCashModal,
  onOpenCashProp,
  onEditAsset,
}: UseResumoDeepLinksParams) {
  const triggeredCashKeyRef = useRef<string | null>(null);
  const [searchParams] = useSearchParams();
  const { highlightId } = useHighlightTarget("q");
  const targetTicker = searchParams.get("ticker");

  const [detailAsset, setDetailAsset] = useState<PortfolioAsset | null>(null);
  const [dismissedHighlight, setDismissedHighlight] = useState(false);

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
