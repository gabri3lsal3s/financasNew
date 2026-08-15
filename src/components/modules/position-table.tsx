import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataList } from "@/components/ui/data-list";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money/parse";
import type { PriceSource } from "@/domain/portfolio";
import { useDensity } from "@/hooks/use-density";
import { cn } from "@/lib/utils";
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
  emptyMessage?: string;
}

const PRICE_SOURCE_LABEL: Record<PriceSource, { label: string; title: string }> = {
  manual: { label: "manual", title: "Preço informado manualmente (prevalece sobre API/fallback)" },
  api: { label: "cotação", title: "Preço do cache de cotações" },
  fallback: { label: "referência", title: "Preço de referência estático (sem cotação atualizada)" },
};

const formatPct = (value: number): string =>
  `${value > 0 ? "+" : ""}${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

/**
 * Posição da carteira — módulo de domínio reutilizável (F4 + F14).
 * Recebe linhas prontas (posição derivada no state); marca a fonte do preço,
 * destacando o override manual ("informado manualmente" — DoD F4), e exibe a
 * rentabilidade não realizada com tom semântico (F14 — valores calculados no
 * domínio, a UI só formata). Respeita o toggle global de densidade (F8).
 */
export function PositionTable({ rows, onRegisterTransaction, emptyMessage }: PositionTableProps) {
  const density = useDensity();

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
      header: "Custo médio",
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
      header: "Valor",
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
      header: "Rentab.",
      align: "right",
      cell: (row) => {
        if (row.isCash || row.unrealizedPct === null) {
          return <span className="num text-sm text-muted-foreground">—</span>;
        }
        return (
          <span className={cn("num text-sm font-semibold", row.unrealizedPct >= 0 ? "text-positive-strong" : "text-negative-strong")}>
            {formatPct(row.unrealizedPct)}
          </span>
        );
      },
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
      header: <span className="sr-only">Ações</span>,
      align: "right",
      cell: (row) => (
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
      ),
    });
  }

  return (
    <DataList
      columns={columns}
      rows={rows}
      rowKey={(row) => row.assetId}
      density={density === "compact" ? "compact" : "comfortable"}
      emptyMessage={emptyMessage ?? "Nenhum ativo na carteira."}
    />
  );
}
