import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coins,
  Globe,
  Landmark,
  Layers,
  Search,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { calculateYieldOnCost } from "@/domain/portfolio";
import type { AssetPricingMode, PriceSource } from "@/domain/portfolio";
import { isFixedIncomeClass } from "@/domain/portfolio/valuation";
import { formatDateBR } from "@/lib/date";
import { cn } from "@/lib/utils";
import { formatSignedPct } from "@/services/masks/percent";
import { formatCentsAsBRL } from "@/services/masks/money";
import type { AssetCurrency, FixedIncomeMetadata } from "@/types";
import type { FixedIncomeBalanceResult } from "@/domain/portfolio";


export interface PositionRow {
  assetId: string;
  ticker: string;
  assetClass: string | null;
  sector?: string | null;
  currency: AssetCurrency;
  quantity: number;
  averageCost: number;
  totalCost?: number;
  totalCostBRL?: number;
  averageCostBRL?: number;
  dividends?: number;
  priceQuote?: number;
  priceBRL: number;
  usdRate?: number;
  source: PriceSource;
  valueBRL: number;
  pct: number;
  /** Lucro/prejuízo não realizado em BRL (valor − custo; F14). */
  unrealizedPnl: number;
  /** Variação da cotação % sobre o custo (null quando não há custo — caixa; F14). */
  unrealizedPct: number | null;
  /** Resultado total em BRL ((valor − custo) + proventos). */
  totalReturnPnl?: number;
  /** Retorno Total % sobre o custo (null quando não há custo — caixa). */
  totalReturnPct?: number | null;
  isCash: boolean;
  pricingMode?: AssetPricingMode;
  fixedIncomeMetadata?: FixedIncomeMetadata | null;
  fixedIncomeResult?: FixedIncomeBalanceResult | null;
  isMatured?: boolean;
  maturityDate?: string | null;
  netValueBRL?: number;
}

export interface PositionTableProps {
  rows: PositionRow[];
  /** Abre a lista de lançamentos / detalhes do ativo. */
  onListTransactions?: (assetId: string, ticker: string) => void;
  /** Abre o formulário de edição cadastral do ativo (ticker/classe/moeda). */
  onEditAsset?: (assetId: string, ticker: string) => void;
  /** Abre o diálogo de calibrar saldo com extrato para Renda Fixa / Tesouro Direto. */
  onCalibrateAsset?: (assetId: string, ticker: string, currentValueCents: number) => void;
  /** Abre o diálogo de preço manual/cotação do ativo (para Renda Variável). */
  onSetManualPrice?: (
    assetId: string,
    ticker: string,
    currency: AssetCurrency,
    priceBRL: number,
    source: PriceSource,
    priceQuote?: number,
    pricingMode?: AssetPricingMode,
    usdRate?: number,
  ) => void;
  /** Confirma a exclusão do ativo (transações e metas em cascata). */
  onDeleteAsset?: (assetId: string, ticker: string) => void;
  emptyMessage?: string;
  /**
   * Id do ativo destacado vindo da busca global (?q=<assetId>).
   */
  highlightId?: string | null;
  /**
   * F17 — ordenação por coluna clicável (aria-sort + ícone de direção).
   * Desabilitada por padrão (a Posição atual mantém a ordem do ledger).
   */
  sortable?: boolean;
}

type SortKey = "ticker" | "quantity" | "price" | "averageCost" | "value" | "unrealizedPct" | "pct" | "maturityDate";
type SortDirection = "asc" | "desc";

interface SortState {
  key: SortKey;
  direction: SortDirection;
}

const PRICE_SOURCE_LABEL: Record<PriceSource, { label: string; title: string }> = {
  manual: { label: "manual", title: "Preço definido manualmente pelo usuário" },
  api: { label: "cotação", title: "Cotação de fechamento atualizada via API" },
  fallback: { label: "fallback", title: "Preço estimado por fallback estático" },
};

const formatQuantity = (quantity: number): string =>
  Number.isInteger(quantity) ? String(quantity) : quantity.toLocaleString("pt-BR", { maximumFractionDigits: 4 });

export interface AssetClassMeta {
  label: string;
  badgeClass: string;
  icon: typeof TrendingUp;
}

function getAssetClassMeta(className: string | null): AssetClassMeta {
  const norm = (className ?? "").trim().toLowerCase();
  if (norm.includes("ação") || norm.includes("acoes") || norm.includes("ações")) {
    return {
      label: className ?? "Ações",
      badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      icon: TrendingUp,
    };
  }
  if (norm.includes("fii")) {
    return {
      label: className ?? "FIIs",
      badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
      icon: Building2,
    };
  }
  if (norm.includes("internacional") || norm.includes("global") || norm.includes("exterior")) {
    return {
      label: className ?? "Internacional",
      badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
      icon: Globe,
    };
  }
  if (norm.includes("etf")) {
    return {
      label: className ?? "ETFs",
      badgeClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
      icon: Layers,
    };
  }
  if (
    norm.includes("renda fixa") ||
    norm.includes("cdb") ||
    norm.includes("tesouro") ||
    norm.includes("lci") ||
    norm.includes("lca") ||
    norm.includes("cri") ||
    norm.includes("cra") ||
    norm.includes("debenture")
  ) {
    return {
      label: className ?? "Renda Fixa",
      badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      icon: Landmark,
    };
  }
  if (norm.includes("caixa") || norm.includes("cash") || norm.includes("moeda")) {
    return {
      label: className ?? "Caixa",
      badgeClass: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
      icon: Wallet,
    };
  }
  return {
    label: className || "Outros",
    badgeClass: "bg-surface-hover/80 text-muted-foreground border-border/40",
    icon: Coins,
  };
}

interface ClassGroup {
  className: string;
  rows: PositionRow[];
  totalValueBRL: number;
  totalPct: number;
  totalPnl: number;
  totalCostBRL: number;
  totalDividends: number;
  totalReturnPnl: number;
  totalReturnPct: number | null;
  unrealizedPct: number | null;
  count: number;
}

function SortableHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={cn(
        "inline-flex items-center gap-1 font-semibold text-foreground transition-colors hover:text-primary cursor-pointer",
        active && "text-primary",
      )}
      aria-label={`Ordenar por ${label} (${active ? (direction === "asc" ? "crescente" : "decrescente") : "clique para ordenar"})`}
    >
      <span>{label}</span>
      {active ? (
        direction === "asc" ? (
          <ArrowUp className="size-3.5" aria-hidden="true" />
        ) : (
          <ArrowDown className="size-3.5" aria-hidden="true" />
        )
      ) : (
        <ArrowUpDown className="size-3.5 text-muted-foreground/60" aria-hidden="true" />
      )}
    </button>
  );
}

/**
 * Tabela de posições (§3.11.1 / §F17) — ledger derivado:
 * - Visão padrão agrupada por classe com subtotais consolidados e grupos colapsados por padrão.
 * - Desktop (sm+): cabeçalho de colunas contextual dentro de cada grupo expandido com larguras proporcionais.
 * - Mobile (<sm): cards empilhados organizados por categoria com cabeçalhos de subtotais.
 */
export function PositionTable({
  rows,
  onListTransactions,
  onEditAsset,
  onCalibrateAsset,
  onSetManualPrice,
  emptyMessage,
  highlightId,
  sortable = false,
}: PositionTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sort, setSort] = useState<SortState | null>(null);
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});
  const [hideClosed, setHideClosed] = useState(true);
  const [closedSectionOpen, setClosedSectionOpen] = useState(false);

  const effectiveRows = rows.filter((r) => !r.isCash);
  const isRowClosed = (r: PositionRow) =>
    r.quantity <= 0 &&
    r.valueBRL <= 0 &&
    (r.totalCostBRL ?? r.totalCost ?? r.averageCost ?? 0) <= 0;

  const activeRows = effectiveRows.filter((r) => !isRowClosed(r));
  const closedRows = effectiveRows.filter((r) => isRowClosed(r));
  const displaySourceRows = hideClosed ? activeRows : effectiveRows;

  const isClassExpanded = (clsName: string) => {
    if (expandedClasses[clsName] !== undefined) return expandedClasses[clsName];
    if (highlightId) {
      const target = effectiveRows.find((r) => r.assetId === highlightId);
      if (target) {
        const targetCls = target.assetClass ?? "Sem classe";
        if (targetCls === clsName) return true;
      }
    }
    return false;
  };

  // Rola até a linha do ativo destacado se highlightId fornecido
  useEffect(() => {
    if (!highlightId) return;
    const timer = window.setTimeout(() => {
      const el =
        document.getElementById(`asset-row-${highlightId}`) ??
        document.getElementById(`asset-card-${highlightId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [highlightId]);

  const handleOpen = onListTransactions ?? onEditAsset;

  const [pageSize, setPageSize] = useState<number>(() => {
    if (typeof window !== "undefined" && window.innerWidth < 640) {
      return 5;
    }
    return 10;
  });
  const [page, setPage] = useState<number>(1);

  const scrollToTop = () => {
    if (typeof window !== "undefined" && window.innerWidth < 640) {
      containerRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }
  };

  const availableClasses = [
    ...new Set(displaySourceRows.map((r) => r.assetClass).filter((c): c is string => Boolean(c))),
  ];

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleClassChange = (cls: string | null) => {
    setSelectedClass(cls);
    setPage(1);
  };

  const toggleClassCollapse = (className: string) => {
    setExpandedClasses((prev) => {
      const current = isClassExpanded(className);
      return {
        ...prev,
        [className]: !current,
      };
    });
  };

  const filteredRows = displaySourceRows.filter((row) => {
    const rowClass = row.assetClass;
    const matchesSearch =
      search.trim() === "" ||
      row.ticker.toLowerCase().includes(search.toLowerCase().trim()) ||
      (row.assetClass?.toLowerCase().includes(search.toLowerCase().trim()) ?? false) ||
      (row.sector?.toLowerCase().includes(search.toLowerCase().trim()) ?? false);
    const matchesClass = selectedClass === null || rowClass === selectedClass;
    return matchesSearch && matchesClass;
  });

  const toggleSort = (key: SortKey) => {
    setSort((current) => {
      if (!current || current.key !== key) return { key, direction: "asc" };
      if (current.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };

  const sortRows = (items: PositionRow[]): PositionRow[] => {
    if (!sort) {
      return items;
    }
    const { key, direction } = sort;
    return [...items].sort((a, b) => {
      let cmp = 0;
      if (key === "ticker") cmp = a.ticker.localeCompare(b.ticker);
      else if (key === "quantity") cmp = a.quantity - b.quantity;
      else if (key === "price") cmp = a.priceBRL - b.priceBRL;
      else if (key === "averageCost") {
        const costA = a.totalCostBRL ?? a.totalCost ?? a.averageCost;
        const costB = b.totalCostBRL ?? b.totalCost ?? b.averageCost;
        cmp = costA - costB;
      }
      else if (key === "value") cmp = a.valueBRL - b.valueBRL;
      else if (key === "pct") cmp = a.pct - b.pct;
      else if (key === "unrealizedPct") {
        const aVal = a.totalReturnPct ?? a.unrealizedPct ?? -Infinity;
        const bVal = b.totalReturnPct ?? b.unrealizedPct ?? -Infinity;
        cmp = aVal - bVal;
      }
      else if (key === "maturityDate") {
        const dateA = a.fixedIncomeMetadata?.maturity_date || a.maturityDate || "";
        const dateB = b.fixedIncomeMetadata?.maturity_date || b.maturityDate || "";
        cmp = dateA.localeCompare(dateB);
      }
      return direction === "asc" ? cmp : -cmp;
    });
  };

  const sortedRows = sortRows(filteredRows);

  const isGroupedMode = selectedClass === null;

  // Agrupamento por classe
  const classGroups: ClassGroup[] = (() => {
    if (!isGroupedMode) return [];
    const groupsMap = new Map<string, PositionRow[]>();
    for (const row of filteredRows) {
      const cls = row.assetClass || "Outros";
      const list = groupsMap.get(cls) ?? [];
      list.push(row);
      groupsMap.set(cls, list);
    }

    const groups: ClassGroup[] = [];
    for (const [className, groupRows] of groupsMap.entries()) {
      const totalValueBRL = groupRows.reduce((sum, r) => sum + r.valueBRL, 0);
      const totalPct = groupRows.reduce((sum, r) => sum + r.pct, 0);
      const totalPnl = groupRows.reduce((sum, r) => sum + r.unrealizedPnl, 0);
      const totalDividends = groupRows.reduce((sum, r) => sum + (r.dividends ?? 0), 0);
      const totalCostBRL = groupRows.reduce((sum, r) => {
        const cost = r.totalCostBRL ?? r.totalCost ?? (r.valueBRL - r.unrealizedPnl);
        return sum + Math.max(0, cost);
      }, 0);
      const unrealizedPct = totalCostBRL > 0 ? (totalPnl / totalCostBRL) * 100 : null;
      const totalReturnPnl = Math.round((totalPnl + totalDividends) * 100) / 100;
      const totalReturnPct = totalCostBRL > 0 ? (totalReturnPnl / totalCostBRL) * 100 : null;

      groups.push({
        className,
        rows: sortRows(groupRows),
        totalValueBRL,
        totalPct,
        totalPnl,
        totalCostBRL,
        totalDividends,
        totalReturnPnl,
        totalReturnPct,
        unrealizedPct,
        count: groupRows.length,
      });
    }

    // Se houver ordenação ativa, ordena os grupos de acordo com a primeira linha de cada grupo
    if (sort) {
      const { key, direction } = sort;
      groups.sort((a, b) => {
        const firstA = a.rows[0];
        const firstB = b.rows[0];
        if (!firstA || !firstB) return 0;
        let cmp = 0;
        if (key === "ticker") cmp = firstA.ticker.localeCompare(firstB.ticker);
        else if (key === "quantity") cmp = firstA.quantity - firstB.quantity;
        else if (key === "price") cmp = firstA.priceBRL - firstB.priceBRL;
        else if (key === "averageCost") {
          const costA = firstA.totalCostBRL ?? firstA.totalCost ?? firstA.averageCost;
          const costB = firstB.totalCostBRL ?? firstB.totalCost ?? firstB.averageCost;
          cmp = costA - costB;
        }
        else if (key === "value") cmp = firstA.valueBRL - firstB.valueBRL;
        else if (key === "pct") cmp = firstA.pct - firstB.pct;
        else if (key === "unrealizedPct") {
          const aVal = firstA.totalReturnPct ?? firstA.unrealizedPct ?? -Infinity;
          const bVal = firstB.totalReturnPct ?? firstB.unrealizedPct ?? -Infinity;
          cmp = aVal - bVal;
        }
        else if (key === "maturityDate") {
          const dateA = firstA.fixedIncomeMetadata?.maturity_date || firstA.maturityDate || "";
          const dateB = firstB.fixedIncomeMetadata?.maturity_date || firstB.maturityDate || "";
          cmp = dateA.localeCompare(dateB);
        }
        return direction === "asc" ? cmp : -cmp;
      });
    }

    return groups;
  })();

  const totalPages = pageSize === Infinity ? 1 : Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedFlatRows =
    pageSize === Infinity
      ? sortedRows
      : sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const headerFor = (key: SortKey, label: string): ReactNode =>
    sortable ? (
      <SortableHeader
        label={label}
        active={sort?.key === key}
        direction={sort?.direction ?? "asc"}
        onClick={() => toggleSort(key)}
      />
    ) : (
      label
    );

  type ColumnDef = {
    key: string;
    header: ReactNode;
    align?: "left" | "right";
    className?: string;
    cell: (row: PositionRow) => ReactNode;
  };

  const tickerCell = (row: PositionRow) => {
    const rfLabel = row.isMatured
      ? "Vencido"
      : row.fixedIncomeMetadata && row.fixedIncomeMetadata.rate_value > 0
        ? row.fixedIncomeMetadata.rate_type === "cdi"
          ? `${row.fixedIncomeMetadata.rate_value}% CDI`
          : row.fixedIncomeMetadata.rate_type === "selic"
            ? `${row.fixedIncomeMetadata.rate_value}% Selic`
            : row.fixedIncomeMetadata.rate_type === "pre"
              ? `${row.fixedIncomeMetadata.rate_value}% a.a.`
              : `IPCA + ${row.fixedIncomeMetadata.rate_value}%`
        : null;

    return handleOpen ? (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleOpen(row.assetId, row.ticker);
        }}
        className="group inline-flex min-w-0 flex-col gap-0.5 rounded-md px-1.5 py-1 -ml-1.5 text-left transition-colors hover:bg-surface-hover/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
        aria-label={`Ver detalhes de ${row.ticker}`}
        title={`Ver detalhes de ${row.ticker}`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="truncate font-mono text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
            {row.ticker}
          </span>
          {rfLabel && (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold shrink-0",
                row.isMatured
                  ? "bg-destructive/10 text-critical-strong"
                  : "bg-surface-hover/80 text-muted-foreground",
              )}
            >
              {rfLabel}
            </span>
          )}
        </div>
      </button>
    ) : (
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate font-mono text-sm font-semibold text-foreground">{row.ticker}</span>
        {rfLabel && (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-semibold shrink-0",
              row.isMatured
                ? "bg-destructive/10 text-critical-strong"
                : "bg-surface-hover/80 text-muted-foreground",
            )}
          >
            {rfLabel}
          </span>
        )}
      </div>
    );
  };

  /** Colunas para Renda Fixa e Tesouro Direto */
  const fixedIncomeColumns: ColumnDef[] = [
    {
      key: "ticker",
      header: headerFor("ticker", "Ativo"),
      className: "flex-[1.4]",
      cell: tickerCell,
    },
    {
      key: "averageCost",
      header: headerFor("averageCost", "Valor Aplicado"),
      align: "right",
      className: "flex-1",
      cell: (row) => {
        const appliedCost = row.totalCostBRL ?? row.totalCost ?? row.averageCost;
        return (
          <MoneyText
            cents={numberToCents(appliedCost)}
            currency={row.currency}
            tone="default"
            className="text-muted-foreground"
          />
        );
      },
    },
    {
      key: "value",
      header: headerFor("value", "Saldo Atual"),
      align: "right",
      className: "flex-1",
      cell: (row) => {
        const hasActiveRate = Boolean(row.fixedIncomeMetadata?.rate_value && row.fixedIncomeMetadata.rate_value > 0);
        const isManual = row.source === "manual" || !hasActiveRate;
        const isFallback = row.source === "fallback" && hasActiveRate;
        const valueCents = numberToCents(row.valueBRL);

        const tooltipTitle =
          row.fixedIncomeResult && row.fixedIncomeResult.businessDaysAccrued > 0
            ? `Saldo projetado (+${row.fixedIncomeResult.businessDaysAccrued}d úteis desde ${formatDateBR(row.fixedIncomeMetadata?.base_date ?? "")}) — clique para calibrar`
            : "Calibrar saldo com extrato oficial";

        if (onCalibrateAsset) {
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCalibrateAsset(row.assetId, row.ticker, valueCents);
              }}
              aria-label={`Calibrar saldo de ${row.ticker}`}
              className="group inline-flex items-center justify-end gap-1.5 rounded-md px-1.5 py-0.5 -mr-1.5 transition-colors hover:bg-surface-hover/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
              title={tooltipTitle}
            >
              <MoneyText
                cents={valueCents}
                tone="default"
                className="group-hover:text-primary transition-colors text-sm font-semibold text-foreground"
              />
              {isManual ? (
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-portfolio shrink-0 ring-2 ring-portfolio/25"
                  title="Saldo cadastrado manual"
                />
              ) : isFallback ? (
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-warning-strong shrink-0 ring-2 ring-warning-strong/25"
                  title="Saldo estimado na curva"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="size-1 rounded-full bg-muted-foreground/30 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              )}
            </button>
          );
        }

        if (onSetManualPrice) {
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSetManualPrice(
                  row.assetId,
                  row.ticker,
                  row.currency,
                  row.priceBRL,
                  row.source,
                  row.priceQuote,
                  row.pricingMode,
                  row.usdRate,
                );
              }}
              aria-label={`Saldo de ${row.ticker}`}
              className="group inline-flex items-center justify-end gap-1.5 rounded-md px-1.5 py-0.5 -mr-1.5 transition-colors hover:bg-surface-hover/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
              title={`${PRICE_SOURCE_LABEL[row.source].title} — clique para alterar`}
            >
              <MoneyText
                cents={valueCents}
                tone="default"
                className="group-hover:text-primary transition-colors text-sm font-semibold text-foreground"
              />
              {isManual ? (
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-portfolio shrink-0 ring-2 ring-portfolio/25"
                  title="Saldo cadastrado manual"
                />
              ) : isFallback ? (
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-warning-strong shrink-0 ring-2 ring-warning-strong/25"
                  title="Saldo estimado na curva"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="size-1 rounded-full bg-muted-foreground/30 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              )}
            </button>
          );
        }

        return <MoneyText cents={valueCents} tone="default" className="text-sm font-semibold text-foreground" />;
      },
    },
    {
      key: "unrealizedPnl",
      header: "Rendimento",
      align: "right",
      className: "flex-1",
      cell: (row) => <MoneyText cents={numberToCents(row.unrealizedPnl)} tone="auto" sign="explicit" />,
    },
    {
      key: "unrealizedPct",
      header: headerFor("unrealizedPct", "Rentab."),
      align: "right",
      className: "flex-1",
      cell: (row) => {
        const effectivePct = row.totalReturnPct !== undefined ? row.totalReturnPct : row.unrealizedPct;
        if (effectivePct === null) {
          return <span className="num text-sm text-muted-foreground">—</span>;
        }
        const tone = effectivePct >= 0 ? "positive" : "negative";
        return (
          <span
            className={cn(
              "num text-sm font-semibold",
              tone === "positive" ? "text-positive-strong" : "text-negative-strong",
            )}
          >
            {formatSignedPct(effectivePct)}
          </span>
        );
      },
    },
    {
      key: "maturityDate",
      header: headerFor("maturityDate", "Vencimento"),
      align: "right",
      className: "flex-1",
      cell: (row) => {
        const rawDate = row.fixedIncomeMetadata?.maturity_date || row.maturityDate;
        if (!rawDate) {
          return <span className="num text-sm text-muted-foreground">—</span>;
        }
        return (
          <span
            className={cn(
              "num text-sm font-medium",
              row.isMatured ? "text-critical-strong font-semibold" : "text-muted-foreground",
            )}
          >
            {formatDateBR(rawDate)}
          </span>
        );
      },
    },
  ];

  /** Colunas para Renda Variável (Ações, FIIs, ETFs, BDRs, Internacional, Cripto) */
  const variableIncomeColumns: ColumnDef[] = [
    {
      key: "ticker",
      header: headerFor("ticker", "Ativo"),
      className: "flex-[1.4]",
      cell: tickerCell,
    },
    {
      key: "quantity",
      header: headerFor("quantity", "Quantidade"),
      align: "right",
      className: "flex-1",
      cell: (row) => (
        <span className="num text-sm text-muted-foreground">
          {row.quantity === 0 ? (
            <span className="inline-flex items-center rounded-md bg-surface-hover/70 border border-border/60 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              Zerada
            </span>
          ) : (
            formatQuantity(row.quantity)
          )}
        </span>
      ),
    },
    {
      key: "price",
      header: headerFor("price", "Preço"),
      align: "right",
      className: "flex-1",
      cell: (row) => {
        const isManual = row.source === "manual";
        const isFallback = row.source === "fallback";

        if (onSetManualPrice) {
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSetManualPrice(
                  row.assetId,
                  row.ticker,
                  row.currency,
                  row.priceBRL,
                  row.source,
                  row.priceQuote,
                  row.pricingMode,
                  row.usdRate,
                );
              }}
              aria-label={`Cotação de ${row.ticker}`}
              className="group inline-flex items-center justify-end gap-1.5 rounded-md px-1.5 py-0.5 -mr-1.5 transition-colors hover:bg-surface-hover/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
              title={`${PRICE_SOURCE_LABEL[row.source].title} — clique para alterar`}
            >
              <MoneyText
                cents={numberToCents(row.priceBRL)}
                tone="default"
                className="group-hover:text-primary transition-colors text-sm"
              />
              {isManual ? (
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-portfolio shrink-0 ring-2 ring-portfolio/25"
                />
              ) : isFallback ? (
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-warning-strong shrink-0 ring-2 ring-warning-strong/25"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="size-1 rounded-full bg-muted-foreground/30 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              )}
            </button>
          );
        }

        return (
          <div className="inline-flex items-center justify-end gap-1.5">
            <MoneyText cents={numberToCents(row.priceBRL)} tone="default" className="text-sm" />
            {isManual ? (
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-portfolio shrink-0 ring-2 ring-portfolio/25"
                title="Preço manual"
              />
            ) : isFallback ? (
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-warning-strong shrink-0 ring-2 ring-warning-strong/25"
                title="Preço estimado (fallback)"
              />
            ) : null}
          </div>
        );
      },
    },
    {
      key: "averageCost",
      header: headerFor("averageCost", "Custo médio"),
      align: "right",
      className: "flex-1",
      cell: (row) => (
        <MoneyText cents={numberToCents(row.averageCost)} currency={row.currency} tone="default" className="text-muted-foreground" />
      ),
    },
    {
      key: "value",
      header: headerFor("value", "Valor"),
      align: "right",
      className: "flex-1",
      cell: (row) => <MoneyText cents={numberToCents(row.valueBRL)} tone="default" />,
    },
    {
      key: "unrealizedPnl",
      header: "Lucro/Prejuízo",
      align: "right",
      className: "flex-1",
      cell: (row) => <MoneyText cents={numberToCents(row.unrealizedPnl)} tone="auto" sign="explicit" />,
    },
    {
      key: "unrealizedPct",
      header: headerFor("unrealizedPct", "Rentab."),
      align: "right",
      className: "flex-1",
      cell: (row) => {
        const effectivePct = row.totalReturnPct !== undefined ? row.totalReturnPct : row.unrealizedPct;
        if (effectivePct === null) {
          return <span className="num text-sm text-muted-foreground">—</span>;
        }
        const tone = effectivePct >= 0 ? "positive" : "negative";
        const yoc = (row.dividends && row.dividends > 0)
          ? calculateYieldOnCost(row.dividends, row.totalCostBRL ?? row.totalCost ?? 0)
          : 0;

        return (
          <div className="flex flex-col items-end gap-0.5">
            <span
              className={cn(
                "num text-sm font-semibold",
                tone === "positive" ? "text-positive-strong" : "text-negative-strong",
              )}
              title={
                row.totalReturnPct !== undefined && row.unrealizedPct !== null
                  ? `Retorno Total: ${formatSignedPct(effectivePct)} (Cotação: ${formatSignedPct(row.unrealizedPct)}${yoc > 0 ? ` + Proventos/YoC: ${yoc.toFixed(1)}%` : ""})`
                  : undefined
              }
            >
              {formatSignedPct(effectivePct)}
            </span>
            {yoc > 0 ? (
              <div className="flex items-center gap-1.5 text-[10px]">
                {row.unrealizedPct !== null ? (
                  <span
                    className={cn(
                      "font-medium",
                      row.unrealizedPct >= 0 ? "text-positive-strong" : "text-negative-strong",
                    )}
                    title={`Variação da cotação: ${formatSignedPct(row.unrealizedPct)}`}
                  >
                    Cota {formatSignedPct(row.unrealizedPct)}
                  </span>
                ) : null}
                <span
                  className="text-portfolio font-medium"
                  title={`Yield on Cost acumulado: ${formatCentsAsBRL(numberToCents(row.dividends ?? 0))}`}
                >
                  YoC {yoc.toFixed(1)}%
                </span>
              </div>
            ) : null}
          </div>
        );
      },
    },
  ];

  const getColumnsForClass = (className: string | null): ColumnDef[] => {
    if (isFixedIncomeClass(className)) {
      return fixedIncomeColumns;
    }
    return variableIncomeColumns;
  };

  const renderMobileCard = (row: PositionRow) => {
    const effectivePct = row.totalReturnPct !== undefined ? row.totalReturnPct : row.unrealizedPct;
    const pctLabel =
      row.isCash || effectivePct === null
        ? "—"
        : formatSignedPct(effectivePct);
    const pctTone =
      row.isCash || effectivePct === null
        ? "text-muted-foreground"
        : effectivePct >= 0
          ? "text-positive-strong"
          : "text-negative-strong";
    const yoc = (row.dividends && row.dividends > 0)
      ? calculateYieldOnCost(row.dividends, row.totalCostBRL ?? row.totalCost ?? 0)
      : 0;
    const isClickable = Boolean(handleOpen);

    return (
      <li
        key={row.assetId}
        id={`asset-card-${row.assetId}`}
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : undefined}
        aria-label={isClickable ? `Ver detalhes de ${row.ticker}` : undefined}
        onClick={isClickable ? () => handleOpen?.(row.assetId, row.ticker) : undefined}
        onKeyDown={
          isClickable
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleOpen?.(row.assetId, row.ticker);
                }
              }
            : undefined
        }
        className={cn(
          "flex flex-col gap-2.5 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs transition-colors scroll-mt-24",
          highlightId === row.assetId && "bg-primary/10 ring-2 ring-primary shadow-xs",
          isClickable && "cursor-pointer hover:bg-surface-hover active:scale-[0.99] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        )}
      >
        {/* Linha 1: Ticker | Valor Total, Rentabilidade e YoC */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="truncate font-mono text-base font-bold text-foreground">{row.ticker}</span>
            {row.isMatured ? (
              <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-critical-strong shrink-0">
                Vencido
              </span>
            ) : row.fixedIncomeMetadata ? (
              <span className="rounded bg-surface-hover/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
                {row.fixedIncomeMetadata.rate_type === "cdi"
                  ? `${row.fixedIncomeMetadata.rate_value}% CDI`
                  : row.fixedIncomeMetadata.rate_type === "selic"
                    ? `${row.fixedIncomeMetadata.rate_value}% Selic`
                    : row.fixedIncomeMetadata.rate_type === "pre"
                      ? `${row.fixedIncomeMetadata.rate_value}% a.a.`
                      : `IPCA + ${row.fixedIncomeMetadata.rate_value}%`}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex flex-col items-end gap-0.5">
              <div className="flex items-center gap-1.5">
                {row.pricingMode !== "total_value" && (
                  <MoneyText cents={numberToCents(row.valueBRL)} tone="default" className="text-sm font-bold text-foreground" />
                )}
                <span className={cn("num text-xs font-bold px-1.5 py-0.5 rounded", pctTone, effectivePct !== null && effectivePct >= 0 ? "bg-positive/10" : "bg-negative/10")}>
                  {pctLabel}
                </span>
              </div>
              {yoc > 0 ? (
                <div className="flex items-center gap-1.5 text-[10px]">
                  {row.unrealizedPct !== null ? (
                    <span
                      className={cn(
                        "font-medium",
                        row.unrealizedPct >= 0 ? "text-positive-strong" : "text-negative-strong",
                      )}
                      title={`Variação da cotação: ${formatSignedPct(row.unrealizedPct)}`}
                    >
                      Cota {formatSignedPct(row.unrealizedPct)}
                    </span>
                  ) : null}
                  <span
                    className="text-portfolio font-medium"
                    title={`Yield on Cost acumulado: ${formatCentsAsBRL(numberToCents(row.dividends ?? 0))}`}
                  >
                    YoC {yoc.toFixed(1)}%
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Linha 2: Métricas de Custódia em grid de 3 colunas legível */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-xs pt-2.5 border-t border-border/50">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium truncate">
              {row.pricingMode === "total_value" ? "Preço Inicial" : "Quantidade"}
            </span>
            <span className="font-semibold text-foreground truncate">
              {row.isCash ? (
                "—"
              ) : row.pricingMode === "total_value" ? (
                <MoneyText cents={numberToCents(row.totalCostBRL ?? row.totalCost ?? row.averageCost)} currency={row.currency} tone="default" />
              ) : (
                formatQuantity(row.quantity)
              )}
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium truncate">
              {row.pricingMode === "total_value" ? "Saldo Atual" : "Preço"}
            </span>
            {row.isCash ? (
              <span className="font-semibold text-foreground">1:1</span>
            ) : row.pricingMode === "total_value" && onCalibrateAsset ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCalibrateAsset(row.assetId, row.ticker, numberToCents(row.valueBRL));
                }}
                aria-label={`Calibrar saldo de ${row.ticker}`}
                className="inline-flex items-center gap-1 font-semibold text-foreground cursor-pointer text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded truncate"
                title="Calibrar saldo com extrato oficial"
              >
                <MoneyText cents={numberToCents(row.valueBRL)} tone="default" />
                {row.source === "manual" || !row.fixedIncomeMetadata?.rate_value || row.fixedIncomeMetadata.rate_value <= 0 ? (
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-portfolio shrink-0 ring-2 ring-portfolio/25"
                    title="Saldo cadastrado manual"
                  />
                ) : null}
              </button>
            ) : onSetManualPrice ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetManualPrice(
                    row.assetId,
                    row.ticker,
                    row.currency,
                    row.priceBRL,
                    row.source,
                    row.priceQuote,
                    row.pricingMode,
                    row.usdRate,
                  );
                }}
                aria-label={`Cotação de ${row.ticker}`}
                className="inline-flex items-center gap-1 font-semibold text-foreground cursor-pointer text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded truncate"
              >
                <MoneyText cents={numberToCents(row.priceBRL)} tone="default" />
                {row.source === "manual" ? (
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-portfolio shrink-0 ring-2 ring-portfolio/25"
                    title="Preço manual"
                  />
                ) : null}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-foreground truncate">
                <MoneyText cents={numberToCents(row.priceBRL)} tone="default" />
                {row.source === "manual" ? (
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-portfolio shrink-0 ring-2 ring-portfolio/25"
                    title="Preço manual"
                  />
                ) : null}
              </span>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium truncate">Lucro/Prejuízo</span>
            {row.isCash ? (
              <span className="font-semibold text-muted-foreground">—</span>
            ) : (
              <MoneyText cents={numberToCents(row.unrealizedPnl)} tone="auto" sign="explicit" className="font-semibold truncate" />
            )}
          </div>
        </div>
      </li>
    );
  };

  const renderDesktopHeader = (isSubHeader = false, classCols = variableIncomeColumns) => (
    <div
      role="row"
      className={cn(
        "flex items-center gap-3 px-4 py-2 border-b border-border/70",
        isSubHeader ? "bg-surface-hover/30 text-muted-foreground/90" : "bg-surface text-muted-foreground",
      )}
    >
      {classCols.map((col) => (
        <div
          key={col.key}
          role="columnheader"
          className={cn(
            "text-xs font-semibold uppercase tracking-wide",
            col.className ?? "flex-1",
            col.align === "right" ? "text-right" : "text-left",
          )}
        >
          {col.header}
        </div>
      ))}
    </div>
  );

  const renderDesktopRow = (row: PositionRow, classCols = variableIncomeColumns) => {
    const isClickable = Boolean(handleOpen);
    return (
      <div
        key={row.assetId}
        id={`asset-row-${row.assetId}`}
        role="row"
        tabIndex={isClickable ? 0 : undefined}
        onClick={isClickable ? () => handleOpen?.(row.assetId, row.ticker) : undefined}
        onKeyDown={
          isClickable
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleOpen?.(row.assetId, row.ticker);
                }
              }
            : undefined
        }
        className={cn(
          "flex items-center gap-3 border-b border-border/60 px-4 py-2.5 sm:py-2 transition-colors last:border-b-0 scroll-mt-24",
          highlightId === row.assetId && "bg-primary/10 ring-2 ring-primary ring-inset shadow-xs",
          isClickable &&
            "cursor-pointer hover:bg-muted/60 active:bg-muted/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset",
        )}
      >
        {classCols.map((col) => (
          <div
            key={col.key}
            role="cell"
            className={cn(
              "text-sm text-foreground",
              col.className ?? "flex-1",
              col.align === "right" ? "text-right" : "text-left",
            )}
          >
            {col.cell(row)}
          </div>
        ))}
      </div>
    );
  };

  const hasFiltersActive = search.trim() !== "" || selectedClass !== null;

  return (
    <div ref={containerRef} className="flex flex-col gap-3">
      {rows.length > 0 ? (
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between min-w-0">
          <div className="relative flex-1 w-full min-w-0">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Buscar por ticker ou classe…"
              aria-label="Buscar ativo"
              className={cn("pl-8 w-full", hasFiltersActive ? "pr-24" : "pr-8")}
            />
            {hasFiltersActive ? (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                <span className="text-[11px] font-medium text-muted-foreground bg-surface-hover/80 px-1.5 py-0.5 rounded border border-border/40">
                  {filteredRows.length}/{rows.length}
                </span>
                {search ? (
                  <button
                    type="button"
                    onClick={() => handleSearchChange("")}
                    aria-label="Limpar busca"
                    className="pointer-events-auto text-muted-foreground hover:text-foreground cursor-pointer p-0.5 transition-colors"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 shrink-0">
            {availableClasses.length > 1 ? (
              <div className="flex flex-wrap items-center gap-1.5 shrink-0 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => handleClassChange(null)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer shrink-0",
                    selectedClass === null
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "bg-surface-hover/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  Todas
                </button>
                {availableClasses.map((cls) => {
                  const isSelected = selectedClass === cls;
                  return (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => handleClassChange(isSelected ? null : cls)}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer shrink-0",
                        isSelected
                          ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "bg-surface-hover/60 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {cls}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {closedRows.length > 0 ? (
              <button
                type="button"
                onClick={() => setHideClosed(!hideClosed)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer shrink-0 border",
                  !hideClosed
                    ? "bg-surface border-primary/50 text-foreground font-semibold shadow-xs"
                    : "bg-surface-hover/60 border-border/60 text-muted-foreground hover:text-foreground",
                )}
                title={hideClosed ? "Exibir posições zeradas/encerradas" : "Ocultar posições zeradas/encerradas"}
              >
                <span>{hideClosed ? "Ver encerradas" : "Ocultar encerradas"}</span>
                <Badge variant="muted" size="xs">
                  {closedRows.length}
                </Badge>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Visão Mobile (sempre presente para telas < sm) */}
      <ul aria-label="Posições (visão móvel)" className="flex flex-col gap-2.5 sm:hidden">
        {filteredRows.length === 0 ? (
          <li className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
            {hasFiltersActive ? "Nenhum ativo encontrado para os filtros selecionados." : emptyMessage ?? "Nenhum ativo na carteira."}
          </li>
        ) : isGroupedMode && classGroups.length > 0 ? (
          classGroups.map((group) => {
            const isExpanded = isClassExpanded(group.className);
            const meta = getAssetClassMeta(group.className);
            const Icon = meta.icon;
            const groupRentab = group.totalReturnPct !== null ? group.totalReturnPct : group.unrealizedPct;
            const rentabTone =
              groupRentab === null
                ? "text-muted-foreground"
                : groupRentab >= 0
                  ? "text-positive-strong"
                  : "text-negative-strong";

            return (
              <li
                key={group.className}
                className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3 shadow-xs"
              >
                {/* Cabeçalho de Categoria Mobile */}
                <button
                  type="button"
                  onClick={() => toggleClassCollapse(group.className)}
                  aria-expanded={isExpanded}
                  aria-label={`Classe ${group.className}, ${group.count} ativos, total de ${group.totalValueBRL} reais`}
                  className="flex w-full items-center justify-between gap-2 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-lg"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md border", meta.badgeClass)}>
                      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                    </span>
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="truncate text-sm font-bold text-foreground">{group.className}</span>
                      <span className="text-xs text-muted-foreground">({group.count})</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1">
                        <MoneyText cents={numberToCents(group.totalValueBRL)} tone="default" className="text-xs font-bold text-foreground" />
                        <span className="text-[11px] text-muted-foreground">({group.totalPct.toFixed(1)}%)</span>
                      </div>
                      {groupRentab !== null ? (
                        <span className={cn("text-[10px] font-bold", rentabTone)}>
                          {formatSignedPct(groupRentab)}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-muted-foreground">
                      {isExpanded ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
                    </span>
                  </div>
                </button>

                {isExpanded ? (
                  <ul className="flex flex-col gap-2 pt-2 border-t border-border/40">
                    {group.rows.map(renderMobileCard)}
                  </ul>
                ) : null}
              </li>
            );
          })
        ) : (
          paginatedFlatRows.map(renderMobileCard)
        )}
      </ul>

      {/* Visão Desktop (Tabela sm+) */}
      <div className="hidden sm:block">
        <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
          <div className="min-w-full">
            {/* Conteúdo da Tabela Desktop */}
            {filteredRows.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                {hasFiltersActive ? "Nenhum ativo encontrado para os filtros selecionados." : emptyMessage ?? "Nenhum ativo na carteira."}
              </div>
            ) : isGroupedMode && classGroups.length > 0 ? (
              classGroups.map((group) => {
                const isExpanded = isClassExpanded(group.className);
                const meta = getAssetClassMeta(group.className);
                const Icon = meta.icon;
                const groupRentab = group.totalReturnPct !== null ? group.totalReturnPct : group.unrealizedPct;
                const rentabTone =
                  groupRentab === null
                    ? "text-muted-foreground"
                    : groupRentab >= 0
                      ? "text-positive-strong"
                      : "text-negative-strong";
                const groupColumns = getColumnsForClass(group.className);

                return (
                  <div key={group.className} className="border-b border-border/60 last:border-b-0">
                    {/* Linha Cabeçalho de Categoria */}
                    <button
                      type="button"
                      onClick={() => toggleClassCollapse(group.className)}
                      aria-expanded={isExpanded}
                      aria-label={`Classe ${group.className}, ${group.count} ativos, total de ${group.totalValueBRL} reais`}
                      className="flex w-full items-center justify-between gap-3 bg-surface-hover/50 px-4 py-3 text-left transition-colors hover:bg-surface-hover cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring border-y border-border/40 first:border-t-0"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={cn("flex size-5 shrink-0 items-center justify-center rounded border", meta.badgeClass)}>
                          <Icon className="size-3 shrink-0" aria-hidden="true" />
                        </span>
                        <span className="truncate text-xs font-bold uppercase tracking-wider text-foreground">
                          {group.className}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          ({group.count} {group.count === 1 ? "ativo" : "ativos"})
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 text-xs">
                            <MoneyText cents={numberToCents(group.totalValueBRL)} tone="default" className="font-bold text-foreground" />
                            <span className="text-muted-foreground">({group.totalPct.toFixed(1)}%)</span>
                          </div>
                          {groupRentab !== null ? (
                            <span className={cn("text-[11px] font-semibold px-1.5 py-0.5 rounded", rentabTone, groupRentab >= 0 ? "bg-positive/10" : "bg-negative/10")}>
                              {formatSignedPct(groupRentab)}
                            </span>
                          ) : null}
                        </div>
                        <span className="text-muted-foreground">
                          {isExpanded ? <ChevronDown className="size-3.5" aria-hidden="true" /> : <ChevronRight className="size-3.5" aria-hidden="true" />}
                        </span>
                      </div>
                    </button>

                    {/* Cabeçalho e Linhas dos Ativos da Categoria quando expandida */}
                    {isExpanded ? (
                      <div className="bg-surface/50 border-t border-border/50">
                        {renderDesktopHeader(true, groupColumns)}
                        {group.rows.map((row) => renderDesktopRow(row, groupColumns))}
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              (() => {
                const flatColumns = getColumnsForClass(selectedClass);
                return (
                  <>
                    {renderDesktopHeader(false, flatColumns)}
                    {paginatedFlatRows.map((row) => renderDesktopRow(row, flatColumns))}
                  </>
                );
              })()
            )}
          </div>
        </div>
      </div>

      {/* Paginação para carteiras com muitos ativos no modo lista plana (quando filtrado por classe individual) */}
      {!isGroupedMode && sortedRows.length > 5 ? (
        <div className="flex items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span>
              Exibindo <strong className="text-foreground font-medium">{Math.min((currentPage - 1) * pageSize + 1, sortedRows.length)}–{Math.min(currentPage * pageSize, sortedRows.length)}</strong> de {sortedRows.length} ativos
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Seletor 'Por página' exibido apenas no desktop */}
            <div className="hidden sm:flex items-center gap-1">
              <span className="text-[11px]">Por página:</span>
              {[10, 25].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    setPageSize(size);
                    setPage(1);
                  }}
                  className={cn(
                    "px-2 py-0.5 rounded text-xs transition-colors cursor-pointer",
                    pageSize === size ? "bg-surface-hover font-semibold text-foreground" : "hover:text-foreground",
                  )}
                >
                  {size}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setPageSize(Infinity);
                  setPage(1);
                }}
                className={cn(
                  "px-2 py-0.5 rounded text-xs transition-colors cursor-pointer",
                  pageSize === Infinity ? "bg-surface-hover font-semibold text-foreground" : "hover:text-foreground",
                )}
              >
                Todos
              </button>
            </div>

            {pageSize !== Infinity && totalPages > 1 ? (
              <div className="flex items-center gap-1.5 sm:border-l sm:border-border/60 sm:pl-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => {
                    setPage((p) => Math.max(1, p - 1));
                    scrollToTop();
                  }}
                  className="size-7 p-0"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="size-3.5" aria-hidden="true" />
                </Button>
                <span className="text-xs px-1.5 font-medium text-foreground">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => {
                    setPage((p) => Math.min(totalPages, p + 1));
                    scrollToTop();
                  }}
                  className="size-7 p-0"
                  aria-label="Próxima página"
                >
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Seção colapsável de Posições Encerradas / Histórico */}
      {closedRows.length > 0 && hideClosed ? (
        <div className="mt-2 rounded-xl border border-dashed border-border/80 bg-surface-hover/20 p-3.5 transition-all">
          <button
            type="button"
            onClick={() => setClosedSectionOpen(!closedSectionOpen)}
            className="flex w-full items-center justify-between gap-2 text-left cursor-pointer group"
            aria-expanded={closedSectionOpen}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Archive className="size-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" aria-hidden="true" />
              <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors truncate">
                Posições Encerradas ({closedRows.length} {closedRows.length === 1 ? "ativo liquidado" : "ativos liquidados"})
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground shrink-0">
              <span>{closedSectionOpen ? "Recolher" : "Expandir histórico"}</span>
              <ChevronDown className={cn("size-3.5 transition-transform duration-200", closedSectionOpen && "rotate-180")} aria-hidden="true" />
            </div>
          </button>

          {closedSectionOpen ? (
            <div className="mt-3 divide-y divide-border/60 pt-2 border-t border-border/60">
              {closedRows.map((row) => (
                <div
                  key={row.assetId}
                  onClick={() => handleOpen?.(row.assetId, row.ticker)}
                  className="flex items-center justify-between py-2.5 px-1 hover:bg-surface-hover/40 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-sm font-semibold text-foreground">{row.ticker}</span>
                    <Badge variant="muted" size="xs">Encerrada</Badge>
                    {row.assetClass ? <span className="text-xs text-muted-foreground truncate">({row.assetClass})</span> : null}
                  </div>
                  <div className="flex items-center gap-3 text-right shrink-0">
                    {row.dividends && row.dividends > 0 ? (
                      <span className="text-xs text-positive-strong">
                        Proventos: <MoneyText cents={numberToCents(row.dividends)} tone="positive" />
                      </span>
                    ) : null}
                    <span className="text-xs text-muted-foreground">Saldo: R$ 0,00</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
