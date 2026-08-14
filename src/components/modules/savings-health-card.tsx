import { HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";
import { runwayMonths } from "@/domain/overview";
import { savingsHealth } from "@/domain/insights/diagnostics";

export interface SavingsHealthCardProps {
  savingsRatePercent: number;
  incomeCents: number;
  expenseCents: number;
}

const STATUS_TONE: Record<string, string> = {
  critico: "text-critical",
  baixo: "text-warning-strong",
  moderado: "text-foreground",
  saudavel: "text-positive-strong",
  forte: "text-positive-strong",
};

/**
 * Card hero de Runway & Saúde (F8): meses de reserva (renda ÷ despesas) e
 * feedback contextual da taxa de poupança — motores puros de domain/overview
 * (runwayMonths) e domain/insights (savingsHealth).
 */
export function SavingsHealthCard({ savingsRatePercent, incomeCents, expenseCents }: SavingsHealthCardProps) {
  const health = savingsHealth(savingsRatePercent);
  const months = runwayMonths(incomeCents, expenseCents);

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
          <HeartPulse className="size-4 text-foreground" aria-hidden="true" />
        </span>
        <h2 className="text-sm font-semibold text-foreground">Saúde da poupança</h2>
      </div>

      <div className="flex items-baseline gap-2">
        {months !== null ? (
          <>
            <p className="num text-3xl font-semibold text-foreground">
              {months.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
            </p>
            <p className="text-xs text-muted-foreground">
              meses de despesas cobertos pela renda
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Sem despesas registradas no mês.</p>
        )}
      </div>

      <p className={cn("text-xs font-medium", STATUS_TONE[health] ?? "text-foreground")}>
        {savingsRatePercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% de poupança ·{" "}
        {health === "critico" || health === "baixo"
          ? "revise os gastos para recompor a reserva."
          : health === "forte"
            ? "reserva robusta, continue assim."
            : "tendência saudável, mantenha o ritmo."}
      </p>
    </article>
  );
}
