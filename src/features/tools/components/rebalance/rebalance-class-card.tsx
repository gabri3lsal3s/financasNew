import { useId } from "react";
import { Trash2 } from "lucide-react";
import { Button, FormField, Input, PercentInput } from "@/components/ui";
import type { StrategyClassItem } from "@/domain/portfolio";
import { RebalanceAssetRowList, type SimClassAsset } from "./rebalance-asset-row-list";

export type SimClassItem = StrategyClassItem & {
  assets: SimClassAsset[];
};

export interface RebalanceClassCardProps {
  cls: SimClassItem;
  index: number;
  onUpdateClass: (key: string, updates: Partial<SimClassItem>) => void;
  onRemoveClass: (key: string) => void;
  onAddAsset: (classKey: string) => void;
  onUpdateAsset: (classKey: string, assetId: string, updates: Partial<SimClassAsset>) => void;
  onRemoveAsset: (classKey: string, assetId: string) => void;
}

export function RebalanceClassCard({
  cls,
  index,
  onUpdateClass,
  onRemoveClass,
  onAddAsset,
  onUpdateAsset,
  onRemoveAsset,
}: RebalanceClassCardProps) {
  const baseId = useId();
  const currentId = `${baseId}-current`;
  const targetId = `${baseId}-target`;
  const yieldId = `${baseId}-yield`;

  return (
    <div className="p-3.5 rounded-xl border border-border/80 bg-surface-raised/50 space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 max-w-xs min-w-0">
          <Input
            value={cls.name}
            onChange={(e) => onUpdateClass(cls.key, { name: e.target.value })}
            className="text-base sm:text-sm font-semibold"
            aria-label={`Nome da classe ${index + 1}`}
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemoveClass(cls.key)}
          className="text-muted-foreground hover:text-critical-strong"
          aria-label={`Remover classe ${cls.name}`}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormField
          label={`Proporção Atual (${Math.round(cls.currentProportion * 100)}%)`}
          htmlFor={currentId}
        >
          <PercentInput
            id={currentId}
            value={Math.round(cls.currentProportion * 10000) / 100}
            onValueChange={(val) => onUpdateClass(cls.key, { currentProportion: val / 100 })}
            size="md"
            aria-label={`Proporção atual de ${cls.name}`}
          />
        </FormField>

        <FormField label="Meta Desejada (%)" htmlFor={targetId}>
          <PercentInput
            id={targetId}
            value={cls.targetPercent}
            onValueChange={(val) => onUpdateClass(cls.key, { targetPercent: val })}
            size="md"
            aria-label={`Meta percentual de ${cls.name}`}
          />
        </FormField>

        <FormField label="Dividend Yield Est. (% a.a.)" htmlFor={yieldId}>
          <PercentInput
            id={yieldId}
            value={Math.round(cls.yieldRate * 10000) / 100}
            onValueChange={(val) => onUpdateClass(cls.key, { yieldRate: val / 100 })}
            size="md"
            aria-label={`Yield anual de ${cls.name}`}
          />
        </FormField>
      </div>

      <RebalanceAssetRowList
        classKey={cls.key}
        className={cls.name}
        assets={cls.assets}
        onAddAsset={onAddAsset}
        onUpdateAsset={onUpdateAsset}
        onRemoveAsset={onRemoveAsset}
      />
    </div>
  );
}
