import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { MoneyText } from "@/components/ui/money-text";
import { Sparkline } from "@/components/ui/sparkline";

export interface KpiCardProps {
  label: ReactNode;
  /** Valor já formatado (não monetário — ex.: contagem) — quando `cents` não é informado. */
  value?: string;
  /** Valor em centavos — renderiza o MoneyText adaptativo animado com formatação pt-BR (F8/F12). */
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

const sparkFill: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  default: "fill-primary/12",
  positive: "fill-positive-strong/12",
  negative: "fill-negative-strong/12",
  portfolio: "fill-portfolio/12",
};

/**
 * Escala tipográfica adaptativa para KPIs monetários (Regra 11 de AGENTS.md):
 * Reduz proporcionalmente o tamanho da fonte em valores de 7+ dígitos (≥ R$ 100.000,00)
 * e 8+ dígitos (≥ R$ 1.000.000,00) eliminando reticências e preservando centavos.
 */
function getDynamicKpiSize(cents?: number): string {
  if (cents === undefined) return "text-lg sm:text-xl lg:text-2xl";
  const abs = Math.abs(cents);
  if (abs >= 100_000_000) return "text-sm sm:text-base lg:text-lg"; // ≥ R$ 1.000.000,00
  if (abs >= 10_000_000) return "text-base sm:text-lg lg:text-xl"; // ≥ R$ 100.000,00
  return "text-lg sm:text-xl lg:text-2xl";
}

export function KpiCard({ label, value, cents, tone = "default", hint, icon, spark, onClick }: KpiCardProps) {
  const dynamicSize = getDynamicKpiSize(cents);

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
        <div className="flex items-start justify-between gap-1.5 min-w-0">
          <span className="line-clamp-2 min-h-[2rem] leading-snug break-words text-xs font-medium text-muted-foreground flex-1">{label}</span>
          {icon ? <span className={cn("shrink-0 mt-0.5", toneIcon[tone])}>{icon}</span> : null}
        </div>
        {/* A máscara de privacidade é global (html[data-privacy] → .num em globals.css). */}
        <p className={cn("num mt-1 sm:mt-1.5 tabular-nums tracking-tight whitespace-nowrap font-bold overflow-x-auto no-scrollbar", toneValue[tone], dynamicSize)}>
          {cents !== undefined ? (
            <MoneyText
              cents={cents}
              tone={tone}
              variant="hero"
              animated
              className={cn("!font-bold block tracking-tight tabular-nums", dynamicSize)}
            />
          ) : (
            value
          )}
        </p>
      </div>
      <div className="min-w-0">
        {spark && spark.length > 0 ? (
          <div className="mt-1.5" aria-hidden="true">
            <Sparkline
              data={spark}
              height={22}
              smooth
              filled
              strokeClassName={sparkTone[tone]}
              fillClassName={sparkFill[tone]}
            />
          </div>
        ) : null}
        {hint ? <div className="mt-1 text-[11px] font-medium leading-tight text-muted-foreground min-w-0">{hint}</div> : null}
      </div>
    </Card>
  );

}
