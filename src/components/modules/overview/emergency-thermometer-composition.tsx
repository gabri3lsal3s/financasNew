import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import type { EmergencyFundComposition } from "@/domain/projection";

export interface EmergencyThermometerCompositionProps {
  composition: EmergencyFundComposition;
  showDetails: boolean;
  onOpenConfig?: () => void;
}

/**
 * Origem detalhada das contas e ativos na reserva de emergência e alertas de liquidez.
 */
export function EmergencyThermometerComposition({
  composition,
  showDetails,
  onOpenConfig,
}: EmergencyThermometerCompositionProps) {
  const totalReserve = Math.max(1, composition.totalReserveCents);

  return (
    <>
      {showDetails && composition.breakdown.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border/80 bg-muted/15 p-3 min-w-0 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">
              Composição da Reserva ({composition.breakdown.length} fontes):
            </span>
            <span className="text-[11px] text-muted-foreground">
              {composition.cashInAccountsCents > 0 ? (
                <span>Contas: {Math.round((composition.cashInAccountsCents / totalReserve) * 100)}% · </span>
              ) : null}
              Investimentos: {Math.round((composition.portfolioReserveCents / totalReserve) * 100)}%
            </span>
          </div>

          <div className="flex flex-col gap-1.5 pt-1">
            {composition.breakdown.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 p-2 rounded-md bg-surface border border-border/80 text-xs min-w-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-foreground truncate">{item.label}</span>
                  {item.assetClass ? (
                    <Badge variant="muted" size="xs">
                      {item.assetClass}
                    </Badge>
                  ) : null}
                  {item.isCashEquivalent ? (
                    <Badge variant="positive" size="xs">
                      Liquidez
                    </Badge>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <MoneyText
                    cents={item.selectedCents}
                    tone="default"
                    className="font-semibold tabular-nums"
                  />
                  <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
                    {item.pctOfTotal}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {composition.warnings.length > 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning-strong">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="flex-1 truncate">{composition.warnings[0]?.message}</span>
          {onOpenConfig ? (
            <button
              type="button"
              onClick={onOpenConfig}
              className="relative text-[11px] font-medium underline shrink-0 hover:opacity-80 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded max-sm:after:absolute max-sm:after:-inset-2"
            >
              Ajustar
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
