import { Card, CardContent, CardHeader, CardTitle, MoneyText } from "@/components/ui";
import type { YearProjectionSnapshot } from "@/domain/portfolio";

export interface CompoundTimelineTableProps {
  timeline: readonly YearProjectionSnapshot[];
}

export function CompoundTimelineTable({ timeline }: CompoundTimelineTableProps) {
  return (
    <section className="space-y-4">
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader className="border-b border-border/80 pb-3">
          <CardTitle className="text-base font-bold">Evolução Anual do Patrimônio</CardTitle>
          <p className="text-xs text-muted-foreground">
            Acompanhe o crescimento ano a ano do patrimônio, aportes acumulados e juros.
          </p>
        </CardHeader>
        <CardContent className="pt-4 overflow-x-auto no-scrollbar scroll-smooth">
          <table className="w-full min-w-[560px] text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/80 text-muted-foreground">
                <th className="py-2.5 px-3 font-semibold">Ano</th>
                <th className="py-2.5 px-3 font-semibold">Total Aportado</th>
                <th className="py-2.5 px-3 font-semibold">Juros no Ano</th>
                <th className="py-2.5 px-3 font-semibold">Juros Acumulados</th>
                <th className="py-2.5 px-3 font-semibold">Patrimônio Total</th>
                <th className="py-2.5 px-3 font-semibold text-right">Renda Passiva Mensal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {timeline.map((item) => (
                <tr key={item.year} className="hover:bg-surface-hover/50 transition-colors">
                  <td className="py-2 px-3 font-bold text-foreground whitespace-nowrap">
                    {item.year === 0 ? "Inicial" : `Ano ${item.year}`}
                  </td>
                  <td className="py-2 px-3">
                    <MoneyText cents={item.contributedCents} tone="default" />
                  </td>
                  <td className="py-2 px-3 text-positive-strong">
                    <MoneyText cents={item.interestEarnedThisYearCents} tone="positive" />
                  </td>
                  <td className="py-2 px-3 text-positive-strong font-medium">
                    <MoneyText cents={item.totalInterestCents} tone="positive" />
                  </td>
                  <td className="py-2 px-3 font-bold text-foreground">
                    <MoneyText cents={item.balanceCents} tone="default" className="font-bold" />
                  </td>
                  <td className="py-2 px-3 text-right font-semibold text-positive-strong">
                    <MoneyText
                      cents={item.monthlyPassiveIncomeCents}
                      tone="positive"
                      className="font-bold"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </section>
  );
}
