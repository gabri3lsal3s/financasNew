import { isCashAssetClass } from "@/domain/portfolio/valuation";
import type { PortfolioPositionRowLike } from "@/domain/projection";
import type { EmergencyFundConfig } from "@/types";

export interface IsAssetInEmergencyConfigParams {
  config: EmergencyFundConfig;
  assetId?: string | null;
  assetClass?: string | null;
  isCash?: boolean;
}

/**
 * Verifica se um ativo específico compõe atualmente a Reserva de Emergência
 * de acordo com a política configurada pelo usuário.
 */
export function isAssetInEmergencyConfig({
  config,
  assetId,
  assetClass,
  isCash = false,
}: IsAssetInEmergencyConfigParams): boolean {
  switch (config.selectionMode) {
    case "auto_cash":
      return Boolean(isCash || isCashAssetClass(assetClass));
    case "selected_assets":
      return Boolean(assetId && (config.selectedAssetIds ?? []).includes(assetId));
    case "selected_classes": {
      const normalized = (assetClass ?? "").trim().toLowerCase();
      if (!normalized) return false;
      return (config.selectedClasses ?? []).some(
        (c) => c.trim().toLowerCase() === normalized,
      );
    }
    case "entire_portfolio":
      return true;
    default:
      return Boolean(isCash || isCashAssetClass(assetClass));
  }
}

export interface BuildEmergencyConfigToggleParams {
  config: EmergencyFundConfig;
  portfolioRows: readonly PortfolioPositionRowLike[];
  breakdownAssetIds: readonly string[];
  assetId: string;
  include: boolean;
}

/**
 * Atualiza de forma segura a configuração da Reserva de Emergência ao marcar ou desmarcar
 * um título de Renda Fixa nos fluxos de criação/edição, preservando todos os demais ativos.
 */
export function buildEmergencyConfigWithAssetToggle({
  config,
  portfolioRows,
  breakdownAssetIds,
  assetId,
  include,
}: BuildEmergencyConfigToggleParams): EmergencyFundConfig {
  const existingSelected = config.selectedAssetIds ?? [];

  if (include) {
    if (config.selectionMode === "entire_portfolio") {
      return config;
    }

    if (config.selectionMode === "selected_assets") {
      if (existingSelected.includes(assetId)) return config;
      return {
        ...config,
        selectedAssetIds: Array.from(new Set([...existingSelected, assetId])),
      };
    }

    if (config.selectionMode === "auto_cash") {
      const autoCashAssetIds = portfolioRows
        .filter((row) => row.isCash || isCashAssetClass(row.assetClass))
        .map((row) => row.assetId);
      return {
        ...config,
        selectionMode: "selected_assets",
        selectedAssetIds: Array.from(new Set([...autoCashAssetIds, assetId])),
      };
    }

    // selected_classes -> preserva todos os ativos atualmente cobertos + novo ativo
    return {
      ...config,
      selectionMode: "selected_assets",
      selectedAssetIds: Array.from(new Set([...breakdownAssetIds, assetId])),
    };
  }

  // include === false
  if (config.selectionMode === "auto_cash") {
    return config;
  }

  if (config.selectionMode === "selected_assets") {
    if (!existingSelected.includes(assetId)) return config;
    return {
      ...config,
      selectedAssetIds: existingSelected.filter((id) => id !== assetId),
    };
  }

  // selected_classes ou entire_portfolio -> converte para seleção explícita removendo apenas este ativo
  const baseAssetIds =
    breakdownAssetIds.length > 0
      ? breakdownAssetIds
      : portfolioRows.filter((row) => row.quantity > 0).map((row) => row.assetId);

  return {
    ...config,
    selectionMode: "selected_assets",
    selectedAssetIds: Array.from(new Set(baseAssetIds)).filter((id) => id !== assetId),
  };
}
