import { useState } from "react";
import { ArrowDownToLine, Check, CheckCheck, PiggyBank, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataList } from "@/components/ui/data-list";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { triggerHaptic } from "@/services/haptics";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface AporteRouteRow {
  assetId: string;
  ticker: string;
  assetClass: string | null;
  targetValueBRL: number;
  currentValueBRL: number;
  gapBRL: number;
  allocatedBRL: number;
  quantity: number;
  priceBRL: number;
}

export interface AporteResultProps {
  mode: "asset" | "class" | "both";
  aporte: number;
  totalAllocated: number;
  leftover: number;
  routes: AporteRouteRow[];
  /** Ação rápida para gravar todas as transações sugeridas no extrato */
  onExecuteAporte?: () => void;
  executing?: boolean;
}

const MODE_LABEL: Record<AporteResultProps["mode"], string> = {
  asset: "por meta de ativo",
  class: "por meta de classe",
  both: "por ativo e classe",
};

/**
 * Resultado da calculadora de aporte (§3.11.3) — módulo de domínio F4.
 * Log de roteamento: por ativo — valor alvo, atual, aporte sugerido,
 * quantidade e preço; sobra final (→ caixa/reserva).
 */
export function AporteResult({
  mode,
  aporte,
  totalAllocated,
  leftover,
  routes,
  onExecuteAporte,
  executing = false,
}: AporteResultProps) {
  const [completedTickers, setCompletedTickers] = useState<Set<string>>(new Set());

  const toggleTicker = (ticker: string) => {
    setCompletedTickers((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) {
        next.delete(ticker);
        triggerHaptic("light");
      } else {
        next.add(ticker);
        triggerHaptic("success");
      }
      return next;
    });
  };

  const completedCount = completedTickers.size;

  const sortedRoutes = [...routes].sort((a, b) => {
    if (b.allocatedBRL !== a.allocatedBRL) return b.allocatedBRL - a.allocatedBRL;
    return a.gapBRL - b.gapBRL;
  });

  const columns: {
    key: string;
    header: ReactNode;
    align?: "left" | "right";
    cell: (row: AporteRouteRow) => ReactNode;
  }[] = [
    {
      key: "ticker",
      header: "Ativo",
      cell: (row) => {
        const isDone = completedTickers.has(row.ticker);
        return (
          <div className={cn("flex min-w-0 flex-col gap-0.5 transition-opacity duration-150", isDone && "opacity-60")}>
            <span className="truncate font-mono text-sm font-semibold text-foreground">{row.ticker}</span>
            {row.assetClass ? <span className="text-[11px] text-muted-foreground">{row.assetClass}</span> : null}
          </div>
        );
      },
    },
    {
      key: "target",
      header: "Valor alvo",
      align: "right",
      cell: (row) => <MoneyText cents={numberToCents(row.targetValueBRL)} tone="default" />,
    },
    {
      key: "current",
      header: "Atual",
      align: "right",
      cell: (row) => <MoneyText cents={numberToCents(row.currentValueBRL)} tone="default" className="text-muted-foreground" />,
    },
    {
      key: "allocated",
      header: "Aporte sugerido",
      align: "right",
      cell: (row) => <MoneyText cents={numberToCents(row.allocatedBRL)} tone="portfolio" />,
    },
    {
      key: "quantity",
      header: "Quantidade",
      align: "right",
      cell: (row) => <span className="num text-sm text-muted-foreground">{row.quantity}</span>,
    },
    {
      key: "price",
      header: "Preço",
      align: "right",
      cell: (row) => <MoneyText cents={numberToCents(row.priceBRL)} tone="default" className="text-muted-foreground" />,
    },
    {
      key: "status",
      header: "Execução",
      align: "right",
      cell: (row) => {
        const isDone = completedTickers.has(row.ticker);
        return (
          <button
            type="button"
            onClick={() => toggleTicker(row.ticker)}
            aria-label={isDone ? `Marcar ${row.ticker} como pendente` : `Marcar ${row.ticker} como executado`}
            className={cn(
              "inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
              isDone
                ? "border border-positive/30 bg-positive/10 text-positive-strong animate-spring-pop"
                : "border border-border bg-surface text-muted-foreground hover:border-primary/40 hover:text-foreground active:scale-95",
            )}
          >
            {isDone ? (
              <>
                <Check className="size-3.5" aria-hidden="true" />
                <span>Feito</span>
              </>
            ) : (
              <span>Pendente</span>
            )}
          </button>
        );
      },
    },
  ];

  return (
    <section aria-label="Resultado da simulação de aporte" className="flex flex-col gap-4 min-w-0">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0">
        <ResultStat icon={<PiggyBank className="size-4 shrink-0" aria-hidden="true" />} label="Aporte informado" cents={numberToCents(aporte)} />
        <ResultStat
          icon={<ArrowDownToLine className="size-4 shrink-0" aria-hidden="true" />}
          label={completedCount > 0 ? `Alocado (${completedCount}/${routes.length} feitos)` : "Alocado em ativos"}
          cents={numberToCents(totalAllocated)}
          accent
        />
        <ResultStat
          icon={<Wallet className="size-4 shrink-0" aria-hidden="true" />}
          label="Sobra para caixa"
          cents={numberToCents(leftover)}
          tone={leftover > 0 ? "attention" : "neutral"}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Roteamento <span className="font-medium text-foreground">{MODE_LABEL[mode]}</span>: ativos ordenados por prioridade de
        classe e gap financeiro. A soma dos aportes nunca excede o valor informado.
      </p>

      {routes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum ativo elegível: defina metas abaixo da posição atual (gap positivo) com preço disponível.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 min-w-0">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider truncate">Detalhamento dos aportes</h3>
            {onExecuteAporte && routes.some((r) => r.quantity > 0) ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={onExecuteAporte}
                disabled={executing}
                className="gap-1.5 shrink-0"
              >
                <CheckCheck className="size-4" aria-hidden="true" />
                <span>{executing ? "Lançando…" : "Lançar compras no extrato"}</span>
              </Button>
            ) : null}
          </div>
          <DataList
            columns={columns}
            rows={sortedRoutes}
            rowKey={(row, index) => `${row.ticker}:${index}`}
            density="compact"
            emptyMessage="Sem sugestão de aporte."
          />
        </>
      )}
    </section>
  );
}

function ResultStat({
  icon,
  label,
  cents,
  accent = false,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  cents: number;
  accent?: boolean;
  tone?: "neutral" | "attention";
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-3.5 sm:p-4 min-w-0 overflow-hidden">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground truncate">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <MoneyText
        cents={cents}
        variant="value"
        tone="default"
        className={cn("text-lg sm:text-xl font-semibold truncate", accent && "text-portfolio", tone === "attention" && "text-warning-strong")}
      />
    </div>
  );
}
