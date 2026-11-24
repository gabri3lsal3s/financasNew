import { useMemo, useState, type ReactNode } from "react";
import { Calculator, ChevronDown, ChevronUp, Percent, Plus } from "lucide-react";
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
  defaultExpanded?: boolean;
}

/**
 * Card de Composição de Encargos da Fatura:
 * Exibe a proporção e discriminação de Juros, Multa, IOF e Tarifas Bancárias
 * em relação ao consumo direto. É colapsável (resumindo encargos e total com encargos)
 * e só é renderizado quando houver encargos cadastrados na fatura.
 */
export function InvoiceCompositionDonutCard({
  expenses,
  onOpenChargeDialog,
  onOpenCalculationMemory,
  calculationMemoryAction,
  defaultExpanded = false,
}: InvoiceCompositionDonutCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const summary = useMemo(() => summarizeInvoiceCharges(expenses), [expenses]);

  const segments = useMemo<ReportDonutSegment[]>(() => {
    if (summary.totalInvoiceCents === 0 || !summary.hasCharges) return [];

    const result: ReportDonutSegment[] = [];

    if (summary.consumptionCents > 0) {
      result.push({
        key: "consumption",
        label: "Consumo Direto",
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

  // Se a fatura estiver zerada ou não houver nenhum encargo cadastrado, o card não deve ser renderizado.
  if (summary.totalInvoiceCents === 0 || !summary.hasCharges || summary.totalChargesCents === 0) {
    return null;
  }

  return (
    <div
      data-testid="invoice-composition-donut-card"
      className="rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs flex flex-col gap-3 transition-colors"
    >
      {/* Cabeçalho colapsável com métricas resumidas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Percent className="size-4 text-warning-strong shrink-0" aria-hidden="true" />
          <h2 className="text-xs sm:text-sm font-semibold text-foreground">
            Composição de Encargos da Fatura
          </h2>
          <Badge size="xs" variant="warning">
            {formatPercent(summary.chargesPercentage, 1)} encargos
          </Badge>
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-x-4 gap-y-2 text-xs">
          <div className="inline-flex items-center gap-1.5">
            <span className="text-muted-foreground">Encargos:</span>
            <MoneyText
              cents={summary.totalChargesCents}
              tone="negative"
              className="font-semibold text-xs tabular-nums"
            />
          </div>

          <span className="text-border hidden sm:inline" aria-hidden="true">
            ·
          </span>

          <div className="inline-flex items-center gap-1.5">
            <span className="text-muted-foreground">Total com encargos:</span>
            <MoneyText
              cents={summary.totalInvoiceCents}
              tone="default"
              className="font-semibold text-xs tabular-nums text-foreground"
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            sensoryIntent="selection"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5 ml-auto sm:ml-0"
            aria-expanded={isExpanded}
            aria-label={
              isExpanded
                ? "Recolher detalhes da composição de encargos"
                : "Expandir detalhes da composição de encargos"
            }
          >
            <span className="hidden sm:inline">{isExpanded ? "Ocultar detalhes" : "Ver detalhes"}</span>
            <span className="sm:hidden">{isExpanded ? "Ocultar" : "Detalhes"}</span>
            {isExpanded ? (
              <ChevronUp className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>

      {/* Seção expandida de detalhamento e gráfico */}
      {isExpanded && (
        <div className="flex flex-col gap-4 pt-3 border-t border-border/60">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="shrink-0 flex justify-center w-full sm:w-auto">
              <ReportDonutChart
                segments={segments}
                size={124}
                strokeWidth={12}
                showLegend={false}
                centerLabel="Encargos"
                centerValue={
                  <span className="text-xs font-semibold text-warning-strong font-mono">
                    {formatPercent(summary.chargesPercentage, 0)}
                  </span>
                }
              />
            </div>

            <div className="flex-1 w-full flex flex-col gap-2 text-xs">
              {/* Consumo Direto */}
              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: "var(--color-primary, #0d9488)" }}
                    aria-hidden="true"
                  />
                  <span className="text-muted-foreground">Consumo Direto</span>
                </div>
                <div className="flex items-center gap-2 tabular-nums">
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {formatPercent((summary.consumptionCents / summary.totalInvoiceCents) * 100, 1)}%
                  </span>
                  <MoneyText cents={summary.consumptionCents} tone="default" className="font-medium" />
                </div>
              </div>

              {/* Juros */}
              {summary.interestCents > 0 && (
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: "var(--color-critical, #e11d48)" }}
                      aria-hidden="true"
                    />
                    <span className="text-critical-strong">Juros de Mora / Rotativo</span>
                  </div>
                  <div className="flex items-center gap-2 tabular-nums">
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {formatPercent((summary.interestCents / summary.totalInvoiceCents) * 100, 1)}%
                    </span>
                    <MoneyText cents={summary.interestCents} tone="negative" className="font-medium" />
                  </div>
                </div>
              )}

              {/* Multa */}
              {summary.fineCents > 0 && (
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: "var(--color-warning, #f59e0b)" }}
                      aria-hidden="true"
                    />
                    <span className="text-warning-strong">Multa por Atraso</span>
                  </div>
                  <div className="flex items-center gap-2 tabular-nums">
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {formatPercent((summary.fineCents / summary.totalInvoiceCents) * 100, 1)}%
                    </span>
                    <MoneyText cents={summary.fineCents} tone="negative" className="font-medium" />
                  </div>
                </div>
              )}

              {/* IOF */}
              {summary.taxCents > 0 && (
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: "var(--color-accent, #6366f1)" }}
                      aria-hidden="true"
                    />
                    <span className="text-muted-foreground">IOF & Tributos</span>
                  </div>
                  <div className="flex items-center gap-2 tabular-nums">
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {formatPercent((summary.taxCents / summary.totalInvoiceCents) * 100, 1)}%
                    </span>
                    <MoneyText cents={summary.taxCents} tone="negative" className="font-medium" />
                  </div>
                </div>
              )}

              {/* Tarifas */}
              {summary.bankFeeCents > 0 && (
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: "var(--color-muted, #64748b)" }}
                      aria-hidden="true"
                    />
                    <span className="text-muted-foreground">Tarifas Bancárias</span>
                  </div>
                  <div className="flex items-center gap-2 tabular-nums">
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {formatPercent((summary.bankFeeCents / summary.totalInvoiceCents) * 100, 1)}%
                    </span>
                    <MoneyText cents={summary.bankFeeCents} tone="negative" className="font-medium" />
                  </div>
                </div>
              )}

              {/* Total da Fatura */}
              <div className="flex items-center justify-between pt-1 font-semibold text-foreground">
                <span>Total da Fatura</span>
                <div className="flex items-center gap-2 tabular-nums">
                  <span className="text-[11px] text-muted-foreground font-mono">100%</span>
                  <MoneyText cents={summary.totalInvoiceCents} tone="default" />
                </div>
              </div>
            </div>
          </div>

          {/* Ações contextuais */}
          {(calculationMemoryAction || onOpenCalculationMemory || onOpenChargeDialog) && (
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40 flex-wrap">
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
          )}
        </div>
      )}
    </div>
  );
}
