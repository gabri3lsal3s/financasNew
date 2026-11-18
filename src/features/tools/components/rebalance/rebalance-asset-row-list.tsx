import { Plus, Trash2 } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { deriveAssetWeightsFromScores } from "@/domain/portfolio";
import { formatPercent } from "@/services/masks";

export interface SimClassAsset {
  id: string;
  ticker: string;
  score: number | null;
}

const SCORE_SELECT_OPTIONS = [
  { value: "null", label: "Sem nota (peso 5)" },
  ...Array.from({ length: 11 }, (_, idx) => {
    const scoreVal = 10 - idx;
    return { value: String(scoreVal), label: `Nota ${scoreVal}/10` };
  }),
];

export interface RebalanceAssetRowListProps {
  classKey: string;
  className: string;
  assets: readonly SimClassAsset[];
  onAddAsset: (classKey: string) => void;
  onUpdateAsset: (classKey: string, assetId: string, updates: Partial<SimClassAsset>) => void;
  onRemoveAsset: (classKey: string, assetId: string) => void;
}

export function RebalanceAssetRowList({
  classKey,
  className,
  assets,
  onAddAsset,
  onUpdateAsset,
  onRemoveAsset,
}: RebalanceAssetRowListProps) {
  const validWeights = deriveAssetWeightsFromScores(
    assets.map((a) => ({
      id: a.id,
      ticker: a.ticker.trim() || "Ativo",
      score: a.score,
      allocation_status: "active" as const,
    })),
  );
  const weightMap = new Map(validWeights.map((w) => [w.id, w.weightInSector]));

  return (
    <div className="pt-2.5 border-t border-border/60 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-muted-foreground">
          Ativos & Notas (0 a 10) dentro de {className}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => onAddAsset(classKey)}
          className="gap-1 text-[11px]"
        >
          <Plus className="size-3" aria-hidden="true" />
          <span>Adicionar ativo</span>
        </Button>
      </div>

      {assets.length > 0 ? (
        <div className="space-y-2">
          {assets.map((asset, aIdx) => {
            const wPct = (weightMap.get(asset.id) ?? 0) * 100;
            return (
              <div
                key={asset.id}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
              >
                <div className="sm:col-span-5">
                  <Input
                    value={asset.ticker}
                    onChange={(e) =>
                      onUpdateAsset(classKey, asset.id, {
                        ticker: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="Ex: PETR4"
                    className="text-base sm:text-sm font-mono"
                    aria-label={`Ticker do ativo ${aIdx + 1} de ${className}`}
                  />
                </div>
                <div className="sm:col-span-4">
                  <Select
                    value={asset.score === null ? "null" : String(asset.score)}
                    onValueChange={(val) =>
                      onUpdateAsset(classKey, asset.id, {
                        score: val === "null" ? null : Number(val),
                      })
                    }
                    options={SCORE_SELECT_OPTIONS}
                    ariaLabel={`Nota do ativo ${asset.ticker || aIdx + 1} de ${className}`}
                  />
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-2 sm:col-span-3">
                  <span className="font-mono text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {formatPercent(wPct)}%
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveAsset(classKey, asset.id)}
                    className="text-muted-foreground hover:text-critical-strong"
                    aria-label={`Remover ativo ${asset.ticker || aIdx + 1} de ${className}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Nenhum ativo listado nesta classe. Adicione ativos para dividir o aporte proporcionalmente
          por Nota.
        </p>
      )}
    </div>
  );
}
