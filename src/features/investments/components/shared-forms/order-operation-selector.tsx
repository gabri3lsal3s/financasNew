import { ArrowDownLeft, ArrowUpRight, GitFork, Receipt, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import type { PortfolioTransactionType } from "@/types";

export interface OrderOperationSelectorProps {
  value: PortfolioTransactionType;
  isTotalValue: boolean;
  isEditingTransaction?: boolean;
  isEditingDividend?: boolean;
  onChange: (type: PortfolioTransactionType) => void;
}

export function OrderOperationSelector({
  value,
  isTotalValue,
  isEditingTransaction = false,
  isEditingDividend = false,
  onChange,
}: OrderOperationSelectorProps) {
  const operations = [
    {
      id: "buy" as const,
      label: isTotalValue ? "Aporte / Aplicação" : "Compra / Aporte",
      icon: ArrowUpRight,
      activeClass: "border-primary bg-primary/10 text-primary-strong shadow-xs font-bold",
    },
    {
      id: "sell" as const,
      label: isTotalValue ? "Resgate" : "Venda / Resgate",
      icon: ArrowDownLeft,
      activeClass: "border-negative/60 bg-negative/10 text-negative-strong shadow-xs font-bold",
    },
    {
      id: "dividend" as const,
      label: isTotalValue ? "Rendimento / Cupom" : "Provento",
      icon: Receipt,
      activeClass: "border-positive/60 bg-positive/10 text-positive-strong shadow-xs font-bold",
    },
    {
      id: "split" as const,
      label: "Desdobro / Bonif.",
      icon: GitFork,
      activeClass: "border-warning/60 bg-warning/10 text-warning-strong shadow-xs font-bold",
    },
    {
      id: "reverse_split" as const,
      label: "Grupamento",
      icon: RotateCcw,
      activeClass: "border-warning/60 bg-warning/10 text-warning-strong shadow-xs font-bold",
    },
  ];

  const available = isEditingDividend
    ? operations.filter((op) => op.id === "dividend")
    : isEditingTransaction
      ? isTotalValue
        ? operations.filter((op) => op.id !== "split" && op.id !== "reverse_split" && op.id !== "dividend")
        : operations.filter((op) => op.id !== "dividend")
      : isTotalValue
        ? operations.filter((op) => op.id !== "split" && op.id !== "reverse_split")
        : operations;

  if (available.length <= 1) return null;

  return (
    <div
      className={cn(
        "grid gap-2",
        available.length >= 5
          ? "grid-cols-2 sm:grid-cols-3"
          : available.length === 3
            ? "grid-cols-1 sm:grid-cols-3"
            : "grid-cols-2",
      )}
      role="tablist"
      aria-label="Tipo de Operação"
    >
      {available.map((op) => {
        const Icon = op.icon;
        const isSelected = value === op.id;
        return (
          <button
            key={op.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => {
              triggerSensory("selection");
              onChange(op.id);
            }}
            className={cn(
              "flex items-center justify-center gap-1.5 min-h-10 rounded-xl border p-2.5 text-xs font-medium transition-all duration-150 cursor-pointer select-none active:scale-[0.98]",
              isSelected
                ? op.activeClass
                : "border-border/80 bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{op.label}</span>
          </button>
        );
      })}
    </div>
  );
}
