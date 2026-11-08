/**
 * Banner de Viagem Ativa na Home / Visão Geral.
 * Cumpre a Regra 13 (Nível 2 Prominent Badge Icon) e Regra 19 do AGENTS.md.
 */

import { Link } from "react-router";
import { Plane, ArrowRight } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { formatCentsAsBRL } from "@/services/masks/money";
import type { Trip } from "@/types/trips";

export interface ActiveTripBannerProps {
  trip: Trip;
  totalExpensesCents?: number;
}

export function ActiveTripBanner({
  trip,
  totalExpensesCents = 0,
}: ActiveTripBannerProps) {
  return (
    <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl border border-border/80 bg-surface shadow-xs">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-primary/10 border-primary/20 text-primary-strong">
          <Plane className="size-4.5" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground truncate">
              {trip.title}
            </span>
            <Badge size="xs" variant="positive">
              Viagem Ativa
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            {trip.destination ? `${trip.destination} • ` : ""}
            Total gasto: {formatCentsAsBRL(totalExpensesCents)}
          </p>
        </div>
      </div>

      <Link
        to={`/viagens/${trip.id}`}
        className="self-stretch sm:self-center mt-auto sm:mt-0"
      >
        <Button size="sm" variant="default" className="h-8 text-xs gap-1.5 w-full sm:w-auto">
          Acessar Viagem
          <ArrowRight className="size-3" aria-hidden="true" />
        </Button>
      </Link>
    </div>
  );
}
