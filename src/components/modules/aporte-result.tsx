import { ArrowDownToLine, PiggyBank, Wallet } from "lucide-react";
import { DataList } from "@/components/ui/data-list";
import { formatCentsAsBRL } from "@/services/masks/money";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface AporteRouteRow {
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
  mode: "asset" | "class";
  aporte: number;
  totalAllocated: number;
  leftover: number;
  routes: AporteRouteRow[];
}

const MODE_LABEL: Record<AporteResultProps["mode"], string> = {
  asset: "por meta de ativo",
  class: "por meta de classe",
};

const toBRL = (value: number): string => formatCentsAsBRL(Math.round((Number.isFinite(value) ? value : 0) * 100));

/**
 * Resultado da calculadora de aporte (§3.11.3) — módulo de domínio F4.
 * Log de roteamento: por ativo — valor alvo, atual, aporte sugerido,
 * quantidade e preço; sobra final (→ caixa/reserva).
 */
export function AporteResult({ mode, aporte, totalAllocated, leftover, routes }: AporteResultProps) {
  const columns: {
    key: string;
    header: ReactNode;
    align?: "left" | "right";
    cell: (row: AporteRouteRow) => ReactNode;
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
      key: "target",
      header: "Valor alvo",
      align: "right",
      cell: (row) => <span className="num text-sm text-foreground">{toBRL(row.targetValueBRL)}</span>,
    },
    {
      key: "current",
      header: "Atual",
      align: "right",
      cell: (row) => <span className="num text-sm text-muted-foreground">{toBRL(row.currentValueBRL)}</span>,
    },
    {
      key: "allocated",
      header: "Aporte sugerido",
      align: "right",
      cell: (row) => (
        <span className="num text-sm font-semibold text-portfolio">{toBRL(row.allocatedBRL)}</span>
      ),
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
      cell: (row) => <span className="num text-sm text-muted-foreground">{toBRL(row.priceBRL)}</span>,
    },
  ];

  return (
    <section aria-label="Resultado da simulação de aporte" className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <ResultStat icon={<PiggyBank className="size-4" aria-hidden="true" />} label="Aporte informado" value={toBRL(aporte)} />
        <ResultStat
          icon={<ArrowDownToLine className="size-4" aria-hidden="true" />}
          label="Alocado em ativos"
          value={toBRL(totalAllocated)}
          accent
        />
        <ResultStat
          icon={<Wallet className="size-4" aria-hidden="true" />}
          label="Sobra para caixa"
          value={toBRL(leftover)}
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
        <DataList
          columns={columns}
          rows={routes}
          rowKey={(row, index) => `${row.ticker}:${index}`}
          density="compact"
          emptyMessage="Sem sugestão de aporte."
        />
      )}
    </section>
  );
}

function ResultStat({
  icon,
  label,
  value,
  accent = false,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent?: boolean;
  tone?: "neutral" | "attention";
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </span>
      <span
        className={cn(
          "num text-xl font-semibold",
          accent && "text-portfolio",
          tone === "attention" && "text-attention",
        )}
      >
        {value}
      </span>
    </div>
  );
}
