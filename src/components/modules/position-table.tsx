import { useState } from "react";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, List, Pencil, Trash2 } from "lucide-react";
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

type SortKey =
  | "ticker"
  | "quantity"
  | "price"
  | "averageCost"
  | "value"
  | "unrealizedPct"
  | "pct";

const SORT_ACCESSOR: Record<SortKey, (row: PositionRow) => number | string> = {
  ticker: (row) => row.ticker,
  quantity: (row) => row.quantity,
  price: (row) => row.priceBRL,
  averageCost: (row) => row.averageCost,
  value: (row) => row.valueBRL,
  unrealizedPct: (row) => row.unrealizedPct ?? Number.NEGATIVE_INFINITY,
  pct: (row) => row.pct,
};

const PRICE_SOURCE_LABEL: Record<PriceSource, { label: string; title: string }> = {
  manual: { label: "manual", title: "Preço informado manualmente (prevalece sobre API/fallback)" },
  api: { label: "cotação", title: "Preço do cache de cotações" },
  fallback: { label: "referência", title: "Preço de referência estático (sem cotação atualizada)" },
};

/** Quantidade formatada (inteiro sem casas; fracionário até 4). */
function formatQuantity(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(4);
}

/** Cabeçalho clicável com direção (F17 — ordenação acessível). */
function SortableHeader({ label, active, direction, onClick }: { label: string; active: boolean; direction: "asc" | "desc"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className="inline-flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
    >
      {label}
      {active ? (
        direction === "asc" ? (
          <ArrowUp className="size-3" aria-hidden="true" />
        ) : (
          <ArrowDown className="size-3" aria-hidden="true" />
        )
      ) : (
        <ArrowUpDown className="size-3 opacity-50" aria-hidden="true" />
      )}
    </button>
  );
}

/**
 * Posição da carteira — módulo de domínio reutilizável (F4 + F14).
 * Recebe linhas prontas (posição derivada no state); marca a fonte do preço,
 * destacando o override manual ("informado manualmente" — DoD F4), e exibe a
 * rentabilidade não realizada com tom semântico (F14 — valores calculados no
 * domínio, a UI só formata). Respeita o toggle global de densidade (F8).
 * `sortable` (F17) habilita ordenação por coluna clicável (aria-sort).
 */
export function PositionTable({ rows, onRegisterTransaction, onListTransactions, onEditAsset, onDeleteAsset, emptyMessage, sortable = false }: PositionTableProps) {
  const density = useDensity();
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" } | null>(null);

  const toggleSort = (key: SortKey) => {
    setSort((current) => {
      if (current === null || current.key !== key) return { key, direction: "asc" };
      if (current.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };

  const sortedRows = sortable && sort ? [...rows].sort((a, b) => {
    const av = SORT_ACCESSOR[sort.key](a);
    const bv = SORT_ACCESSOR[sort.key](b);
    const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
    return sort.direction === "asc" ? cmp : -cmp;
  }) : rows;

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
      cell: (row) => (
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
          {row.isCash ? "—" : Number.isInteger(row.quantity) ? row.quantity : row.quantity.toFixed(4)}
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
        if (row.isCash || row.unrealizedPct === null) {
          return <span className="num text-sm text-muted-foreground">—</span>;
        }
        return (
          <span className={cn("num text-sm font-semibold", row.unrealizedPct >= 0 ? "text-positive-strong" : "text-negative-strong")}>
            {formatSignedPct(row.unrealizedPct)}
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

  const hasRowActions = Boolean(onRegisterTransaction || onListTransactions || onEditAsset || onDeleteAsset);

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
          onEditAsset={onEditAsset}
          onDeleteAsset={onDeleteAsset}
        />
      ),
    });
  }

  return (
    <>
      {/* F28 — mobile: cards empilhados (legíveis, sem scroll horizontal).
          A tabela completa fica para sm+ (a mesma ordenação vale nos dois). */}
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
            return (
              <li key={row.assetId} className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-3.5 shadow-sm">
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
                      onEditAsset={onEditAsset}
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
  onEditAsset?: (assetId: string, ticker: string) => void;
  onDeleteAsset?: (assetId: string, ticker: string) => void;
}

/** Ações por linha (compartilhadas entre a tabela e os cards mobile — F28). */
function PositionRowActions({ row, onRegisterTransaction, onListTransactions, onEditAsset, onDeleteAsset }: PositionRowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      {onRegisterTransaction ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-h-11"
          aria-label={`Registrar transação de ${row.ticker}`}
          onClick={() => onRegisterTransaction(row.assetId, row.ticker)}
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
          onClick={() => onListTransactions(row.assetId, row.ticker)}
        >
          <List className="size-4" aria-hidden="true" />
        </Button>
      ) : null}
      {onEditAsset ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-h-9 px-2"
          aria-label={`Editar ${row.ticker}`}
          onClick={() => onEditAsset(row.assetId, row.ticker)}
        >
          <Pencil className="size-4" aria-hidden="true" />
        </Button>
      ) : null}
      {onDeleteAsset ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-h-9 px-2 text-negative-strong hover:text-negative-strong"
          aria-label={`Excluir ${row.ticker}`}
          onClick={() => onDeleteAsset(row.assetId, row.ticker)}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
