import { useState } from "react";
import { ChevronDown, ChevronUp, Repeat, TrendingUp } from "lucide-react";
import { Badge, Button, MoneyText } from "@/components/ui";
import { PriceIncreaseBadge } from "./price-increase-badge";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
import type { AuditedSubscription } from "@/domain/subscriptions";

export interface SubscriptionsAuditCardProps {
  subscriptions: AuditedSubscription[];
  totalMonthlyCents: number;
  totalAnnualizedIncreaseCents: number;
  onSelectSubscription: (sub: AuditedSubscription) => void;
  className?: string;
}

export function SubscriptionsAuditCard({
  subscriptions,
  totalMonthlyCents,
  totalAnnualizedIncreaseCents,
  onSelectSubscription,
  className,
}: SubscriptionsAuditCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (subscriptions.length === 0) return null;

  const increased = subscriptions.filter((s) => s.hasPriceIncrease);

  return (
    <div
      data-tour="subscriptions-audit-card"
      className={cn(
        "rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-3 transition-all",
        increased.length > 0 && "border-warning/30 bg-warning/[0.02]",
        className,
      )}
    >
      {/* Topo do Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted border border-border/60 text-muted-foreground">
            <Repeat className="size-4" aria-hidden="true" />
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground">
                Auditoria de Assinaturas & Planos
              </h3>
              <Badge variant="muted" size="xs">
                {subscriptions.length} serviço{subscriptions.length > 1 ? "s" : ""}
              </Badge>
              {increased.length > 0 && (
                <Badge variant="warning" size="xs" className="gap-1 font-semibold">
                  <TrendingUp className="size-2.5" aria-hidden="true" />
                  <span>{increased.length} reajuste{increased.length > 1 ? "s" : ""}</span>
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Detecção automática de cobranças recorrentes com histórico comparativo de valores.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1 self-start sm:self-auto text-xs text-muted-foreground hover:text-foreground"
          onClick={() => {
            triggerSensory("selection");
            setIsExpanded((prev) => !prev);
          }}
        >
          <span>{isExpanded ? "Recolher" : "Ver Detalhes"}</span>
          {isExpanded ? (
            <ChevronUp className="size-3.5" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-3.5" aria-hidden="true" />
          )}
        </Button>
      </div>

      {/* Régua de Métricas Rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
        <div className="rounded-xl border border-border/60 bg-surface/60 p-2.5">
          <span className="text-[10px] uppercase font-medium text-muted-foreground block truncate">
            Custo Mensal
          </span>
          <span className="text-sm font-bold text-foreground tabular-nums block mt-0.5">
            <MoneyText cents={totalMonthlyCents} tone="default" />
          </span>
        </div>

        <div className="rounded-xl border border-border/60 bg-surface/60 p-2.5">
          <span className="text-[10px] uppercase font-medium text-muted-foreground block truncate">
            Projeção Anual
          </span>
          <span className="text-sm font-semibold text-muted-foreground tabular-nums block mt-0.5">
            <MoneyText cents={totalMonthlyCents * 12} tone="default" />
          </span>
        </div>

        {totalAnnualizedIncreaseCents > 0 && (
          <div className="rounded-xl border border-warning/30 bg-warning/10 p-2.5 col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-medium text-warning-strong block truncate">
              Impacto dos Aumentos
            </span>
            <span className="text-sm font-bold text-warning-strong tabular-nums block mt-0.5">
              +<MoneyText cents={totalAnnualizedIncreaseCents} tone="default" />/ano
            </span>
          </div>
        )}
      </div>

      {/* Lista Expansível */}
      {isExpanded && (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-border/60">
          {subscriptions.map((sub) => (
            <div
              key={sub.serviceKey}
              onClick={() => {
                triggerSensory("action");
                onSelectSubscription(sub);
              }}
              className="flex items-center justify-between p-2.5 rounded-xl bg-surface/80 hover:bg-surface-muted transition-colors cursor-pointer border border-border/40"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="font-semibold text-xs text-foreground truncate">
                  {sub.displayName}
                </span>
                {sub.hasPriceIncrease && (
                  <PriceIncreaseBadge
                    deltaPercent={sub.deltaPercent}
                    annualizedImpactCents={sub.annualizedImpactCents}
                  />
                )}
                {sub.isExchangeFluctuation && (
                  <Badge variant="muted" size="xs" title="Pequena oscilação cambial">
                    câmbio
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {sub.hasPriceIncrease && (
                  <span className="text-[11px] text-muted-foreground line-through opacity-70">
                    <MoneyText cents={sub.previousCents} tone="default" />
                  </span>
                )}
                <span className="text-xs font-bold text-foreground">
                  <MoneyText cents={sub.currentCents} tone="default" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
