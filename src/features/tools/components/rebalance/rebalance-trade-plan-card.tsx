import { Badge, Card, CardContent, CardHeader, CardTitle, MoneyText } from "@/components/ui";
import { AllocationDonut, type AllocationSlice } from "@/components/modules/allocation-donut";
import { deriveAssetWeightsFromScores, type StrategyClassAllocationResult } from "@/domain/portfolio";
import { formatCentsAsBRL } from "@/services/masks";
import type { SimClassItem } from "./rebalance-class-card";

export interface RebalanceTradePlanCardProps {
  donutSlices: AllocationSlice[];
  newTotalPatrimonyBRL: number;
  allocations: readonly StrategyClassAllocationResult[];
  classes: readonly SimClassItem[];
}

export function RebalanceTradePlanCard({
  donutSlices,
  newTotalPatrimonyBRL,
  allocations,
  classes,
}: RebalanceTradePlanCardProps) {
  const centerLabel = formatCentsAsBRL(Math.round(newTotalPatrimonyBRL * 100), {
    hideCents: true,
  });

  return (
    <Card className="border-border/80 bg-surface shadow-xs">
      <CardHeader className="border-b border-border/80 pb-3">
        <CardTitle className="text-base font-bold">Alocação Pós-Aporte</CardTitle>
        <p className="text-xs text-muted-foreground">
          Projeção da carteira após a injeção do novo aporte.
        </p>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="flex justify-center py-2">
          <AllocationDonut slices={donutSlices} donutSize="md" centerValue={centerLabel} />
        </div>

        <div className="space-y-2 pt-2 border-t border-border/70">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Recomendação de Compra do Próximo Aporte
          </h4>
          <div className="space-y-2">
            {allocations.map((alloc) => {
              const matchedClass = classes.find((c) => c.key === alloc.key);
              const weightedAssets =
                matchedClass && matchedClass.assets.length > 0 && alloc.allocatedAmount > 0
                  ? deriveAssetWeightsFromScores(
                      matchedClass.assets.map((a) => ({
                        id: a.id,
                        ticker: a.ticker.trim() || "Ativo",
                        score: a.score,
                        allocation_status: "active" as const,
                      })),
                    )
                  : [];

              return (
                <div
                  key={alloc.key}
                  className="p-2.5 rounded-lg border border-border/80 bg-surface-raised/50 text-xs space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{alloc.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Atual: {alloc.currentPct}% · Alvo: {alloc.targetPercent}%
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {alloc.allocatedAmount > 0 ? (
                        <>
                          <MoneyText
                            cents={Math.round(alloc.allocatedAmount * 100)}
                            tone="positive"
                            className="font-bold"
                          />
                          <p className="text-[11px] text-positive-strong font-medium">Aportar aqui</p>
                        </>
                      ) : (
                        <Badge variant="muted" size="xs">
                          Sem aporte
                        </Badge>
                      )}
                    </div>
                  </div>

                  {weightedAssets.length > 0 ? (
                    <div className="pt-2 border-t border-border/50 space-y-1">
                      {weightedAssets.map((wa) => {
                        const assetAmountBRL = alloc.allocatedAmount * wa.weightInSector;
                        return (
                          <div
                            key={wa.id}
                            className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-mono font-semibold text-foreground">
                                {wa.ticker}
                              </span>
                              <Badge variant={wa.rawScore === null ? "warning" : "muted"} size="xs">
                                {wa.rawScore === null ? "Sem nota" : `Nota ${wa.rawScore}`}
                              </Badge>
                            </div>
                            <MoneyText
                              cents={Math.round(assetAmountBRL * 100)}
                              tone="default"
                              className="font-medium text-foreground"
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
