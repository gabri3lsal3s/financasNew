import { useState } from "react";
import { buildPortfolioImportPlan, type ParsedPortfolioImportRow } from "@/domain/portfolio/b3-csv-parser";
import { todayLocalIso } from "@/lib/date";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  useCreatePortfolioAsset,
  useCreatePortfolioTransactionsBatch,
  useUpdatePortfolioAsset,
} from "@/state";
import type { PortfolioAsset } from "@/types";

export function usePortfolioImportConfirm(params: {
  existingAssets: readonly PortfolioAsset[];
  existingTickerMap: ReadonlyMap<string, PortfolioAsset>;
  onSuccessClose: () => void;
}) {
  const { existingAssets, existingTickerMap, onSuccessClose } = params;
  const [isProcessing, setIsProcessing] = useState(false);

  const createAsset = useCreatePortfolioAsset();
  const updateAsset = useUpdatePortfolioAsset();
  const createTransactionsBatch = useCreatePortfolioTransactionsBatch();

  const confirmImport = async (selectedRows: readonly ParsedPortfolioImportRow[]) => {
    if (selectedRows.length === 0) return;

    setIsProcessing(true);
    try {
      const plan = buildPortfolioImportPlan({
        existingAssets,
        selectedRows,
        fallbackDate: todayLocalIso(),
      });

      const assetMap = new Map(existingTickerMap);
      for (const item of plan.assetsToCreate) {
        const created = await createAsset.mutateAsync(item);
        assetMap.set(item.ticker, created);
      }
      for (const upd of plan.assetsToUpdate) {
        await updateAsset.mutateAsync(upd);
      }

      const txPayloads = plan.transactions
        .map((tx) => {
          const asset = assetMap.get(tx.ticker);
          if (!asset) return null;
          return {
            asset_id: asset.id,
            type: tx.type,
            date: tx.date,
            quantity: tx.quantity,
            price: tx.price,
            total: tx.total,
          };
        })
        .filter((tx): tx is NonNullable<typeof tx> => tx !== null);

      if (txPayloads.length > 0) {
        await createTransactionsBatch.mutateAsync(txPayloads);
      }

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
        description: "Ocorreu uma falha ao salvar as operações. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return { isProcessing, setIsProcessing, confirmImport };
}
