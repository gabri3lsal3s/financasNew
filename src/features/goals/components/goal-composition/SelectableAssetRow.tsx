import { useId } from "react";
import { Checkbox, MoneyText } from "@/components/ui";
import type { PortfolioAssetCompositionItem } from "@/domain/goals";

export interface SelectableAssetRowProps {
  asset: PortfolioAssetCompositionItem;
  checked: boolean;
  onToggle: (assetId: string) => void;
}

/**
 * Linha selecionável de ativo para composição de meta.
 * Usa `<Checkbox id>` + `<label htmlFor>` irmãos (sem `onClick` no contêiner)
 * para evitar o bug de duplo toggle ao clicar diretamente no checkbox.
 */
export function SelectableAssetRow({ asset, checked, onToggle }: SelectableAssetRowProps) {
  const checkboxId = useId();

  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-surface hover:bg-surface-hover border border-border/60 transition-colors">
      <Checkbox
        id={checkboxId}
        checked={checked}
        onCheckedChange={() => onToggle(asset.id)}
      />
      <label
        htmlFor={checkboxId}
        className="flex flex-1 items-center justify-between gap-2 min-w-0 cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-foreground truncate">{asset.ticker}</span>
          {asset.assetClass ? (
            <span className="text-muted-foreground text-[11px] truncate">{asset.assetClass}</span>
          ) : null}
        </div>
        <MoneyText
          cents={asset.valueCents}
          tone="default"
          className="text-xs font-semibold shrink-0"
        />
      </label>
    </div>
  );
}
