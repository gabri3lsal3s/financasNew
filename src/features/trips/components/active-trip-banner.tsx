/**
 * Banner de Viagem Ativa na Home / Visão Geral.
 * Cumpre a Regra 13 (Nível 2 Prominent Badge Icon) e Regra 19 do AGENTS.md.
 */

import { Link } from "react-router";
import { ArrowRight, Plane } from "lucide-react";
import { CarouselDismissPopover } from "@/components/modules/carousel-dismiss-popover";
import { Badge, buttonVariants } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { formatDateBR } from "@/lib/date";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import type { Trip } from "@/types/trips";

export interface ActiveTripBannerProps {
  trip: Trip;
  totalExpensesCents?: number;
  onDismiss?: (days: 7 | 30) => void;
}

export function ActiveTripBanner({
  trip,
  totalExpensesCents,
  onDismiss,
}: ActiveTripBannerProps) {
  const hasExpensesTotal = typeof totalExpensesCents === "number";

  return (
    <div
      role="region"
      aria-label={`Viagem ativa: ${trip.title}`}
      className="relative w-full h-full min-h-[104px] sm:min-h-[84px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl border border-border/80 bg-surface shadow-xs"
    >
      <div className={cn("flex items-start sm:items-center gap-3 min-w-0 flex-1", onDismiss && "pr-6 sm:pr-0")}>
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-primary/10 border-primary/20 text-primary-strong"
          aria-hidden="true"
        >
          <Plane className="size-4.5" />
        </span>

        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <h2
              className="text-sm font-semibold text-foreground truncate"
              title={trip.title}
            >
              {trip.title}
            </h2>
            <Badge size="xs" variant="default" className="shrink-0">
              Viagem Ativa
            </Badge>
          </div>

          <div className="flex items-center gap-1.5 min-w-0 text-xs text-muted-foreground">
            {trip.destination ? (
              <span className="truncate">{trip.destination} ·</span>
            ) : null}

            {hasExpensesTotal ? (
              <span className="inline-flex items-center gap-1 shrink-0">
                <span>Total gasto:</span>
                <MoneyText
                  cents={totalExpensesCents}
                  tone="default"
                  variant="caption"
                  className="font-semibold text-foreground"
                />
              </span>
            ) : (
              <span className="truncate">
                {formatDateBR(trip.start_date)} até {formatDateBR(trip.end_date)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 w-full sm:w-auto self-stretch sm:self-center mt-auto sm:mt-0">
        <Link
          to={`/viagens/${trip.id}`}
          onClick={() => triggerSensory("selection")}
          className={cn(
            buttonVariants({ variant: "default", size: "sm" }),
            "h-8 text-xs gap-1.5 flex-1 sm:flex-initial justify-center shrink-0",
          )}
        >
          <span>Acessar Viagem</span>
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>

        {onDismiss ? (
          <div className="absolute top-3 right-3 sm:static">
            <CarouselDismissPopover
              onDismiss={onDismiss}
              label="Dispensar aviso de viagem ativa"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
