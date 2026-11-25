import { useMemo } from "react";
import { Briefcase } from "lucide-react";
import { Badge, Button, MoneyText } from "@/components/ui";
import { CardSubscriptionRadar, KpiCard, KpiGrid } from "@/components/modules";
import { CalculationMemoryModal } from "@/components/modules/calculation-memory";
import type { MixedCardSplitResult } from "@/domain/business";
import { buildInvoiceBreakdown } from "@/domain/calculation-memory";
import { summarizeInvoiceCharges, type CompetenceSummary } from "@/domain/cards";
import type { CardSubscriptionImpact } from "@/domain/insights/card-radar";
import type { Expense } from "@/types";
import { InvoiceCompositionDonutCard } from "./invoice-composition-donut-card";

export interface InvoiceKpisSectionProps {
  cardName?: string;
  summary: CompetenceSummary | undefined;
  cardSubscriptionImpact: CardSubscriptionImpact | null;
  onIgnoreSubscriptionItem: (key: string) => void;
  expenses?: readonly Expense[];
  onOpenCharge?: () => void;
  mixedCardSplit?: MixedCardSplitResult | null;
  onOpenReimbursement?: () => void;
}

/** KPIs da competência (Bruto vs. Ponderado) e radar de assinaturas previstas. */
export function InvoiceKpisSection({
  cardName = "Cartão",
  summary,
  cardSubscriptionImpact,
  onIgnoreSubscriptionItem,
  expenses,
  onOpenCharge,
  mixedCardSplit,
  onOpenReimbursement,
}: InvoiceKpisSectionProps) {
  const chargesSummary = useMemo(() => {
    if (!expenses || expenses.length === 0) return undefined;
    return summarizeInvoiceCharges(expenses);
  }, [expenses]);

  const invoiceBreakdown = useMemo(() => {
    if (!summary) return null;
    return buildInvoiceBreakdown({
      cardName,
      month: summary.month,
      previstoBrutoCents: summary.previstoBrutoCents,
      previstoPonderadoCents: summary.previstoPonderadoCents,
      principalRoladoRecebidoCents: summary.principalRoladoRecebidoCents,
      principalRoladoEnviadoCents: summary.principalRoladoEnviadoCents,
      pagoCents: summary.pagoCents,
      estornoCents: summary.estornoCents,
      creditoAnteriorCents: summary.creditoAnteriorCents,
      creditoRestanteCents: summary.creditoRestanteCents,
      saldoBrutoCents: summary.saldoBrutoCents,
      saldoPonderadoCents: summary.saldoPonderadoCents,
      chargesSummary,
    });
  }, [cardName, summary, chargesSummary]);

  return (
    <>
      <KpiGrid columns={3} data-tour="cards-invoice-summary">
        <KpiCard
          label="Fatura Total (Bruto)"
          cents={summary?.totalFaturaBrutoCents ?? summary?.previstoBrutoCents ?? 0}
          action={invoiceBreakdown ? <CalculationMemoryModal breakdown={invoiceBreakdown} /> : undefined}
          hint={
            summary && summary.principalRoladoRecebidoCents > 0 ? (
              <span className="inline-flex flex-wrap items-center gap-1 font-medium text-foreground text-[11px] tabular-nums">
                <span>Inclui rotativo anterior:</span>
                <MoneyText cents={summary.principalRoladoRecebidoCents} tone="negative" className="text-[11px] tabular-nums" />
              </span>
            ) : summary && summary.previstoBrutoCents !== summary.previstoPonderadoCents ? (
              <span className="inline-flex flex-wrap items-center gap-1 font-medium text-foreground text-[11px] tabular-nums">
                <span className="hidden sm:inline">Ponderada:</span>
                <span className="sm:hidden">Pond:</span>
                <MoneyText cents={summary.previstoPonderadoCents} tone="default" className="text-[11px] tabular-nums" />
              </span>
            ) : undefined
          }
        />
        <KpiCard
          label="Pago"
          cents={summary?.pagoCents ?? 0}
          hint={
            summary && (summary.estornoCents > 0 || summary.creditoAnteriorCents > 0) ? (
              <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-medium text-foreground text-[11px] tabular-nums">
                {summary.creditoAnteriorCents > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <span className="hidden sm:inline">Crédito anterior:</span>
                    <span className="sm:hidden">Créd. ant:</span>
                    <MoneyText cents={summary.creditoAnteriorCents} tone="positive" className="text-[11px] tabular-nums" />
                  </span>
                )}
                {summary.creditoAnteriorCents > 0 && summary.estornoCents > 0 && <span aria-hidden="true">·</span>}
                {summary.estornoCents > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <span>Estornos:</span>
                    <MoneyText cents={summary.estornoCents} tone="positive" className="text-[11px] tabular-nums" />
                  </span>
                )}
              </span>
            ) : undefined
          }
        />
        <KpiCard
          label="Saldo aberto (Bruto)"
          cents={summary?.saldoBrutoCents ?? 0}
          tone={summary && summary.saldoBrutoCents > 0 ? "negative" : "positive"}
          action={invoiceBreakdown ? <CalculationMemoryModal breakdown={invoiceBreakdown} /> : undefined}
          hint={
            summary && summary.principalRoladoEnviadoCents > 0 ? (
              <span className="inline-flex flex-wrap items-center gap-1 font-medium text-muted-foreground text-[11px] tabular-nums">
                <span>Rolado p/ próxima:</span>
                <MoneyText cents={summary.principalRoladoEnviadoCents} tone="default" className="text-[11px] tabular-nums" />
              </span>
            ) : summary && summary.creditoRestanteCents > 0 ? (
              <span className="inline-flex flex-wrap items-center gap-1 font-medium text-positive-strong text-[11px] tabular-nums">
                <span className="hidden sm:inline">Crédito p/ fatura seguinte:</span>
                <span className="sm:hidden">Créd. seguinte:</span>
                <MoneyText cents={summary.creditoRestanteCents} tone="positive" className="text-[11px] tabular-nums" />
              </span>
            ) : summary && summary.saldoBrutoCents !== summary.saldoPonderadoCents ? (
              <span className="inline-flex flex-wrap items-center gap-1 font-medium text-foreground text-[11px] tabular-nums">
                <span className="hidden sm:inline">Ponderado:</span>
                <span className="sm:hidden">Pond:</span>
                <MoneyText cents={summary.saldoPonderadoCents} tone="default" className="text-[11px] tabular-nums" />
              </span>
            ) : undefined
          }
        />
      </KpiGrid>

      {mixedCardSplit && mixedCardSplit.businessCents > 0 ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-start gap-2.5 min-w-0">
            <Briefcase className="size-4 shrink-0 text-portfolio mt-0.5" aria-hidden="true" />
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs sm:text-sm font-semibold text-foreground">
                  Gastos do Meu Negócio (PJ) nesta fatura
                </span>
                {mixedCardSplit.isFullyReimbursed ? (
                  <Badge variant="positive" size="xs">
                    Reembolsado
                  </Badge>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span>Pessoal:</span>
                  <MoneyText cents={mixedCardSplit.personalCents} tone="default" variant="caption" className="font-semibold text-foreground" />
                </span>
                <span className="inline-flex items-center gap-1">
                  <span>Profissional:</span>
                  <MoneyText cents={mixedCardSplit.businessCents} tone="portfolio" variant="caption" className="font-semibold" />
                </span>
              </div>
            </div>
          </div>

          {!mixedCardSplit.isFullyReimbursed && onOpenReimbursement ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={onOpenReimbursement}
            >
              Registrar Reembolso (Profissional → Pessoal)
            </Button>
          ) : null}
        </div>
      ) : null}

      {cardSubscriptionImpact && cardSubscriptionImpact.totalProjectedCents > 0 ? (
        <div data-tour="cards-subscription-radar">
          <CardSubscriptionRadar
            impact={cardSubscriptionImpact}
            onIgnoreItem={onIgnoreSubscriptionItem}
          />
        </div>
      ) : null}

      {expenses && expenses.length > 0 ? (
        <InvoiceCompositionDonutCard
          cardName={cardName}
          competenceMonth={summary?.month ?? ""}
          expenses={expenses}
          onOpenChargeDialog={onOpenCharge}
          calculationMemoryAction={invoiceBreakdown ? <CalculationMemoryModal breakdown={invoiceBreakdown} /> : undefined}
        />
      ) : null}
    </>
  );
}
