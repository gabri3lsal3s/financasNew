import { MoneyText } from "@/components/ui/money-text";
import { formatPercent } from "@/services/masks/percent";
import type { ReportClassTablesProps } from "./report-class-table-parts";
import { ReportEquityClassTable } from "./report-equity-class-table";
import { ReportFixedIncomeClassTable } from "./report-fixed-income-class-table";

export type {
  ReportClassGroup,
  ReportClassTableItem,
  ReportClassTablesProps,
} from "./report-class-table-parts";

/**
 * Tabelas de Custódia Especializadas por Classe de Ativo para Relatórios A4/PDF.
 */
export function ReportClassTables({ groups }: ReportClassTablesProps) {
  if (!groups || groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 w-full print:block print:space-y-4">
      {groups.map((group) => {
        const lowerClass = group.className.toLowerCase();
        const isCaixa = lowerClass.includes("caixa") || lowerClass.includes("reserva");
        const isRendaFixa = lowerClass.includes("fixa") || lowerClass.includes("tesouro");
        const isInternacional = lowerClass.includes("internacional") || lowerClass.includes("global");

        const subtotalPriceVarPct =
          group.subtotalPriceVarPct !== undefined
            ? group.subtotalPriceVarPct
            : group.totalCostCents && group.totalCostCents > 0
              ? ((group.totalCents - group.totalCostCents) / group.totalCostCents) * 100
              : null;

        return (
          <section
            key={group.className}
            aria-label={`Posições de ${group.className}`}
            className="flex flex-col gap-1.5 break-inside-auto print:break-inside-auto print:block print:mb-4"
          >
            {isCaixa ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-border/80 bg-muted/20 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: group.color ?? "var(--portfolio, #10B981)" }}
                    aria-hidden="true"
                  />
                  <span className="font-bold text-foreground">
                    {group.className}
                  </span>
                  <span className="text-muted-foreground text-[11px] hidden sm:inline print:inline">
                    · Disponibilidades &amp; Liquidez Imediata
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono num whitespace-nowrap shrink-0">
                  <span className="font-bold text-foreground whitespace-nowrap">
                    <MoneyText cents={group.totalCents} />
                  </span>
                  <span className="text-muted-foreground font-semibold text-[11px] whitespace-nowrap">
                    ({formatPercent(group.sharePct)}%)
                  </span>
                </div>
              </div>
            ) : isRendaFixa ? (
              <ReportFixedIncomeClassTable group={group} />
            ) : (
              <ReportEquityClassTable
                group={group}
                isInternacional={isInternacional}
                subtotalPriceVarPct={subtotalPriceVarPct}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}
