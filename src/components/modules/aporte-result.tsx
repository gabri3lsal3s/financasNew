import { useState } from "react";
import { ArrowDownToLine, Check, CheckCheck, ChevronDown, ChevronUp, Info, Layers, PiggyBank, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataList } from "@/components/ui/data-list";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import type { ClassAporteSummary, SkippedAssetDiagnostic } from "@/domain/portfolio";
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
  classSummaries?: ClassAporteSummary[];
  skippedAssets?: SkippedAssetDiagnostic[];
  /** Ação rápida para gravar todas as transações sugeridas no extrato */
  onExecuteAporte?: () => void;
  executing?: boolean;
}

const MODE_LABEL: Record<AporteResultProps["mode"], string> = {
  asset: "por meta individual",
  class: "por estabilização de classe",
  both: "hierárquico (ativo e classe)",
};

const SKIPPED_REASON_LABEL: Record<SkippedAssetDiagnostic["reason"], { label: string; variant: "warning" | "muted" }> = {
  no_price: { label: "Sem cotação", variant: "warning" },
  above_target: { label: "Na meta", variant: "muted" },
  no_target: { label: "Sem meta", variant: "muted" },
  price_exceeds_budget: { label: "Preço > Saldo", variant: "muted" },
};

function formatQuantity(qty: number): string {
  if (qty % 1 === 0) return qty.toLocaleString("pt-BR");
  return qty.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

/**
 * Resultado da calculadora de aporte (§3.11.3) — módulo de domínio F4.
 * Visão em dois níveis: estabilização macro por classe e distribuição micro por ativo,
 * com log de roteamento, quantidades (inteiras/fracionárias) e diagnóstico completo.
 */
export function AporteResult({
  mode,
  aporte,
  totalAllocated,
  leftover,
  routes,
  classSummaries = [],
  skippedAssets = [],
  onExecuteAporte,
  executing = false,
}: AporteResultProps) {
  const [completedTickers, setCompletedTickers] = useState<Set<string>>(new Set());
  const [showSkipped, setShowSkipped] = useState(false);

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
      cell: (row) => <span className="num text-sm text-muted-foreground">{formatQuantity(row.quantity)}</span>,
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

  const activeClasses = classSummaries.filter((c) => c.actualAllocatedBRL > 0 || c.gapBRL > 0);

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

      {activeClasses.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface/60 p-3 sm:p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider">
            <Layers className="size-3.5 text-portfolio" aria-hidden="true" />
            <span>Distribuição Macro por Classe</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
            {activeClasses.map((cls) => (
              <div
                key={cls.className}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-surface px-3 py-2 text-xs"
              >
                <div className="flex flex-col truncate">
                  <span className="font-medium text-foreground truncate">{cls.className || "Sem classe"}</span>
                  <span className="text-[11px] text-muted-foreground">Meta: {cls.targetPct}%</span>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <MoneyText cents={numberToCents(cls.actualAllocatedBRL)} tone={cls.actualAllocatedBRL > 0 ? "portfolio" : "default"} className="font-semibold text-xs" />
                  <span className="text-[10px] text-muted-foreground">Gap: R$ {cls.gapBRL.toFixed(0)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Roteamento <span className="font-medium text-foreground">{MODE_LABEL[mode]}</span>: estabilização macro das classes e
        distribuição interna entre os ativos com maior gap.
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

      {skippedAssets.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-surface/40 p-3">
          <button
            type="button"
            onClick={() => setShowSkipped(!showSkipped)}
            className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Info className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Ativos não contemplados neste aporte ({skippedAssets.length})</span>
            </span>
            {showSkipped ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
          </button>

          {showSkipped ? (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
              {skippedAssets.map((asset) => {
                const config = SKIPPED_REASON_LABEL[asset.reason] ?? { label: asset.reason, variant: "muted" };
                return (
                  <div
                    key={asset.assetId}
                    className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-surface px-2.5 py-1 text-xs"
                    title={asset.detail}
                  >
                    <span className="font-mono font-medium text-foreground">{asset.ticker}</span>
                    <Badge variant={config.variant} className="text-[10px] px-1.5 py-0">
                      {config.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
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

