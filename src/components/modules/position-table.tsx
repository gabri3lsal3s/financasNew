import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataList } from "@/components/ui/data-list";
import { MoneyText } from "@/components/ui/money-text";
import type { PriceSource } from "@/domain/portfolio";
import type { AssetCurrency } from "@/types";
import type { ReactNode } from "react";

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
  isCash: boolean;
}

export interface PositionTableProps {
  rows: PositionRow[];
  /** Ação por linha (ex.: registrar transação) — omita para ocultar a coluna. */
  onRegisterTransaction?: (assetId: string, ticker: string) => void;
  emptyMessage?: string;
}

const PRICE_SOURCE_LABEL: Record<PriceSource, { label: string; title: string }> = {
  manual: { label: "manual", title: "Preço informado manualmente (prevalece sobre API/fallback)" },
  api: { label: "cotação", title: "Preço do cache de cotações" },
  fallback: { label: "referência", title: "Preço de referência estático (sem cotação atualizada)" },
};

const toCents = (value: number): number => Math.round((Number.isFinite(value) ? value : 0) * 100);

/**
 * Posição da carteira — módulo de domínio reutilizável (F4).
 * Recebe linhas prontas (posição derivada no state); marca a fonte do preço,
 * destacando o override manual ("informado manualmente" — DoD F4).
 */
export function PositionTable({ rows, onRegisterTransaction, emptyMessage }: PositionTableProps) {
  const columns: {
    key: string;
    header: ReactNode;
    align?: "left" | "right";
    cell: (row: PositionRow) => ReactNode;
  }[] = [
    {
      key: "ticker",
      header: "Ativo",
      cell: (row) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-mono text-sm font-semibold text-foreground">{row.ticker}</span>
          {row.assetClass ? <span className="text-[11px] text-muted-foreground">{row.assetClass}</span> : null}
        </div>
      ),
    },
    {
      key: "quantity",
      header: "Quantidade",
      align: "right",
      cell: (row) => (
        <span className="num text-sm text-muted-foreground">
          {row.isCash ? "—" : Number.isInteger(row.quantity) ? row.quantity : row.quantity.toFixed(4)}
        </span>
      ),
    },
    {
      key: "price",
      header: "Preço",
      align: "right",
      cell: (row) => (
        <div className="flex flex-col items-end gap-0.5">
          {row.isCash ? <span className="num text-sm text-foreground">1:1</span> : <MoneyText cents={toCents(row.priceBRL)} tone="default" />}
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
      header: "Custo médio",
      align: "right",
      cell: (row) =>
        row.isCash ? (
          <span className="num text-sm text-muted-foreground">—</span>
        ) : (
          <MoneyText cents={toCents(row.averageCost)} tone="default" className="text-muted-foreground" />
        ),
    },
    {
      key: "value",
      header: "Valor",
      align: "right",
      cell: (row) => <MoneyText cents={toCents(row.valueBRL)} tone="default" />,
    },
    {
      key: "pct",
      header: "% patrimônio",
      align: "right",
      cell: (row) => <span className="num text-sm text-muted-foreground">{row.pct.toFixed(1)}%</span>,
    },
  ];

  if (onRegisterTransaction) {
    columns.push({
      key: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={`Registrar transação de ${row.ticker}`}
          onClick={() => onRegisterTransaction(row.assetId, row.ticker)}
        >
          Movimentar
        </Button>
      ),
    });
  }

  return (
    <DataList
      columns={columns}
      rows={rows}
      rowKey={(row) => row.assetId}
      density="default"
      emptyMessage={emptyMessage ?? "Nenhum ativo na carteira."}
    />
  );
}
