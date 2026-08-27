import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Sparkline } from "@/components/ui/sparkline";
import { formatCentsAsBRL } from "@/services/masks";

export interface KpiCardProps {
  label: ReactNode;
  /** Valor já formatado (não monetário — ex.: contagem) — quando `cents` não é informado. */
  value?: string;
  /** Valor em centavos — renderiza o NumberTicker animado com formatação pt-BR (F8/F12). */
  cents?: number;
  tone?: "default" | "positive" | "negative" | "portfolio";
  /** Dica ou comparativo (ex.: variação vs mês anterior). */
  hint?: ReactNode;
  icon?: ReactNode;
  /** Série de tendência dos últimos meses (micro-sparkline, F8) — antiga → recente. */
  spark?: readonly number[];
  /**
   * Ação ao clicar/teclar Enter ou Espaço (F16 — deep-link): torna o card
   * clicável e acessível (role button, foco via teclado). Sem `onClick` o
   * card é apenas informativo (padrão atual).
   */
  onClick?: () => void;
}

const toneValue: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  default: "text-foreground",
  positive: "text-positive-strong",
  negative: "text-negative-strong",
  portfolio: "text-portfolio",
};

const toneIcon: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  default: "text-muted-foreground",
  positive: "text-positive-strong",
  negative: "text-negative-strong",
  portfolio: "text-portfolio",
};

const sparkTone: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  default: "stroke-primary",
  positive: "stroke-positive-strong",
  negative: "stroke-negative-strong",
  portfolio: "stroke-portfolio",
};

export function KpiCard({ label, value, cents, tone = "default", hint, icon, spark, onClick }: KpiCardProps) {
  return (
    <Card
      variant={onClick ? "interactive" : "default"}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick && typeof label === "string" ? label : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      onClick={onClick}
      className="flex flex-col justify-between overflow-hidden p-3.5 sm:p-4 lg:p-5 h-full rounded-2xl border-border/80 bg-surface shadow-xs transition-all hover:border-border"
    >
      <div>
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          {icon ? <span className={cn("shrink-0", toneIcon[tone])}>{icon}</span> : null}
        </div>
        {/* A máscara de privacidade é global (html[data-privacy] → .num em globals.css). */}
        <p className={cn("num mt-1 sm:mt-1.5 tabular-nums tracking-tight whitespace-nowrap text-lg sm:text-xl lg:text-2xl font-bold overflow-x-auto no-scrollbar", toneValue[tone])}>
          {cents !== undefined ? (
            <>
              {/* `formatCentsAsBRL` zera valores negativos — o sinal é prefixado
                  aqui (mesma convenção do MoneyText: “−” U+2212). */}
              {cents < 0 ? <span aria-hidden="true">−</span> : null}
              <NumberTicker value={Math.abs(cents)} format={formatCentsAsBRL} />
            </>
          ) : (
            value
          )}
        </p>
      </div>
      <div className="min-w-0">
        {spark && spark.length > 1 ? (
          <div className="mt-1.5" aria-hidden="true">
            <Sparkline data={spark} height={22} strokeClassName={sparkTone[tone]} />
          </div>
        ) : null}
        {hint ? <div className="mt-1 text-[11px] font-medium leading-tight text-muted-foreground min-w-0">{hint}</div> : null}
      </div>
    </Card>
  );
}
