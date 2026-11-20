import { useMemo } from "react";
import { MoneyText } from "@/components/ui";
import { CardSubscriptionRadar, KpiCard, KpiGrid } from "@/components/modules";
import { CalculationMemoryModal } from "@/components/modules/calculation-memory";
import { buildInvoiceBreakdown } from "@/domain/calculation-memory";
import type { CompetenceSummary } from "@/domain/cards";
import type { CardSubscriptionImpact } from "@/domain/insights/card-radar";

export interface InvoiceKpisSectionProps {
  cardName?: string;
  summary: CompetenceSummary | undefined;
  cardSubscriptionImpact: CardSubscriptionImpact | null;
  onIgnoreSubscriptionItem: (key: string) => void;
}

/** KPIs da competência (Bruto vs. Ponderado) e radar de assinaturas previstas. */
export function InvoiceKpisSection({
  cardName = "Cartão",
  summary,
  cardSubscriptionImpact,
  onIgnoreSubscriptionItem,
}: InvoiceKpisSectionProps) {
  const invoiceBreakdown = useMemo(() => {
    if (!summary) return null;
    return buildInvoiceBreakdown({
      cardName,
      month: summary.month,
      previstoBrutoCents: summary.previstoBrutoCents,
      previstoPonderadoCents: summary.previstoPonderadoCents,
      pagoCents: summary.pagoCents,
      estornoCents: summary.estornoCents,
      creditoAnteriorCents: summary.creditoAnteriorCents,
      creditoRestanteCents: summary.creditoRestanteCents,
      saldoBrutoCents: summary.saldoBrutoCents,
      saldoPonderadoCents: summary.saldoPonderadoCents,
    });
  }, [cardName, summary]);

  return (
    <>
      <KpiGrid columns={3} data-tour="cards-invoice-summary">
        <KpiCard
          label="Fatura Total (Bruto)"
          cents={summary?.previstoBrutoCents ?? 0}
          action={invoiceBreakdown ? <CalculationMemoryModal breakdown={invoiceBreakdown} /> : undefined}
          hint={
            summary && summary.previstoBrutoCents !== summary.previstoPonderadoCents ? (
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
            summary && summary.creditoRestanteCents > 0 ? (
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

      {cardSubscriptionImpact && cardSubscriptionImpact.totalProjectedCents > 0 ? (
        <div data-tour="cards-subscription-radar">
          <CardSubscriptionRadar
            impact={cardSubscriptionImpact}
            onIgnoreItem={onIgnoreSubscriptionItem}
          />
        </div>
      ) : null}
    </>
  );
}
