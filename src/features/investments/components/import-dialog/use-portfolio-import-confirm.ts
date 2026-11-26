import { useRef, useState } from "react";
import { buildPortfolioImportPlan, type ParsedPortfolioImportRow } from "@/domain/portfolio/b3-csv-parser";
import { todayLocalIso } from "@/lib/date";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { useImportPortfolioAtomic } from "@/state";
import type { PortfolioAsset } from "@/types";

export function usePortfolioImportConfirm(params: {
  existingAssets: readonly PortfolioAsset[];
  existingTickerMap: ReadonlyMap<string, PortfolioAsset>;
  onSuccessClose: () => void;
}) {
  const { existingAssets, existingTickerMap, onSuccessClose } = params;
  const [isProcessing, setIsProcessing] = useState(false);
  const requestIdRef = useRef<string | null>(null);

  const importAtomic = useImportPortfolioAtomic();

  const confirmImport = async (selectedRows: readonly ParsedPortfolioImportRow[]) => {
    if (selectedRows.length === 0) return;

    if (!requestIdRef.current) {
      requestIdRef.current = crypto.randomUUID();
    }

    setIsProcessing(true);
    try {
      const plan = buildPortfolioImportPlan({
        existingAssets,
        selectedRows,
        fallbackDate: todayLocalIso(),
      });

      const txPayloads = plan.transactions.map((tx) => {
        const existing = existingTickerMap.get(tx.ticker);
        return {
          asset_id: existing?.id ?? null,
          ticker: tx.ticker,
          type: tx.type,
          date: tx.date,
          quantity: tx.quantity,
          price: tx.price,
          total: tx.total,
        };
      });

      await importAtomic.mutateAsync({
        requestId: requestIdRef.current,
        assetsToCreate: plan.assetsToCreate,
        assetsToUpdate: plan.assetsToUpdate,
        transactions: txPayloads,
      });

      requestIdRef.current = null;
      triggerSensory("success");
      pushToast({
        title: "Importação concluída com sucesso",
        description: `${selectedRows.length} ativos e posições atualizados na carteira.`,
        variant: "default",
      });
      onSuccessClose();
    } catch {
      triggerSensory("error");
      pushToast({
        title: "Erro ao importar carteira",
        description: "Nenhuma alteração parcial foi aplicada. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return { isProcessing, setIsProcessing, confirmImport };
}
