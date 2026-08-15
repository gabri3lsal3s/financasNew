import { cn } from "@/lib/utils";
import { EMERGENCY_HEALTH_LABELS } from "@/domain/fire";
import type { EmergencyHealth } from "@/domain/fire";

const SIZE = 96;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const HEALTH_CLASS: Record<EmergencyHealth, string> = {
  critico: "stroke-critical",
  baixo: "stroke-warning",
  adequado: "stroke-primary",
  saudavel: "stroke-positive",
};

export interface EmergencyFundGaugeProps {
  /** Meses de despesa cobertos (null quando não há despesa de referência). */
  months: number | null;
  health: EmergencyHealth;
  className?: string;
}

/**
 * EmergencyFundGauge (F24) — anel SVG mostrando os meses de reserva do fundo
 * de emergência (escala 0–12+), com cor por faixa de saúde (crítico/baixo/
 * adequado/saudável). 100% presentacional, sem libs de gráfico.
 */
export function EmergencyFundGauge({ months, health, className }: EmergencyFundGaugeProps) {
  const ratio = months === null ? 0 : Math.min(1, Math.max(0, months / 12));
  const dash = ratio * CIRCUMFERENCE;
  const monthsLabel =
    months === null ? "—" : Number.isInteger(months) ? String(months) : months < 10 ? months.toFixed(1).replace(".", ",") : `${Math.floor(months)}`;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="size-24"
        role="img"
        aria-label={`Fundo de emergência: ${months === null ? "sem despesa de referência" : `${monthsLabel} meses de reserva`} (${EMERGENCY_HEALTH_LABELS[health]})`}
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-border/40 dark:stroke-border/60"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          className={cn(HEALTH_CLASS[health], "transition-all duration-500")}
        />
        <text
          x="50%"
          y="46%"
          textAnchor="middle"
          className="fill-foreground text-base font-semibold tabular-nums"
        >
          {monthsLabel}
        </text>
        <text x="50%" y="62%" textAnchor="middle" className="fill-muted-foreground text-[9px]">
          meses
        </text>
      </svg>
      <span className={cn("text-xs font-medium", health === "critico" ? "text-critical" : health === "baixo" ? "text-warning-strong" : health === "adequado" ? "text-primary-strong" : "text-positive-strong")}>
        {EMERGENCY_HEALTH_LABELS[health]}
      </span>
    </div>
  );
}
