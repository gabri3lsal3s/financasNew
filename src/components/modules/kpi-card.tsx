import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Sparkline } from "@/components/ui/sparkline";
import { formatCentsAsBRL } from "@/services/masks/money";

export interface KpiCardProps {
  label: string;
  /** Valor já formatado — usado quando `valueCents` não é informado. */
  value: string;
  /** Valor em centavos — quando presente, renderiza NumberTicker animado (F8). */
  valueCents?: number;
  tone?: "default" | "positive" | "negative" | "portfolio";
  /** Dica ou comparativo (ex.: variação vs mês anterior). */
  hint?: ReactNode;
  icon?: ReactNode;
  /** Série de tendência dos últimos meses (micro-sparkline, F8) — antiga → recente. */
  spark?: readonly number[];
}

const toneValue: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  default: "text-foreground",
  positive: "text-positive",
  negative: "text-negative",
  portfolio: "text-portfolio",
};

const sparkTone: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  default: "stroke-primary",
  positive: "stroke-positive-strong",
  negative: "stroke-negative-strong",
  portfolio: "stroke-portfolio",
};

export function KpiCard({ label, value, valueCents, tone = "default", hint, icon, spark }: KpiCardProps) {
  return (
    <Card className="flex flex-col justify-between overflow-hidden p-3.5 sm:p-4 lg:p-5">
      <div>
        <div className="flex items-center justify-between gap-1.5">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
        </div>
        {/* A máscara de privacidade é global (html[data-privacy] → .num em globals.css). */}
        <p className={cn("num mt-1.5 sm:mt-2 truncate text-lg font-semibold tracking-tight sm:text-xl lg:text-2xl", toneValue[tone])}>
          {valueCents !== undefined ? <NumberTicker value={valueCents} format={formatCentsAsBRL} /> : value}
        </p>
      </div>
      <div>
        {spark && spark.length > 1 ? (
          <div className="mt-2" aria-hidden="true">
            <Sparkline data={spark} height={28} strokeClassName={sparkTone[tone]} />
          </div>
        ) : null}
        {hint ? <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </Card>
  );
}
