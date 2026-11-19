import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import { resolveAssetClassTokenColor } from "@/domain/reports";
import { cn } from "@/lib/utils";
import { formatPercent, formatSignedPct } from "@/services/masks/percent";

export interface ReportClassTableItem {
  ticker: string;
  name?: string | null;
  sector?: string | null;
  quantity: number;
  avgPriceCents: number;
  currentPriceCents: number;
  totalCents: number;
  pnlPct: number;
  pricePnlPct?: number | null;
  dividendsCents?: number | null;
  yocPct?: number | null;
  currency?: string | null;
  indexType?: string | null;
  maturityDate?: string | null;
  score?: number | null;
  status?: string | null;
}

export interface ReportClassGroup {
  className: string;
  totalCents: number;
  sharePct: number;
  pnlPct: number;
  subtotalPriceVarPct?: number;
  subtotalPriceVarPctUSD?: number;
  usdRate?: number;
  totalCostCents?: number;
  totalDividendsCents?: number;
  topAssetTicker?: string;
  topAssetSharePct?: number;
  color?: string;
  items: readonly ReportClassTableItem[];
}

export interface ReportClassTablesProps {
  groups: readonly ReportClassGroup[];
}

/** Badges de governança (Nota PQS e Status de Alocação) nas tabelas de custódia. */
export function ReportAssetGovernanceBadges({
  score,
  status,
}: {
  score?: number | null;
  status?: string | null;
}) {
  const showScore = score !== undefined;
  const showStatus = status && status !== "active";
  if (!showScore && !showStatus) return null;

  return (
    <>
      {showScore && (
        <Badge variant={score === null ? "warning" : "muted"} size="xs" className="font-mono">
          {score === null ? "Sem nota" : `Nota ${score}`}
        </Badge>
      )}
      {status === "neutral" && (
        <Badge variant="muted" size="xs" className="font-mono">
          Neutro
        </Badge>
      )}
      {status === "quarantine" && (
        <Badge variant="warning" size="xs" className="font-mono">
          Quarentena
        </Badge>
      )}
      {status === "exit" && (
        <Badge variant="critical" size="xs" className="font-mono">
          Saída
        </Badge>
      )}
    </>
  );
}

/** Linha superior do thead identificando a classe de ativo, total e retorno. */
export function ReportClassTableBanner({
  group,
  colSpan,
}: {
  group: ReportClassGroup;
  colSpan: number;
}) {
  const classColor = group.color ?? resolveAssetClassTokenColor(group.className);

  return (
    <tr className="border-b border-border/80 bg-muted/60 text-foreground font-bold text-[10px] uppercase tracking-wider print:bg-muted/40 print:[break-after:avoid] print:[break-inside:avoid]">
      <th colSpan={colSpan} className="py-2 px-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-1 h-3 rounded-full shrink-0"
              style={{ backgroundColor: classColor }}
              aria-hidden="true"
            />
            <span className="font-bold tracking-wider text-foreground">
              {group.className} ({group.items.length}{" "}
              {group.items.length === 1 ? "ativo" : "ativos"})
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono num tabular-nums text-[10px] whitespace-nowrap">
            <span className="font-bold text-foreground">
              <MoneyText cents={group.totalCents} tone="default" />
            </span>
            <span className="text-muted-foreground font-normal">
              ({formatPercent(group.sharePct)}% da carteira)
            </span>
            <span
              className={cn(
                "font-bold font-mono ml-1",
                group.pnlPct >= 0 ? "text-positive-strong" : "text-negative-strong",
              )}
            >
              {formatSignedPct(group.pnlPct)}
            </span>
          </div>
        </div>
      </th>
    </tr>
  );
}
