/**
 * Banner de Viagem Ativa na Home / Visão Geral.
 * Cumpre a Regra 13 (Nível 2 Prominent Badge Icon), Regra 19 e Regra 35 do AGENTS.md.
 */

import { useNavigate } from "react-router";
import { ArrowRight, Plane } from "lucide-react";
import { AlertCarouselCard } from "@/components/modules/alert-carousel-card";
import { MoneyText } from "@/components/ui/money-text";
import {
  resolveCarouselCardPolicy,
  type CarouselDismissPreset,
} from "@/domain/notifications/hub";
import { formatDateBR } from "@/lib/date";
import { triggerSensory } from "@/services/sensory";
import type { Trip } from "@/types/trips";

export interface ActiveTripBannerProps {
  trip: Trip;
  totalExpensesCents?: number;
  onDismiss?: (days: 7 | 30) => void;
  onSelectPreset?: (preset: CarouselDismissPreset) => void;
}

export function ActiveTripBanner({
  trip,
  totalExpensesCents,
  onDismiss,
  onSelectPreset,
}: ActiveTripBannerProps) {
  const navigate = useNavigate();
  const hasExpensesTotal = typeof totalExpensesCents === "number";
  const cardKey = `trip.active.${trip.id}`;
  const policy = resolveCarouselCardPolicy(cardKey);

  return (
    <AlertCarouselCard
      id={cardKey}
      tone="info"
      role="region"
      ariaLabel={`Viagem ativa: ${trip.title}`}
      icon={<Plane className="size-4.5" />}
      title={trip.title}
      badge={{ label: "Viagem Ativa", variant: "default" }}
      description={
        <span className="inline-flex items-center gap-1.5 min-w-0">
          {trip.destination ? <span>{trip.destination} ·</span> : null}
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
            <span>
              {formatDateBR(trip.start_date)} até {formatDateBR(trip.end_date)}
            </span>
          )}
        </span>
      }
      primaryAction={{
        label: "Acessar Viagem",
        onClick: () => {
          triggerSensory("selection");
          navigate(`/viagens/${trip.id}`);
        },
        variant: "default",
        icon: <ArrowRight className="size-3.5" aria-hidden="true" />,
      }}
      dismissPolicy={
        onSelectPreset || onDismiss
          ? {
              allowedPresets: policy.allowedPresets,
              onSelectPreset: (preset) => {
                if (onSelectPreset) onSelectPreset(preset);
                else onDismiss?.(preset === "7d" ? 7 : 30);
              },
              label: "Dispensar aviso de viagem ativa",
            }
          : undefined
      }
    />
  );
}
