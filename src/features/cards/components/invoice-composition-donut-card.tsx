import { useMemo, type ReactNode } from "react";
import { Calculator, Percent, Plus } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { ReportDonutChart, type ReportDonutSegment } from "@/components/modules/reports/report-donut-chart";
import { summarizeInvoiceCharges } from "@/domain/cards/charges";
import { formatPercent } from "@/services/masks/percent";
import type { Expense } from "@/types";

export interface InvoiceCompositionDonutCardProps {
  cardName?: string;
  competenceMonth: string;
  expenses: readonly Expense[];
  onOpenChargeDialog?: () => void;
  onOpenCalculationMemory?: () => void;
  calculationMemoryAction?: ReactNode;
}

/**
 * Card de Composição da Fatura & Donut de Custo do Dinheiro (Fase 1 do Blueprint v2.1):
 * Exibe a proporção de Consumo Real vs. Juros, Multa, IOF e Tarifas Bancárias
 * com proteção total contra divisão por zero e atalho para a Memória de Cálculo.
 */
export function InvoiceCompositionDonutCard({
  expenses,
  onOpenChargeDialog,
  onOpenCalculationMemory,
  calculationMemoryAction,
}: InvoiceCompositionDonutCardProps) {
  const summary = useMemo(() => summarizeInvoiceCharges(expenses), [expenses]);

  const segments = useMemo<ReportDonutSegment[]>(() => {
    if (summary.totalInvoiceCents === 0) return [];

    const result: ReportDonutSegment[] = [];

    if (summary.consumptionCents > 0) {
      result.push({
        key: "consumption",
        label: "Consumo",
        value: summary.consumptionCents,
        pct: (summary.consumptionCents / summary.totalInvoiceCents) * 100,
        color: "var(--color-primary, #0d9488)",
      });
    }

    if (summary.interestCents > 0) {
      result.push({
        key: "interest",
        label: "Juros",
        value: summary.interestCents,
        pct: (summary.interestCents / summary.totalInvoiceCents) * 100,
        color: "var(--color-critical, #e11d48)",
      });
    }

    if (summary.fineCents > 0) {
      result.push({
        key: "fine",
        label: "Multa",
        value: summary.fineCents,
        pct: (summary.fineCents / summary.totalInvoiceCents) * 100,
        color: "var(--color-warning, #f59e0b)",
      });
    }

    if (summary.taxCents > 0) {
      result.push({
        key: "tax",
        label: "IOF",
        value: summary.taxCents,
        pct: (summary.taxCents / summary.totalInvoiceCents) * 100,
        color: "var(--color-accent, #6366f1)",
      });
    }

    if (summary.bankFeeCents > 0) {
      result.push({
        key: "bank_fee",
        label: "Tarifas",
        value: summary.bankFeeCents,
        pct: (summary.bankFeeCents / summary.totalInvoiceCents) * 100,
        color: "var(--color-muted, #64748b)",
      });
    }

    return result;
  }, [summary]);

  if (summary.totalInvoiceCents === 0) {
    return null;
  }

  return (
    <div
      data-testid="invoice-composition-donut-card"
      className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs flex flex-col gap-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Percent className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">Composição de Custo da Fatura</h2>
          {summary.hasCharges ? (
            <Badge size="xs" variant="warning">
              {formatPercent(summary.chargesPercentage, 1)} encargos
            </Badge>
          ) : (
            <Badge size="xs" variant="positive">
              100% consumo
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {calculationMemoryAction}
          {onOpenCalculationMemory && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenCalculationMemory}
              className="h-8 px-2.5 text-xs gap-1.5"
            >
              <Calculator className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Memória de Cálculo</span>
            </Button>
          )}
          {onOpenChargeDialog && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenChargeDialog}
              className="h-8 px-2.5 text-xs gap-1.5"
            >
              <Plus className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Lançar Encargo</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pt-1">
        <div className="flex-1 flex justify-center sm:justify-start">
          <ReportDonutChart
            segments={segments}
            size={136}
            strokeWidth={12}
            centerLabel={summary.hasCharges ? "Encargos" : "Total"}
            centerValue={
              summary.hasCharges ? (
                <span className="text-xs font-semibold text-foreground font-mono">
                  {formatPercent(summary.chargesPercentage, 0)}
                </span>
              ) : (
                <span className="text-xs font-semibold text-positive-strong font-mono">100%</span>
              )
            }
          />
        </div>

        <div className="flex flex-col gap-2.5 sm:min-w-[220px] text-xs">
          <div className="flex items-center justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground">Consumo Direto</span>
            <MoneyText cents={summary.consumptionCents} tone="default" className="font-medium" />
          </div>

          {summary.interestCents > 0 && (
            <div className="flex items-center justify-between py-1 border-b border-border/40">
              <span className="text-critical-strong">Juros de Mora / Rotativo</span>
              <MoneyText cents={summary.interestCents} tone="negative" className="font-medium" />
            </div>
          )}

          {summary.fineCents > 0 && (
            <div className="flex items-center justify-between py-1 border-b border-border/40">
              <span className="text-warning-strong">Multa por Atraso</span>
              <MoneyText cents={summary.fineCents} tone="negative" className="font-medium" />
            </div>
          )}

          {summary.taxCents > 0 && (
            <div className="flex items-center justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">IOF & Tributos</span>
              <MoneyText cents={summary.taxCents} tone="negative" className="font-medium" />
            </div>
          )}

          {summary.bankFeeCents > 0 && (
            <div className="flex items-center justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Tarifas Bancárias</span>
              <MoneyText cents={summary.bankFeeCents} tone="negative" className="font-medium" />
            </div>
          )}

          <div className="flex items-center justify-between pt-1 font-semibold text-foreground">
            <span>Total da Fatura</span>
            <MoneyText cents={summary.totalInvoiceCents} tone="default" />
          </div>
        </div>
      </div>
    </div>
  );
}
