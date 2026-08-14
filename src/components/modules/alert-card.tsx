import { AlertTriangle, Award, Flame, PiggyBank, Scale, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Prioridade do alerta (§3.7.1: 1=saldo negativo … 6=elogio). */
export type AlertPriority = 1 | 2 | 3 | 4 | 5 | 6;

const PRIORITY_ICONS: Record<AlertPriority, typeof AlertTriangle> = {
  1: Wallet,
  2: Scale,
  3: AlertTriangle,
  4: Flame,
  5: PiggyBank,
  6: Award,
};

const PRIORITY_TONES: Record<AlertPriority, string> = {
  1: "border-critical/40 bg-critical/8 text-critical-strong",
  2: "border-warning/40 bg-warning/10 text-warning-strong",
  3: "border-warning/40 bg-warning/10 text-warning-strong",
  4: "border-critical/40 bg-critical/8 text-critical-strong",
  5: "border-warning/40 bg-warning/10 text-warning-strong",
  6: "border-positive/40 bg-positive/10 text-positive-strong",
};

export interface AlertCardProps {
  priority: AlertPriority;
  title: string;
  description: ReactNode;
  icon?: ReactNode;
  /** Ações opcionais (ex.: botões de feedback). */
  actions?: ReactNode;
}

/** Card de alerta crítico priorizado (§3.7.1) — usado na tela de Insights. */
export function AlertCard({ priority, title, description, icon, actions }: AlertCardProps) {
  const Icon = PRIORITY_ICONS[priority] ?? AlertTriangle;
  return (
    <article className={cn("flex flex-col gap-2 rounded-xl border p-4", PRIORITY_TONES[priority])}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background/60">
            {icon ?? <Icon className="size-4" aria-hidden="true" />}
          </span>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          #{priority}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      {actions ? <div className="mt-1 flex flex-wrap items-center gap-2">{actions}</div> : null}
    </article>
  );
}
