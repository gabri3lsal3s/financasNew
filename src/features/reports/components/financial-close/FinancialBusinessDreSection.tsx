import { Briefcase } from "lucide-react";
import { Badge, MoneyText } from "@/components/ui";
import { formatPercent } from "@/services/masks/percent";
import type { ExcelBusinessDreData } from "@/services/excel-export";

export interface FinancialBusinessDreSectionProps {
  businessDre: ExcelBusinessDreData;
}

/**
 * Seção executiva do DRE do Negócio (PJ) no relatório A4 de fechamento.
 * Exibida exclusivamente quando o Modo Negócio estiver ativo e houver movimentação ou receita na competência.
 */
export function FinancialBusinessDreSection({ businessDre }: FinancialBusinessDreSectionProps) {
  const grossCents = Math.round(businessDre.grossRevenueBRL * 100);
  const costsCents = Math.round(businessDre.operationalCostsBRL * 100);
  const opProfitCents = Math.round(businessDre.operationalProfitBRL * 100);
  const taxesCents = Math.round(businessDre.fiscalTaxesPaidBRL * 100);
  const proLaboreCents = Math.round(businessDre.proLaboreWithdrawnBRL * 100);
  const retainedCents = Math.round(businessDre.retainedEarningsBRL * 100);

  return (
    <section
      aria-label="Demonstração do Resultado do Negócio"
      className="break-inside-avoid flex flex-col gap-2 pt-2"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-1">
        <div className="flex items-center gap-1.5">
          <Briefcase className="size-3.5 text-portfolio" aria-hidden="true" />
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-foreground">
            DRE do Negócio — Esfera PJ ({businessDre.profileLabel})
          </h2>
        </div>
        <Badge variant={retainedCents >= 0 ? "positive" : "critical"} size="xs">
          Margem Retida: {formatPercent(businessDre.marginPct, 1)}
        </Badge>
      </div>

      <div className="w-full min-w-0 overflow-x-auto no-scrollbar scroll-smooth rounded-xl border border-border/80 bg-surface shadow-xs print:overflow-visible">
        <table className="w-full min-w-[460px] sm:min-w-0 text-left text-xs border-collapse table-fixed">
          <colgroup>
            <col className="w-[60%]" />
            <col className="w-[25%]" />
            <col className="w-[15%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border/70 bg-muted/40 text-muted-foreground font-bold text-[10px] uppercase tracking-wider">
              <th className="py-2 px-3">Estrutura Operacional PJ</th>
              <th className="py-2 px-3 text-right">Valor (R$)</th>
              <th className="py-2 px-3 text-right">% Faturamento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            <tr className="bg-positive/5">
              <td className="py-2 px-3 font-semibold text-positive-strong">
                (+) Faturamento Bruto da Operação
              </td>
              <td className="py-2 px-3 text-right num font-mono font-bold whitespace-nowrap">
                <MoneyText cents={grossCents} tone="positive" hideCurrency />
              </td>
              <td className="py-2 px-3 text-right text-muted-foreground text-[11px]">100%</td>
            </tr>

            <tr>
              <td className="py-2 px-3 text-muted-foreground">
                (-) Custos Operacionais e Despesas do Negócio
              </td>
              <td className="py-2 px-3 text-right num font-mono text-negative-strong whitespace-nowrap">
                <MoneyText cents={-Math.abs(costsCents)} tone="negative" hideCurrency />
              </td>
              <td className="py-2 px-3 text-right text-muted-foreground text-[11px]">
                {grossCents > 0 ? formatPercent((costsCents / grossCents) * 100, 1) : "—"}
              </td>
            </tr>

            <tr className="bg-muted/15 font-medium">
              <td className="py-2 px-3 text-foreground font-semibold">(=) Lucro Operacional</td>
              <td className="py-2 px-3 text-right num font-mono font-semibold whitespace-nowrap">
                <MoneyText
                  cents={opProfitCents}
                  tone={opProfitCents >= 0 ? "positive" : "negative"}
                  hideCurrency
                />
              </td>
              <td className="py-2 px-3 text-right text-muted-foreground text-[11px]">
                {grossCents > 0 ? formatPercent((opProfitCents / grossCents) * 100, 1) : "—"}
              </td>
            </tr>

            <tr>
              <td className="py-2 px-3 text-muted-foreground">
                (-) Impostos Fiscais Quitados (DAS / Carnê-Leão)
              </td>
              <td className="py-2 px-3 text-right num font-mono text-negative-strong whitespace-nowrap">
                <MoneyText cents={-Math.abs(taxesCents)} tone="negative" hideCurrency />
              </td>
              <td className="py-2 px-3 text-right text-muted-foreground text-[11px]">
                {grossCents > 0 ? formatPercent((taxesCents / grossCents) * 100, 1) : "—"}
              </td>
            </tr>

            <tr>
              <td className="py-2 px-3 text-muted-foreground">
                (-) Retiradas de Pró-Labore para a Pessoa Física
              </td>
              <td className="py-2 px-3 text-right num font-mono text-muted-foreground whitespace-nowrap">
                <MoneyText cents={-Math.abs(proLaboreCents)} tone="default" hideCurrency />
              </td>
              <td className="py-2 px-3 text-right text-muted-foreground text-[11px]">
                {grossCents > 0 ? formatPercent((proLaboreCents / grossCents) * 100, 1) : "—"}
              </td>
            </tr>

            <tr className="bg-portfolio/10 font-bold border-t-2 border-border/80">
              <td className="py-2 px-3 text-foreground">(=) Lucro Retido no Caixa do Negócio</td>
              <td className="py-2 px-3 text-right num font-mono font-bold whitespace-nowrap">
                <MoneyText
                  cents={retainedCents}
                  tone={retainedCents >= 0 ? "positive" : "negative"}
                  hideCurrency
                />
              </td>
              <td className="py-2 px-3 text-right text-foreground font-bold text-[11px]">
                {formatPercent(businessDre.marginPct, 1)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
