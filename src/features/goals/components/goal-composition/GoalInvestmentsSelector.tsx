import { PieChart } from "lucide-react";
import { Button, Checkbox, MoneyText } from "@/components/ui";
import type { PortfolioAssetCompositionItem } from "@/domain/goals";
import type { GoalInvestmentSelectionMode } from "@/types/goals";
import { SelectableAssetRow } from "./SelectableAssetRow";

export interface GoalInvestmentsSelectorProps {
  includeInvestments: boolean;
  onIncludeInvestmentsChange: (val: boolean) => void;
  investmentMode: GoalInvestmentSelectionMode;
  onInvestmentModeChange: (mode: GoalInvestmentSelectionMode) => void;
  isPositionLoading: boolean;
  portfolioAssets: readonly PortfolioAssetCompositionItem[];
  selectedAssetIds: readonly string[];
  onToggleAsset: (id: string) => void;
  availableClasses: readonly string[];
  selectedClasses: readonly string[];
  onToggleClass: (cls: string) => void;
  totalPortfolioCents: number;
}

export function GoalInvestmentsSelector({
  includeInvestments,
  onIncludeInvestmentsChange,
  investmentMode,
  onInvestmentModeChange,
  isPositionLoading,
  portfolioAssets,
  selectedAssetIds,
  onToggleAsset,
  availableClasses,
  selectedClasses,
  onToggleClass,
  totalPortfolioCents,
}: GoalInvestmentsSelectorProps) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border/80 p-3 bg-surface">
      <div className="flex items-start gap-3">
        <Checkbox
          id="toggle-investments"
          checked={includeInvestments}
          onCheckedChange={(c) => onIncludeInvestmentsChange(Boolean(c))}
          className="mt-0.5"
        />
        <label htmlFor="toggle-investments" className="flex flex-col gap-0.5 cursor-pointer flex-1">
          <span className="font-medium text-foreground flex items-center gap-1.5">
            <PieChart className="size-3.5 text-portfolio" aria-hidden="true" />
            <span>Ativos da Carteira de Investimentos</span>
          </span>
          <span className="text-muted-foreground text-[11px]">
            Sincroniza o valor de mercado atualizado dos seus investimentos custodiados.
          </span>
        </label>
      </div>

      {includeInvestments && (
        <div className="ml-0 sm:ml-7 pt-2 flex flex-col gap-3 border-t border-border/60">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 w-full">
            <Button
              type="button"
              variant={investmentMode === "selected_assets" ? "default" : "outline"}
              size="sm"
              sensoryIntent="selection"
              className="justify-center"
              onClick={() => onInvestmentModeChange("selected_assets")}
            >
              Ativos Selecionados
            </Button>
            <Button
              type="button"
              variant={investmentMode === "selected_classes" ? "default" : "outline"}
              size="sm"
              sensoryIntent="selection"
              className="justify-center"
              onClick={() => onInvestmentModeChange("selected_classes")}
            >
              Por Classes
            </Button>
            <Button
              type="button"
              variant={investmentMode === "entire_portfolio" ? "default" : "outline"}
              size="sm"
              sensoryIntent="selection"
              className="justify-center"
              onClick={() => onInvestmentModeChange("entire_portfolio")}
            >
              Toda a Carteira
            </Button>
          </div>

          {investmentMode === "entire_portfolio" && (
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-surface-raised border border-border/60 text-xs">
              <span className="text-muted-foreground">Total da carteira em custódia:</span>
              <MoneyText cents={totalPortfolioCents} tone="portfolio" className="font-semibold" />
            </div>
          )}

          {investmentMode === "selected_assets" && (
            <div className="flex flex-col gap-1.5">
              {isPositionLoading ? (
                <p className="text-[11px] text-muted-foreground italic py-2">
                  Carregando investimentos da carteira...
                </p>
              ) : portfolioAssets.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic py-2">
                  Nenhum ativo com saldo positivo cadastrado na carteira.
                </p>
              ) : (
                portfolioAssets.map((asset) => (
                  <SelectableAssetRow
                    key={asset.id}
                    asset={asset}
                    checked={selectedAssetIds.includes(asset.id)}
                    onToggle={onToggleAsset}
                  />
                ))
              )}
            </div>
          )}

          {investmentMode === "selected_classes" && (
            <div className="flex flex-wrap gap-2">
              {availableClasses.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic py-2">
                  Nenhuma classe de ativo com saldo identificada.
                </p>
              ) : (
                availableClasses.map((cls) => (
                  <Button
                    key={cls}
                    type="button"
                    variant={selectedClasses.includes(cls) ? "default" : "outline"}
                    size="sm"
                    sensoryIntent="selection"
                    onClick={() => onToggleClass(cls)}
                  >
                    {cls}
                  </Button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
