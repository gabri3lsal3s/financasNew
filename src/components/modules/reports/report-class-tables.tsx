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
    <div className="flex flex-col gap-4 w-full">
      {groups.map((group) => {
        const lowerClass = group.className.toLowerCase();
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
            className="flex flex-col gap-1.5 break-inside-auto print:break-inside-auto"
          >
            {isRendaFixa ? (
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
