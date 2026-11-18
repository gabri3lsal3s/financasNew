import { Link } from "react-router";
import { ArrowRight, Calendar, MapPin } from "lucide-react";
import { Badge, Card, buttonVariants } from "@/components/ui";
import { formatDateBR } from "@/lib/date";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import type { Trip } from "@/types/trips";

export interface TripListCardProps {
  trip: Trip;
  isHost: boolean;
}

export function TripListCard({ trip, isHost }: TripListCardProps) {
  const statusLabel =
    trip.status === "completed"
      ? "Finalizada"
      : trip.status === "settling"
        ? "Em Acerto"
        : "Ativa";

  const statusVariant =
    trip.status === "completed"
      ? "positive"
      : trip.status === "settling"
        ? "warning"
        : "muted";

  return (
    <Card className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-surface shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
      <div className="space-y-1.5 min-w-0">
        <h2 className="font-display text-base font-bold text-foreground line-clamp-2 break-words">
          {trip.title}
        </h2>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge size="xs" variant={isHost ? "default" : "positive"}>
            {isHost ? "Organizador" : "Participante"}
          </Badge>
          <Badge size="xs" variant={statusVariant}>
            {statusLabel}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-0.5">
          {trip.destination ? (
            <span className="inline-flex items-center gap-1 min-w-0">
              <MapPin className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <span className="truncate">{trip.destination}</span>
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 shrink-0">
            <Calendar className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
            <span className="tabular-nums">
              {formatDateBR(trip.start_date)} até {formatDateBR(trip.end_date)}
            </span>
          </span>
        </div>
      </div>

      <Link
        to={`/viagens/${trip.id}`}
        onClick={() => triggerSensory("selection")}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "self-stretch sm:self-center shrink-0 w-full sm:w-auto min-h-11 sm:min-h-8 gap-1.5",
        )}
      >
        <span>Acessar Detalhes</span>
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </Card>
  );
}
