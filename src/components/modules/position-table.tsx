import { useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataList } from "@/components/ui/data-list";
import { Input } from "@/components/ui/input";
import { MoneyText } from "@/components/ui/money-text";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { numberToCents } from "@/domain/money";
import { calculateYieldOnCost } from "@/domain/portfolio";
import type { PriceSource } from "@/domain/portfolio";
import { useDensity } from "@/hooks/use-density";
import { cn } from "@/lib/utils";
import { formatSignedPct } from "@/services/masks/percent";
import type { AssetCurrency } from "@/types";

export interface PositionRow {
  assetId: string;
  ticker: string;
  assetClass: string | null;
  currency: AssetCurrency;
  quantity: number;
  averageCost: number;
  totalCost?: number;
  totalCostBRL?: number;
  averageCostBRL?: number;
  dividends?: number;
  priceBRL: number;
  source: PriceSource;
  valueBRL: number;
  pct: number;
  /** Lucro/prejuízo não realizado em BRL (valor − custo; F14). */
  unrealizedPnl: number;
  /** Rentabilidade % sobre o custo (null quando não há custo — caixa; F14). */
  unrealizedPct: number | null;
  isCash: boolean;
}

export interface PositionTableProps {
  rows: PositionRow[];
  /** Abre a lista de lançamentos / detalhes do ativo. */
  onListTransactions?: (assetId: string, ticker: string) => void;
  /** Abre o formulário de edição cadastral do ativo (ticker/classe/moeda). */
  onEditAsset?: (assetId: string, ticker: string) => void;
  /** Abre o diálogo de preço manual/cotação do ativo. */
  onSetManualPrice?: (assetId: string, ticker: string, currency: AssetCurrency, priceBRL: number, source: PriceSource) => void;
  /** Confirma a exclusão do ativo (transações e metas em cascata). */
  onDeleteAsset?: (assetId: string, ticker: string) => void;
  emptyMessage?: string;
  /**
   * F17 — ordenação por coluna clicável (aria-sort + ícone de direção).
   * Desabilitada por padrão (a Posição atual mantém a ordem do ledger).
   */
  sortable?: boolean;
}

type SortKey = "ticker" | "quantity" | "price" | "averageCost" | "value" | "unrealizedPct" | "pct";
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
        "inline-flex items-center gap-1 font-semibold text-foreground transition-colors hover:text-primary",
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
 * - Desktop (sm+): tabela completa com ordenação opcional por coluna.
 * - Mobile (<sm): lista de cards empilhados sem scroll horizontal (F28).
 * - Ações contextuais: extrato de lançamentos, edição cadastral e exclusão em cascata.
 */
export function PositionTable({
  rows,
  onListTransactions,
  onEditAsset,
  onSetManualPrice,
  onDeleteAsset,
  emptyMessage,
  sortable = false,
}: PositionTableProps) {
  const density = useDensity();
  const containerRef = useRef<HTMLDivElement>(null);
  const [sort, setSort] = useState<SortState | null>(null);
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

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
    ...new Set(rows.map((r) => (r.isCash ? "Caixa" : r.assetClass)).filter((c): c is string => Boolean(c))),
  ];

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleClassChange = (cls: string | null) => {
    setSelectedClass(cls);
    setPage(1);
  };

  const filteredRows = rows.filter((row) => {
    const rowClass = row.isCash ? "Caixa" : row.assetClass;
    const matchesSearch =
      search.trim() === "" ||
      row.ticker.toLowerCase().includes(search.toLowerCase().trim()) ||
      (row.assetClass?.toLowerCase().includes(search.toLowerCase().trim()) ?? false);
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

  const sortedRows = [...filteredRows].sort((a, b) => {
    if (!sort) return 0;
    const { key, direction } = sort;
    let cmp = 0;
    if (key === "ticker") cmp = a.ticker.localeCompare(b.ticker);
    else if (key === "quantity") cmp = a.quantity - b.quantity;
    else if (key === "price") cmp = a.priceBRL - b.priceBRL;
    else if (key === "averageCost") cmp = a.averageCost - b.averageCost;
    else if (key === "value") cmp = a.valueBRL - b.valueBRL;
    else if (key === "pct") cmp = a.pct - b.pct;
    else if (key === "unrealizedPct") {
      const aVal = a.unrealizedPct ?? -Infinity;
      const bVal = b.unrealizedPct ?? -Infinity;
      cmp = aVal - bVal;
    }
    return direction === "asc" ? cmp : -cmp;
  });

  const totalPages = pageSize === Infinity ? 1 : Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows =
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

  const columns: {
    key: string;
    header: ReactNode;
    align?: "left" | "right";
    cell: (row: PositionRow) => ReactNode;
  }[] = [
    {
      key: "ticker",
      header: headerFor("ticker", "Ativo"),
      cell: (row) => {
        const handleOpen = onListTransactions ?? onEditAsset;
        return handleOpen ? (
          <button
            type="button"
            onClick={() => handleOpen(row.assetId, row.ticker)}
            className="flex min-w-0 flex-col gap-0.5 text-left group hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:underline"
            aria-label={`Ver detalhes de ${row.ticker}`}
          >
            <span className="truncate font-mono text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{row.ticker}</span>
            {row.assetClass ? <span className="text-[11px] text-muted-foreground">{row.assetClass}</span> : null}
          </button>
        ) : (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-mono text-sm font-semibold text-foreground">{row.ticker}</span>
            {row.assetClass ? <span className="text-[11px] text-muted-foreground">{row.assetClass}</span> : null}
          </div>
        );
      },
    },
    {
      key: "quantity",
      header: headerFor("quantity", "Quantidade"),
      align: "right",
      cell: (row) => (
        <span className="num text-sm text-muted-foreground">
          {row.isCash ? (
            "—"
          ) : row.quantity === 0 ? (
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
      cell: (row) => {
        if (row.isCash) {
          return <span className="num text-sm text-foreground">1:1</span>;
        }

        const isManual = row.source === "manual";
        const isFallback = row.source === "fallback";

        if (onSetManualPrice) {
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSetManualPrice(row.assetId, row.ticker, row.currency, row.priceBRL, row.source);
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
      cell: (row) =>
        row.isCash ? (
          <span className="num text-sm text-muted-foreground">—</span>
        ) : (
          <MoneyText cents={numberToCents(row.averageCost)} currency={row.currency} tone="default" className="text-muted-foreground" />
        ),
    },
    {
      key: "value",
      header: headerFor("value", "Valor"),
      align: "right",
      cell: (row) => <MoneyText cents={numberToCents(row.valueBRL)} tone="default" />,
    },
    {
      key: "unrealizedPnl",
      header: "Lucro/Prejuízo",
      align: "right",
      cell: (row) =>
        row.isCash ? (
          <span className="num text-sm text-muted-foreground">—</span>
        ) : (
          <MoneyText cents={numberToCents(row.unrealizedPnl)} tone="auto" sign="explicit" />
        ),
    },
    {
      key: "unrealizedPct",
      header: headerFor("unrealizedPct", "Rentab."),
      align: "right",
      cell: (row) => {
        if (row.isCash || row.unrealizedPct === null) {
          return <span className="num text-sm text-muted-foreground">—</span>;
        }
        const tone = row.unrealizedPct >= 0 ? "positive" : "negative";
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
            >
              {formatSignedPct(row.unrealizedPct)}
            </span>
            {yoc > 0 ? (
              <span className="text-[10px] text-portfolio font-medium" title="Yield on Cost acumulado">
                YoC {yoc.toFixed(1)}%
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "pct",
      header: headerFor("pct", "% patrimônio"),
      align: "right",
      cell: (row) => <span className="num text-sm text-muted-foreground">{row.pct.toFixed(1)}%</span>,
    },
  ];

  const hasRowActions = Boolean(
    onEditAsset || onSetManualPrice || onDeleteAsset,
  );

  if (hasRowActions) {
    columns.push({
      key: "actions",
      header: <span className="sr-only">Ações</span>,
      align: "right",
      cell: (row) => (
        <PositionRowActions
          row={row}
          onEditAsset={onEditAsset}
          onSetManualPrice={onSetManualPrice}
          onDeleteAsset={onDeleteAsset}
        />
      ),
    });
  }

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

          {availableClasses.length > 1 ? (
            <div className="flex flex-wrap items-center gap-1.5 shrink-0 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => handleClassChange(null)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer shrink-0",
                  selectedClass === null
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-hover/60 text-muted-foreground hover:text-foreground",
                )}
              >
                Todas
              </button>
              {availableClasses.map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => handleClassChange(selectedClass === cls ? null : cls)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer shrink-0",
                    selectedClass === cls
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-hover/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {cls}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <ul aria-label="Posições (visão móvel)" className="flex flex-col gap-2.5 sm:hidden">
        {paginatedRows.length === 0 ? (
          <li className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
            {hasFiltersActive ? "Nenhum ativo encontrado para os filtros selecionados." : emptyMessage ?? "Nenhum ativo na carteira."}
          </li>
        ) : (
          paginatedRows.map((row) => {
            const pctLabel =
              row.isCash || row.unrealizedPct === null
                ? "—"
                : formatSignedPct(row.unrealizedPct);
            const pctTone =
              row.isCash || row.unrealizedPct === null
                ? "text-muted-foreground"
                : row.unrealizedPct >= 0
                  ? "text-positive-strong"
                  : "text-negative-strong";
            const yoc = (row.dividends && row.dividends > 0)
              ? calculateYieldOnCost(row.dividends, row.totalCostBRL ?? row.totalCost ?? 0)
              : 0;
            const handleOpen = onListTransactions ?? onEditAsset;
            const isClickable = Boolean(handleOpen);
            return (
              <li
                key={row.assetId}
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
                  "flex flex-col gap-2.5 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs transition-colors",
                  isClickable && "cursor-pointer hover:bg-surface-hover active:scale-[0.99] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                )}
              >
                {/* Linha 1: Ticker + Classe | Valor Total, Rentabilidade, YoC e Menu de Ações */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate font-mono text-base font-bold text-foreground">{row.ticker}</span>
                    {row.assetClass ? (
                      <span className="truncate text-[11px] text-muted-foreground bg-surface-hover/80 px-2 py-0.5 rounded-md border border-border/40">
                        {row.assetClass}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <MoneyText cents={numberToCents(row.valueBRL)} tone="default" className="text-sm font-bold text-foreground" />
                        <span className={cn("num text-xs font-bold px-1.5 py-0.5 rounded", pctTone, row.unrealizedPct !== null && row.unrealizedPct >= 0 ? "bg-positive/10" : "bg-negative/10")}>
                          {pctLabel}
                        </span>
                      </div>
                      {yoc > 0 ? (
                        <span className="text-[10px] text-portfolio font-medium" title="Yield on Cost acumulado">
                          YoC {yoc.toFixed(1)}%
                        </span>
                      ) : null}
                    </div>
                    {hasRowActions ? (
                      <div className="shrink-0 -mr-1" onClick={(e) => e.stopPropagation()}>
                        <PositionRowActions
                          row={row}
                          onEditAsset={onEditAsset}
                          onSetManualPrice={onSetManualPrice}
                          onDeleteAsset={onDeleteAsset}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Linha 2: Métricas de Custódia em grid de 3 colunas legível */}
                <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-border/40">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-muted-foreground">Quantidade</span>
                    <span className="font-semibold text-foreground">{row.isCash ? "—" : formatQuantity(row.quantity)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] text-muted-foreground">Preço</span>
                    {row.isCash ? (
                      <span className="font-semibold text-foreground">1:1</span>
                    ) : onSetManualPrice ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetManualPrice(row.assetId, row.ticker, row.currency, row.priceBRL, row.source);
                        }}
                        aria-label={`Cotação de ${row.ticker}`}
                        className="inline-flex items-center gap-1 font-semibold text-foreground cursor-pointer text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
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
                      <span className="inline-flex items-center gap-1 font-semibold text-foreground">
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
                  <div className="flex flex-col">
                    <span className="text-[11px] text-muted-foreground">Lucro/Prejuízo</span>
                    {row.isCash ? (
                      <span className="font-semibold text-muted-foreground">—</span>
                    ) : (
                      <MoneyText cents={numberToCents(row.unrealizedPnl)} tone="auto" sign="explicit" className="font-semibold" />
                    )}
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>

      <div className="hidden sm:block">
        <DataList
          columns={columns}
          rows={paginatedRows}
          rowKey={(row) => row.assetId}
          density={density === "compact" ? "compact" : "comfortable"}
          emptyMessage={hasFiltersActive ? "Nenhum ativo encontrado para os filtros selecionados." : emptyMessage ?? "Nenhum ativo na carteira."}
        />
      </div>

      {/* Paginação para carteiras com muitos ativos */}
      {sortedRows.length > 5 ? (
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
    </div>
  );
}

interface PositionRowActionsProps {
  row: PositionRow;
  onEditAsset?: (assetId: string, ticker: string) => void;
  onSetManualPrice?: (assetId: string, ticker: string, currency: AssetCurrency, priceBRL: number, source: PriceSource) => void;
  onDeleteAsset?: (assetId: string, ticker: string) => void;
}

/** Ações por linha (compartilhadas entre a tabela e os cards mobile — F28) com menu contextual enxuto. */
function PositionRowActions({
  row,
  onEditAsset,
  onSetManualPrice,
  onDeleteAsset,
}: PositionRowActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const hasMenuActions = Boolean(
    onEditAsset || (!row.isCash && onSetManualPrice) || onDeleteAsset,
  );

  if (!hasMenuActions) return null;

  return (
    <div className="flex items-center justify-end">
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="size-8 p-0 text-muted-foreground hover:text-foreground"
            aria-label={`Ações de ${row.ticker}`}
            title="Mais opções deste ativo"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-48 p-1.5 flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
          {onEditAsset ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-hover transition-colors text-left cursor-pointer"
              onClick={() => {
                setMenuOpen(false);
                onEditAsset(row.assetId, row.ticker);
              }}
            >
              <Pencil className="size-3.5 text-muted-foreground" aria-hidden="true" />
              Editar cadastro
            </button>
          ) : null}

          {!row.isCash && onSetManualPrice ? (
            <button
              type="button"
              aria-label={`Cotação de ${row.ticker}`}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-hover transition-colors text-left cursor-pointer"
              onClick={() => {
                setMenuOpen(false);
                onSetManualPrice(row.assetId, row.ticker, row.currency, row.priceBRL, row.source);
              }}
            >
              <SlidersHorizontal className="size-3.5 text-muted-foreground" aria-hidden="true" />
              Ajustar cotação
            </button>
          ) : null}

          {onDeleteAsset ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-negative-strong hover:bg-negative-surface/30 transition-colors text-left cursor-pointer border-t border-border/40 mt-0.5 pt-1.5"
              onClick={() => {
                setMenuOpen(false);
                onDeleteAsset(row.assetId, row.ticker);
              }}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Excluir ativo
            </button>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
