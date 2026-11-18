import { Calendar, MapPin, Plus, Share2 } from "lucide-react";
import { Badge, Button, Card, MoneyText } from "@/components/ui";
import { formatDateBR } from "@/lib/date";
import type { PublicTripLedgerData } from "@/types/trips";

export interface PublicTripHeroCardProps {
  trip: PublicTripLedgerData["trip"];
  totalExpensesCents: number;
  onShareWhatsApp: () => void;
  onOpenAddExpense: () => void;
}

/**
 * Cartão hero público com informações da viagem, total gasto e ações principais.
 */
export function PublicTripHeroCard({
  trip,
  totalExpensesCents,
  onShareWhatsApp,
  onOpenAddExpense,
}: PublicTripHeroCardProps) {
  const isCompleted = trip.status === "completed";

  return (
    <Card className="border-border/80 bg-surface shadow-xs rounded-2xl overflow-hidden">
      <div className="p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground line-clamp-2 break-words">
              {trip.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
              {trip.destination && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span>{trip.destination}</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                <span>
                  {formatDateBR(trip.start_date)} até {formatDateBR(trip.end_date)}
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <Badge size="sm" variant={isCompleted ? "positive" : "muted"}>
              {isCompleted ? "Finalizada" : "Em andamento"}
            </Badge>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onShareWhatsApp}
              className="gap-1.5 text-xs"
            >
              <Share2 className="size-3.5" aria-hidden="true" />
              <span>Compartilhar</span>
            </Button>
          </div>
        </div>

        <div className="pt-3 border-t border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Total Gasto na Viagem</p>
            <div className="mt-0.5">
              <MoneyText
                cents={totalExpensesCents}
                variant="hero"
                tone="default"
                deemphasizeCents={false}
                className="text-2xl font-bold"
              />
            </div>
          </div>

          {!isCompleted && (
            <Button
              type="button"
              size="sm"
              onClick={onOpenAddExpense}
              className="h-9 gap-1.5 text-xs font-semibold self-stretch sm:self-auto"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span>Adicionar Despesa</span>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
