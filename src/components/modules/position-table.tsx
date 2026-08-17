import { useState } from "react";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, List, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataList } from "@/components/ui/data-list";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
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
  /** Ação por linha (ex.: registrar transação) — omita para ocultar a coluna. */
  onRegisterTransaction?: (assetId: string, ticker: string) => void;
  /** Abre a lista de lançamentos do ativo (CRUD completo — editar/excluir). */
  onListTransactions?: (assetId: string, ticker: string) => void;
  /** Abre o formulário de edição do ativo (ticker/classe/moeda). */
  onEditAsset?: (assetId: string, ticker: string) => void;
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
 * - Ações contextuais: registrar transação (compra/venda), extrato de lançamentos,
 *   edição cadastral e exclusão em cascata.
 */
export function PositionTable({
  rows,
  onRegisterTransaction,
  onListTransactions,
  onEditAsset,
  onDeleteAsset,
  emptyMessage,
  sortable = false,
}: PositionTableProps) {
  const density = useDensity();
  const [sort, setSort] = useState<SortState | null>(null);

  const toggleSort = (key: SortKey) => {
    setSort((current) => {
      if (!current || current.key !== key) return { key, direction: "asc" };
      if (current.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };

  const sortedRows = [...rows].sort((a, b) => {
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
      cell: (row) =>
        onEditAsset ? (
          <button
            type="button"
            onClick={() => onEditAsset(row.assetId, row.ticker)}
            className="flex min-w-0 flex-col gap-0.5 text-left group hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:underline"
            aria-label={`Editar ${row.ticker}`}
          >
            <span className="truncate font-mono text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{row.ticker}</span>
            {row.assetClass ? <span className="text-[11px] text-muted-foreground">{row.assetClass}</span> : null}
          </button>
        ) : (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-mono text-sm font-semibold text-foreground">{row.ticker}</span>
            {row.assetClass ? <span className="text-[11px] text-muted-foreground">{row.assetClass}</span> : null}
          </div>
        ),
    },
    {
      key: "quantity",
      header: headerFor("quantity", "Quantidade"),
      align: "right",
      cell: (row) => (
        <span className="num text-sm text-muted-foreground">
          {row.isCash ? "—" : formatQuantity(row.quantity)}
        </span>
      ),
    },
    {
      key: "price",
      header: headerFor("price", "Preço"),
      align: "right",
      cell: (row) => (
        <div className="flex flex-col items-end gap-0.5">
          {row.isCash ? <span className="num text-sm text-foreground">1:1</span> : <MoneyText cents={numberToCents(row.priceBRL)} tone="default" />}
          {row.isCash ? (
            <Badge variant="muted" title="Ativo de caixa/reserva valorado 1:1">
              caixa
            </Badge>
          ) : (
            <Badge variant={row.source === "manual" ? "portfolio" : "muted"} title={PRICE_SOURCE_LABEL[row.source].title}>
              {PRICE_SOURCE_LABEL[row.source].label}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "averageCost",
      header: headerFor("averageCost", "Custo médio"),
      align: "right",
      cell: (row) =>
        row.isCash ? (
          <span className="num text-sm text-muted-foreground">—</span>
        ) : (
          <MoneyText cents={numberToCents(row.averageCost)} tone="default" className="text-muted-foreground" />
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
        if (row.isCash || row.unrealizedPct === null) return <span className="num text-sm text-muted-foreground">—</span>;
        const text = formatSignedPct(row.unrealizedPct);
        const tone = row.unrealizedPct >= 0 ? "positive" : "negative";
        return (
          <span className={cn("num text-sm font-semibold", tone === "positive" ? "text-positive-strong" : "text-negative-strong")}>
            {text}
          </span>
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

  const hasRowActions = Boolean(onRegisterTransaction || onListTransactions || onDeleteAsset);

  if (hasRowActions) {
    columns.push({
      key: "actions",
      header: <span className="sr-only">Ações</span>,
      align: "right",
      cell: (row) => (
        <PositionRowActions
          row={row}
          onRegisterTransaction={onRegisterTransaction}
          onListTransactions={onListTransactions}
          onDeleteAsset={onDeleteAsset}
        />
      ),
    });
  }

  return (
    <>
      <ul aria-label="Posições (visão móvel)" className="flex flex-col gap-2 sm:hidden">
        {sortedRows.length === 0 ? (
          <li className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
            {emptyMessage ?? "Nenhum ativo na carteira."}
          </li>
        ) : (
          sortedRows.map((row) => {
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
            const isClickable = Boolean(onEditAsset);
            return (
              <li
                key={row.assetId}
                role={isClickable ? "button" : undefined}
                tabIndex={isClickable ? 0 : undefined}
                aria-label={isClickable ? `Editar ${row.ticker}` : undefined}
                onClick={isClickable ? () => onEditAsset?.(row.assetId, row.ticker) : undefined}
                onKeyDown={
                  isClickable
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onEditAsset?.(row.assetId, row.ticker);
                        }
                      }
                    : undefined
                }
                className={cn(
                  "flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-3.5 shadow-sm transition-colors",
                  isClickable && "cursor-pointer hover:bg-surface-hover active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-mono text-sm font-semibold text-foreground">{row.ticker}</span>
                    {row.assetClass ? <span className="truncate text-[11px] text-muted-foreground">{row.assetClass}</span> : null}
                  </div>
                  <span className={cn("num shrink-0 text-sm font-semibold", pctTone)}>{pctLabel}</span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[11px] text-muted-foreground">Valor</span>
                    <MoneyText cents={numberToCents(row.valueBRL)} tone="default" />
                  </div>
                  <div className="flex min-w-0 flex-col items-end gap-0.5">
                    <span className="text-[11px] text-muted-foreground">Lucro/Prejuízo</span>
                    {row.isCash ? (
                      <span className="num text-sm text-muted-foreground">—</span>
                    ) : (
                      <MoneyText cents={numberToCents(row.unrealizedPnl)} tone="auto" sign="explicit" />
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span>
                    <span className="font-medium text-foreground/70">Qtd</span> {row.isCash ? "—" : formatQuantity(row.quantity)}
                  </span>
                  <span>
                    <span className="font-medium text-foreground/70">Preço</span>{" "}
                    {row.isCash ? (
                      "1:1"
                    ) : (
                      <>
                        <MoneyText cents={numberToCents(row.priceBRL)} tone="default" />{" "}
                        <span className="text-[10px]">{PRICE_SOURCE_LABEL[row.source].label}</span>
                      </>
                    )}
                  </span>
                  <span>
                    <span className="font-medium text-foreground/70">Custo médio</span>{" "}
                    {row.isCash ? "—" : <MoneyText cents={numberToCents(row.averageCost)} tone="default" />}
                  </span>
                </div>

                {hasRowActions ? (
                  <div className="flex items-center justify-end gap-1 border-t border-border/60 pt-2">
                    <PositionRowActions
                      row={row}
                      onRegisterTransaction={onRegisterTransaction}
                      onListTransactions={onListTransactions}
                      onDeleteAsset={onDeleteAsset}
                    />
                  </div>
                ) : null}
              </li>
            );
          })
        )}
      </ul>

      <div className="hidden sm:block">
        <DataList
          columns={columns}
          rows={sortedRows}
          rowKey={(row) => row.assetId}
          density={density === "compact" ? "compact" : "comfortable"}
          emptyMessage={emptyMessage ?? "Nenhum ativo na carteira."}
        />
      </div>
    </>
  );
}

interface PositionRowActionsProps {
  row: PositionRow;
  onRegisterTransaction?: (assetId: string, ticker: string) => void;
  onListTransactions?: (assetId: string, ticker: string) => void;
  onDeleteAsset?: (assetId: string, ticker: string) => void;
}

/** Ações por linha (compartilhadas entre a tabela e os cards mobile — F28). */
function PositionRowActions({ row, onRegisterTransaction, onListTransactions, onDeleteAsset }: PositionRowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      {onRegisterTransaction ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-h-11"
          aria-label={`Registrar transação de ${row.ticker}`}
          onClick={(e) => {
            e.stopPropagation();
            onRegisterTransaction(row.assetId, row.ticker);
          }}
        >
          Movimentar
        </Button>
      ) : null}
      {onListTransactions ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-h-9 px-2"
          aria-label={`Lançamentos de ${row.ticker}`}
          onClick={(e) => {
            e.stopPropagation();
            onListTransactions(row.assetId, row.ticker);
          }}
        >
          <List className="size-4" aria-hidden="true" />
        </Button>
      ) : null}
      {onDeleteAsset ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-h-9 px-2 text-negative-strong hover:text-negative-strong"
          aria-label={`Excluir ${row.ticker}`}
          onClick={(e) => {
            e.stopPropagation();
            onDeleteAsset(row.assetId, row.ticker);
          }}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
