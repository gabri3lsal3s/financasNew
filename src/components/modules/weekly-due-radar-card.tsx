import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, CalendarClock, ChevronDown, ChevronUp, CreditCard, HandCoins } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
import type { WeeklyRadarObligation, WeeklyRadarSummary } from "@/domain/projection";

export interface WeeklyDueRadarCardProps {
  summary: WeeklyRadarSummary;
  className?: string;
  onOpenItem?: (item: WeeklyRadarObligation) => void;
}

const STATUS_BADGE_VARIANTS: Record<WeeklyRadarObligation["status"], "critical" | "warning" | "muted"> = {
  overdue: "critical",
  due_today: "warning",
  due_soon: "muted",
};

function getDueLabel(daysUntilDue: number): string {
  if (daysUntilDue < 0) return "Vencida";
  if (daysUntilDue === 0) return "Vence hoje";
  if (daysUntilDue === 1) return "Amanhã";
  return `Em ${daysUntilDue} dias`;
}

/**
 * Radar dos Próximos 7 Dias — Widget Proativo do Dashboard.
 *
 * Exibe o compromisso de caixa da semana com indicador de saldo livre semanal.
 * REGRA OBRIGATÓRIA: quando não há obrigações (summary.hasObligations === false),
 * retorna estritamente null (zero poluição ou nós órfãos no DOM).
 */
export function WeeklyDueRadarCard({ summary, className, onOpenItem }: WeeklyDueRadarCardProps) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  // REGRA DE OURO: Totalmente oculto em empty state
  if (!summary.hasObligations || summary.items.length === 0) {
    return null;
  }

  const handleNavigateLembretes = () => {
    triggerSensory("action");
    navigate("/lembretes");
  };

  const handleToggleExpand = () => {
    triggerSensory("toggle");
    setIsExpanded((prev) => !prev);
  };

  const displayedItems = isExpanded ? summary.items : summary.items.slice(0, 3);
  const remainingCount = summary.items.length - 3;

  return (
    <section
      aria-label="Radar de Contas dos Próximos 7 Dias"
      data-tour="weekly-radar-card"
      className={cn(
        "rounded-2xl border border-border/80 bg-surface shadow-xs p-3.5 sm:p-4 transition-all flex flex-col gap-3",
        summary.isDeficitRisk ? "border-critical/30" : "hover:border-border",
        className,
      )}
    >
      {/* Cabeçalho Responsivo Adaptativo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarClock
            className={cn("size-4 shrink-0", summary.isDeficitRisk ? "text-critical-strong" : "text-muted-foreground")}
            aria-hidden="true"
          />
          <h2 className="text-sm font-semibold tracking-tight text-foreground truncate">
            Próximos 7 Dias
          </h2>
          <Badge
            variant={summary.isDeficitRisk ? "critical" : "muted"}
            size="xs"
            className="shrink-0"
          >
            {summary.items.length} {summary.items.length === 1 ? "conta" : "contas"}
          </Badge>
        </div>

        {/* Indicador de Liquidez Semanal */}
        <div className="flex items-center gap-2 self-start sm:self-auto text-xs">
          <span className="text-muted-foreground">Saldo livre da semana:</span>
          <MoneyText
            cents={summary.freeBalanceCents}
            tone={summary.isDeficitRisk ? "negative" : "positive"}
            className="font-semibold text-xs tabular-nums"
          />
        </div>
      </div>

      {/* Lista de Contas */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-border/60">
        {displayedItems.map((item) => {
          const Icon = item.kind === "bill" ? CreditCard : HandCoins;
          return (
            <div
              key={item.key}
              onClick={() => {
                triggerSensory("action");
                if (onOpenItem) {
                  onOpenItem(item);
                } else {
                  navigate(item.link.path);
                }
              }}
              className="group flex items-center justify-between gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-surface-hover cursor-pointer"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (onOpenItem) onOpenItem(item);
                  else navigate(item.link.path);
                }
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    item.kind === "bill" ? "text-portfolio" : "text-primary-strong",
                  )}
                  aria-hidden="true"
                />
                <span className="text-xs font-medium text-foreground truncate min-w-0 group-hover:text-primary transition-colors">
                  {item.name}
                </span>
                <Badge
                  variant={STATUS_BADGE_VARIANTS[item.status]}
                  size="xs"
                  className="shrink-0"
                >
                  {getDueLabel(item.daysUntilDue)}
                </Badge>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <MoneyText
                  cents={item.amountCents}
                  tone="default"
                  className="text-xs font-semibold tabular-nums text-foreground"
                />
                <ArrowRight className="size-3 text-muted-foreground opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" aria-hidden="true" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Rodapé: Expandir ou Ver Todos em Lembretes */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60 text-xs">
        {summary.items.length > 3 ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleToggleExpand}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="size-3.5" aria-hidden="true" />
                <span>Mostrar menos</span>
              </>
            ) : (
              <>
                <ChevronDown className="size-3.5" aria-hidden="true" />
                <span>Ver mais {remainingCount} {remainingCount === 1 ? "conta" : "contas"}</span>
              </>
            )}
          </Button>
        ) : (
          <span className="text-[11px] text-muted-foreground">
            Total a pagar: <MoneyText cents={summary.totalDueCents} tone="default" className="font-semibold text-[11px]" />
          </span>
        )}

        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={handleNavigateLembretes}
          className="h-7 px-2 text-xs text-primary hover:text-primary-strong hover:bg-primary/10 gap-1 ml-auto cursor-pointer"
        >
          <span>Central de Lembretes</span>
          <ArrowRight className="size-3" aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}
