import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export interface KpiCardProps {
  label: string;
  /** Valor já formatado — exibido com a classe .num (mono + tabular). */
  value: string;
  tone?: "default" | "positive" | "negative" | "portfolio";
  /** Dica ou comparativo (ex.: variação vs mês anterior). */
  hint?: ReactNode;
  icon?: ReactNode;
}

const toneValue: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  default: "text-foreground",
  positive: "text-positive",
  negative: "text-negative",
  portfolio: "text-portfolio",
};

export function KpiCard({ label, value, tone = "default", hint, icon }: KpiCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className={cn("num mt-2 text-2xl font-semibold", toneValue[tone])}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}
