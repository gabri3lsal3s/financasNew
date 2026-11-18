import { Badge, MoneyText } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import type { FixedIncomeRedemptionInfo } from "@/domain/portfolio";
import type { AssetCurrency, PortfolioAsset } from "@/types";

export interface StepOrderAssetBannerProps {
  ticker: string;
  assetClass: string;
  currency: AssetCurrency;
  isTotalValue: boolean;
  custodyQty: number;
  selectedAsset: PortfolioAsset | null;
  fiInfo: FixedIncomeRedemptionInfo | null;
}

export function StepOrderAssetBanner({
  ticker,
  assetClass,
  currency,
  isTotalValue,
  custodyQty,
  selectedAsset,
  fiInfo,
}: StepOrderAssetBannerProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-base font-bold text-foreground">{ticker}</span>
        <Badge variant="muted" size="xs">
          {assetClass}
        </Badge>
        {isTotalValue && (
          <Badge variant="muted" size="xs">
            Valor Completo
          </Badge>
        )}
        {fiInfo?.isMatured && (
          <Badge variant="critical" size="xs">
            Vencido
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {isTotalValue ? (
          <>
            <span>
              Saldo Aplicado:{" "}
              <MoneyText
                cents={numberToCents(fiInfo?.appliedCost ?? selectedAsset?.average_price ?? 0)}
                currency={currency}
                tone="default"
                variant="caption"
                className="font-medium text-foreground"
              />
            </span>
            {fiInfo && fiInfo.grossValue > fiInfo.appliedCost && (
              <>
                <span>
                  Saldo Bruto:{" "}
                  <MoneyText
                    cents={numberToCents(fiInfo.grossValue)}
                    currency={currency}
                    tone="positive"
                    variant="caption"
                    className="font-medium"
                  />
                </span>
                <span>
                  Líquido Estimado:{" "}
                  <MoneyText
                    cents={numberToCents(fiInfo.netValue)}
                    currency={currency}
                    tone="default"
                    variant="caption"
                    className="font-medium text-foreground"
                  />
                </span>
              </>
            )}
          </>
        ) : (
          <span>
            Posição Atual: {custodyQty} cotas · PM:{" "}
            <MoneyText
              cents={numberToCents(selectedAsset?.average_price ?? 0)}
              currency={currency}
              tone="default"
              variant="caption"
              className="inline text-foreground"
            />
          </span>
        )}
      </div>
    </div>
  );
}
