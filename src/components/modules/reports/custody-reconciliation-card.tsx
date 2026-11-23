import { Globe, Scale } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import {
  computeProjectedPatrimonyWithProvisioned,
  type CustodyReconciliationSummary,
  type ProvisionedDividendsSummary,
} from "@/domain/portfolio";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/services/masks/percent";

export interface CustodyReconciliationCardProps {
  summary: CustodyReconciliationSummary;
  provisionedSummary?: ProvisionedDividendsSummary | null;
  variant?: "ui" | "report";
  className?: string;
}

function formatFxRatePtBr(rate: number): string {
  return rate.toFixed(4).replace(".", ",");
}

/**
 * Quadro Contábil de Conciliação por Custódia Geográfica (Brasil BRL vs. Exterior USD).
 * Reutilizado na aba Investimentos (`variant="ui"`) e nos relatórios A4/PDF (`variant="report"`).
 */
export function CustodyReconciliationCard({
  summary,
  provisionedSummary = null,
  variant = "ui",
  className,
}: CustodyReconciliationCardProps) {
  const isReport = variant === "report";
  const fxFormatted = `R$ ${formatFxRatePtBr(summary.fxRateUsed)}`;
  const hasProvisioned = Boolean(provisionedSummary && provisionedSummary.totalCount > 0);
  const projectedModel = hasProvisioned
    ? computeProjectedPatrimonyWithProvisioned(summary.closingPatrimonyCents, provisionedSummary)
    : null;

  return (
    <section
      aria-label="Conciliação por Custódia Brasil e Exterior"
      className={cn(
        isReport
          ? "rounded-xl border border-border/80 bg-surface p-3 break-inside-avoid print:break-inside-avoid"
          : "rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs min-w-0",
        className,
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2.5 border-b border-border/80">
        <div className="flex items-center gap-2 min-w-0">
          <Scale className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <div className="flex flex-col min-w-0">
            <h3
              className={cn(
                "font-semibold text-foreground leading-tight",
                isReport ? "text-xs uppercase tracking-wider font-bold" : "text-sm",
              )}
            >
              Conciliação por Custódia (Brasil vs. Exterior)
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {summary.hasForeignCustody
                ? `ETFs/BDRs listados na B3 permanecem em BRL. Câmbio de referência: ${fxFormatted} (${summary.fxSourceLabel}).`
                : "100% da custódia alocada em ativos locais denominados em Real (BRL)."}
            </span>
          </div>
        </div>

        <span className="text-[11px] font-mono text-muted-foreground shrink-0">
          {summary.custodyBrazilAssetsCount + summary.custodyForeignAssetsCount}{" "}
          {summary.custodyBrazilAssetsCount + summary.custodyForeignAssetsCount === 1
            ? "posição conciliada"
            : "posições conciliadas"}
        </span>
      </div>

      <div
        className={cn(
          "grid gap-3 pt-3",
          isReport
            ? "grid-cols-1 sm:grid-cols-3 print:grid-cols-3"
            : summary.hasForeignCustody
              ? "grid-cols-1 sm:grid-cols-3"
              : "grid-cols-1 sm:grid-cols-2",
        )}
      >
        {/* Bloco 1: Custódia Brasil (BRL) */}
        <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-muted/20 p-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-muted-foreground">
              Custódia Brasil (BRL)
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              {formatPercent(summary.custodyBrazilPct)}%
            </span>
          </div>
          <MoneyText
            cents={summary.custodyBrazilCents}
            tone="default"
            className="text-base font-bold text-foreground whitespace-nowrap"
          />
          <span className="text-[10.5px] text-muted-foreground">
            {summary.custodyBrazilAssetsCount}{" "}
            {summary.custodyBrazilAssetsCount === 1 ? "item em BRL" : "itens em BRL"} (inclui BDRs/ETFs B3 e Caixa)
          </span>
        </div>

        {/* Bloco 2: Custódia Exterior (USD) */}
        {summary.hasForeignCustody || isReport ? (
          <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-muted/20 p-3 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                <Globe className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
                Custódia Exterior (USD)
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {formatPercent(summary.custodyForeignPct)}%
              </span>
            </div>

            {summary.hasForeignCustody ? (
              <>
                <MoneyText
                  cents={summary.custodyForeignUSDCents}
                  currency="USD"
                  tone="portfolio"
                  className="text-base font-bold whitespace-nowrap"
                />
                <div className="flex flex-wrap items-center gap-1 text-[10.5px] text-muted-foreground">
                  <span>Equivalente:</span>
                  <MoneyText
                    cents={summary.custodyForeignBRLCents}
                    variant="caption"
                    tone="default"
                    className="font-mono font-semibold text-foreground"
                  />
                  <span>({summary.custodyForeignAssetsCount} USD)</span>
                </div>
              </>
            ) : (
              <>
                <span className="num text-base font-semibold text-muted-foreground whitespace-nowrap">
                  US$ 0,00
                </span>
                <span className="text-[10.5px] text-muted-foreground">
                  Sem posições custodiadas diretamente em USD
                </span>
              </>
            )}
          </div>
        ) : null}

        {/* Bloco 3: Patrimônio Total no Fechamento (Soma Exata Brasil BRL + Exterior BRL) */}
        <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-muted/35 p-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-foreground">
              Patrimônio no Fechamento
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">100,0%</span>
          </div>
          <MoneyText
            cents={summary.closingPatrimonyCents}
            tone="portfolio"
            className="text-base font-bold whitespace-nowrap"
          />
          <span className="text-[10.5px] text-muted-foreground">
            Brasil (BRL) + Exterior (BRL)
            {summary.roundingAdjustmentCents !== 0 ? " (ajuste de centavos conciliado)" : ""}
          </span>
        </div>
      </div>

      {hasProvisioned && provisionedSummary && projectedModel ? (
        <div
          aria-label="Proventos provisionados fora do fechamento"
          className="mt-3 pt-3 border-t border-dashed border-border/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5"
        >
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-xs font-semibold text-foreground">
              Proventos Provisionados — A Receber
            </span>
            <span className="text-[10.5px] text-muted-foreground leading-relaxed">
              {`${provisionedSummary.totalCount} ${
                provisionedSummary.totalCount === 1 ? "evento" : "eventos"
              } (${provisionedSummary.pendingCount} a confirmar, ${
                provisionedSummary.provisionedCount
              } provisionados). Fora do Patrimônio no Fechamento e do Caixa.`}
            </span>
          </div>

          <div className="flex flex-col sm:items-end gap-1 shrink-0">
            <MoneyText
              cents={provisionedSummary.totalReceivableBRLCents}
              tone="portfolio"
              className="text-sm font-bold whitespace-nowrap"
            />
            <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted-foreground">
              <span>Total Projetado c/ Provisionados:</span>
              <MoneyText
                cents={projectedModel.projectedPatrimonyCents}
                variant="caption"
                tone="default"
                className="font-semibold text-foreground whitespace-nowrap"
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
