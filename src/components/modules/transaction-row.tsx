import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/modules/category-icon";
import { formatCentsAsBRL } from "@/services/masks/money";

export interface TransactionRowProps {
  title: string;
  subtitle?: string;
  date?: string;
  /** Valor em centavos — exibido com sinal e cor pelo tipo. */
  amountCents: number;
  kind: "income" | "expense" | "neutral";
  icon?: string | null;
  iconColor?: string | null;
  badges?: ReactNode;
  onClick?: () => void;
  className?: string;
}

const kindValue: Record<TransactionRowProps["kind"], string> = {
  income: "text-positive-strong",
  expense: "text-negative-strong",
  neutral: "text-foreground",
};

const kindSign: Record<TransactionRowProps["kind"], string> = {
  income: "+",
  expense: "−",
  neutral: "",
};

/** Linha de lançamento (receita/despesa) — módulo de domínio reutilizável. */
export function TransactionRow({
  title,
  subtitle,
  date,
  amountCents,
  kind,
  icon,
  iconColor,
  badges,
  onClick,
  className,
}: TransactionRowProps) {
  const content = (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-2 py-2.5 transition-colors",
        onClick && "cursor-pointer hover:bg-surface-hover",
        className,
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
        <CategoryIcon icon={icon} color={iconColor} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {(subtitle || date) && (
          <p className="truncate text-xs text-muted-foreground">{[date, subtitle].filter(Boolean).join(" · ")}</p>
        )}
      </div>
      {badges ? <div className="flex shrink-0 items-center gap-1.5">{badges}</div> : null}
      <span className={cn("num shrink-0 text-sm font-semibold", kindValue[kind])}>
        {`${kindSign[kind]}${formatCentsAsBRL(amountCents)}`}
      </span>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left focus-visible:outline-none">
        {content}
      </button>
    );
  }
  return content;
}
