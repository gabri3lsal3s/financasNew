import { ArrowDownLeft } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import { formatSignedPct } from "@/services/masks/percent";
import { numberToCents } from "@/domain/money";
import { sanitizeReportText, type PeriodRedemptionItem } from "@/domain/reports";
import { cn } from "@/lib/utils";

export interface ReportRedemptionsTableProps {
  items: readonly PeriodRedemptionItem[];
  periodLabel?: string;
}

function formatISODatePtBR(isoDate: string): string {
  if (!isoDate || !isoDate.includes("-")) return isoDate;
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Tabela de Posições Encerradas e Resgates Realizados para Relatórios A4/PDF (§F42/F44).
 * Totalmente responsiva com larguras proporcionais, colunas fixas e scroll suave horizontal.
 */
export function ReportRedemptionsTable({
  items,
  periodLabel,
}: ReportRedemptionsTableProps) {
  if (!items || items.length === 0) return null;

  const totalAppliedBRL = items.reduce((acc, i) => acc + i.appliedCostBRL, 0);
  const totalRedeemedBRL = items.reduce((acc, i) => acc + i.redeemedValueBRL, 0);
  const totalRealizedPnlBRL = totalRedeemedBRL - totalAppliedBRL;
  const totalReturnPct =
    totalAppliedBRL > 0 ? (totalRealizedPnlBRL / totalAppliedBRL) * 100 : null;

  return (
    <section
      aria-label="Posições Encerradas e Resgates do Período"
      className="flex flex-col gap-1.5 break-inside-avoid print:break-inside-avoid"
    >
      {/* Cabeçalho Editorial com Acento de Liquidação */}
      <div className="report-group-header flex items-center justify-between bg-muted/40 px-3 py-1.5 rounded-lg border border-border/80 text-xs font-bold text-foreground print:bg-slate-100 print:border-slate-300 break-inside-avoid break-after-avoid">
        <div className="flex items-center gap-2">
          <ArrowDownLeft className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />
          <span className="uppercase tracking-wider">
            Posições Encerradas & Resgates Realizados ({items.length}{" "}
            {items.length === 1 ? "título" : "títulos"})
          </span>
        </div>
        {periodLabel ? (
          <div className="text-[11px] font-normal text-muted-foreground font-mono num">
            Período: {periodLabel}
          </div>
        ) : null}
      </div>

      {/* Tabela de Resgates com Totais Contábeis Responsiva */}
      <div className="rounded-lg border border-border/80 overflow-x-auto shadow-2xs">
        <table className="w-full min-w-[650px] print:min-w-0 text-left text-xs border-collapse table-fixed">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[18%]" />
            <col className="w-[11%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col className="w-[11%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border/70 bg-muted/40 text-muted-foreground font-bold text-[9px] uppercase tracking-wider">
              <th className="py-1.5 px-2.5">Título / Ativo</th>
              <th className="py-1.5 px-2">Classe / Categoria</th>
              <th className="py-1.5 px-1.5 text-center">Data Resgate</th>
              <th className="py-1.5 px-2 text-right">Valor Aplicado</th>
              <th className="py-1.5 px-2 text-right">Valor Resgatado</th>
              <th className="py-1.5 px-2 text-right">Resultado (R$)</th>
              <th className="py-1.5 px-2 text-right">Rentab. Final</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {items.map((item) => {
              const isPositive = item.realizedPnlBRL >= 0;
              return (
                <tr
                  key={item.id}
                  className="even:bg-muted/20 print:even:bg-slate-50/50 break-inside-avoid"
                >
                  <td className="py-1.5 px-2.5 font-semibold text-foreground whitespace-normal break-words leading-tight text-[11px]">
                    {sanitizeReportText(item.ticker)}
                    {item.name && item.name !== item.ticker ? (
                      <span className="block text-[9.5px] text-muted-foreground font-normal truncate">
                        {sanitizeReportText(item.name)}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1.5 px-2 text-muted-foreground whitespace-normal break-words leading-tight text-[10px]">
                    {sanitizeReportText(item.assetClass)}
                    {item.sector ? (
                      <span className="block text-[9px] text-muted-foreground/70 truncate">
                        {sanitizeReportText(item.sector)}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1.5 px-1.5 text-center num font-mono text-muted-foreground text-[10px] whitespace-nowrap">
                    {formatISODatePtBR(item.redemptionDate)}
                  </td>
                  <td className="py-1.5 px-2 text-right num font-mono text-muted-foreground text-[10.5px] whitespace-nowrap tabular-nums">
                    <MoneyText cents={numberToCents(item.appliedCostBRL)} tone="default" />
                  </td>
                  <td className="py-1.5 px-2 text-right num font-mono font-bold text-foreground text-[10.5px] whitespace-nowrap tabular-nums">
                    <MoneyText cents={numberToCents(item.redeemedValueBRL)} tone="default" />
                  </td>
                  <td className="py-1.5 px-2 text-right num font-mono font-bold text-[10.5px] whitespace-nowrap tabular-nums">
                    <MoneyText
                      cents={numberToCents(item.realizedPnlBRL)}
                      tone={isPositive ? "positive" : "negative"}
                      sign="explicit"
                    />
                  </td>
                  <td
                    className={cn(
                      "py-1.5 px-2 text-right num font-mono font-bold text-[10.5px] whitespace-nowrap tabular-nums",
                      item.finalReturnPct !== null && item.finalReturnPct >= 0
                        ? "text-positive-strong"
                        : "text-negative-strong",
                    )}
                  >
                    {item.finalReturnPct !== null ? formatSignedPct(item.finalReturnPct) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border/80 bg-muted/40 font-bold text-[10.5px] print:bg-slate-100">
              <td colSpan={3} className="py-2 px-2.5 text-foreground uppercase tracking-wider text-[10px]">
                Total Resgates do Período ({items.length})
              </td>
              <td className="py-2 px-2 text-right num font-mono text-muted-foreground whitespace-nowrap tabular-nums">
                <MoneyText cents={numberToCents(totalAppliedBRL)} tone="default" />
              </td>
              <td className="py-2 px-2 text-right num font-mono text-foreground font-bold whitespace-nowrap tabular-nums">
                <MoneyText cents={numberToCents(totalRedeemedBRL)} tone="default" />
              </td>
              <td className="py-2 px-2 text-right num font-mono font-bold whitespace-nowrap tabular-nums">
                <MoneyText
                  cents={numberToCents(totalRealizedPnlBRL)}
                  tone={totalRealizedPnlBRL >= 0 ? "positive" : "negative"}
                  sign="explicit"
                />
              </td>
              <td
                className={cn(
                  "py-2 px-2 text-right num font-mono font-bold whitespace-nowrap tabular-nums",
                  totalReturnPct !== null && totalReturnPct >= 0
                    ? "text-positive-strong"
                    : "text-negative-strong",
                )}
              >
                {totalReturnPct !== null ? formatSignedPct(totalReturnPct) : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
