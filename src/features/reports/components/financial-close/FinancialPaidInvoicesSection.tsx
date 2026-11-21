import { ReceiptText, Users } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import { formatDateBR, formatMonthYear } from "@/lib/date";
import { formatPercent } from "@/services/masks/percent";
import { sanitizeReportText } from "@/domain/reports";
import type {
  FinancialReportHouseholdSummary,
  FinancialReportPaidInvoiceItem,
} from "./financial-close-types";

export interface FinancialPaidInvoicesSectionProps {
  paidInvoices: readonly FinancialReportPaidInvoiceItem[];
}

export function FinancialPaidInvoicesSection({ paidInvoices }: FinancialPaidInvoicesSectionProps) {
  if (paidInvoices.length === 0) return null;

  return (
    <section aria-label="Faturas Pagas" className="break-inside-avoid flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
      <div className="flex items-center gap-1.5 pb-1 border-b border-border/80 text-xs font-bold text-foreground">
        <ReceiptText className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />
        <span>FATURAS DE CARTÃO QUITADAS NO PERÍODO</span>
      </div>
      <div className="w-full min-w-0 overflow-x-auto no-scrollbar scroll-smooth print:overflow-visible">
        <table className="w-full min-w-[440px] sm:min-w-0 text-xs border-collapse table-fixed">
          <colgroup>
            <col className="w-[40%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border/60 text-muted-foreground font-bold text-[10px] uppercase tracking-wider text-left bg-muted/40">
              <th className="py-1.5 px-3 font-bold">Cartão</th>
              <th className="py-1.5 pl-2 pr-4 font-bold">Competência</th>
              <th className="py-1.5 pl-3 pr-2 font-bold">Data Pgto</th>
              <th className="py-1.5 px-3 text-right font-bold">Valor Pago (R$)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {paidInvoices.map((inv, idx) => {
              const comp =
                inv.competenceMonth ||
                (inv as unknown as { competence?: string }).competence ||
                (inv.date ? inv.date.slice(0, 7) : undefined) ||
                ((inv as unknown as { paidAt?: string }).paidAt
                  ? (inv as unknown as { paidAt: string }).paidAt.slice(0, 7)
                  : undefined);
              const pDate =
                inv.date ||
                (inv as unknown as { paidAt?: string }).paidAt ||
                (inv as unknown as { paymentDate?: string }).paymentDate;

              return (
                <tr key={`${inv.cardName}-${comp}-${idx}`} className="even:bg-muted/20 print:even:bg-muted/20">
                  <td className="py-1.5 px-3 font-medium text-foreground whitespace-nowrap truncate">
                    {sanitizeReportText(inv.cardName)}
                  </td>
                  <td className="py-1.5 pl-2 pr-4 text-muted-foreground whitespace-nowrap">
                    {comp ? formatMonthYear(comp) : "—"}
                  </td>
                  <td className="py-1.5 pl-3 pr-2 text-muted-foreground whitespace-nowrap">
                    {pDate ? formatDateBR(pDate) : "—"}
                  </td>
                  <td className="py-1.5 px-3 text-right num font-mono font-bold whitespace-nowrap">
                    <MoneyText cents={inv.amountCents} tone="negative" hideCurrency />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function FinancialHouseholdSection({
  householdSummary,
}: {
  householdSummary: FinancialReportHouseholdSummary;
}) {
  return (
    <section aria-label="Consolidação Residencial" className="break-inside-avoid flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
      <div className="flex items-center gap-1.5 pb-1 border-b border-border/80 text-xs font-bold text-foreground">
        <Users className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />
        <span>CONSOLIDAÇÃO RESIDENCIAL ({sanitizeReportText(householdSummary.familyTitle).toUpperCase()})</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="p-2.5 rounded-lg bg-muted/20 border border-border/60">
          <span className="text-[10px] text-muted-foreground block uppercase">Teto Familiar</span>
          <MoneyText cents={householdSummary.monthlyCeilingCents} className="font-bold text-sm" />
        </div>
        <div className="p-2.5 rounded-lg bg-muted/20 border border-border/60">
          <span className="text-[10px] text-muted-foreground block uppercase">Gasto Total da Casa</span>
          <MoneyText
            cents={householdSummary.totalSpentCents}
            tone={householdSummary.spentPercentage > 100 ? "negative" : "default"}
            className="font-bold text-sm"
          />
        </div>
        <div className="p-2.5 rounded-lg bg-muted/20 border border-border/60">
          <span className="text-[10px] text-muted-foreground block uppercase">Consumo do Teto</span>
          <span className="font-bold text-sm block font-mono num">{householdSummary.spentPercentage}%</span>
        </div>
        <div className="p-2.5 rounded-lg bg-muted/20 border border-border/60">
          <span className="text-[10px] text-muted-foreground block uppercase">Sua Participação</span>
          <MoneyText cents={householdSummary.userContributionCents} className="font-bold text-sm" />
          <span className="text-[10px] text-muted-foreground ml-1">
            ({formatPercent(householdSummary.userPercentageOfTotal)}%)
          </span>
        </div>
      </div>
    </section>
  );
}
