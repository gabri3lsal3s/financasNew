import { ArrowRight, Users } from "lucide-react";
import { useNavigate } from "react-router";
import { AlertCarouselCard } from "@/components/modules/alert-carousel-card";
import { MoneyText } from "@/components/ui/money-text";
import type { CalculationBreakdown } from "@/domain/calculation-memory";
import {
  resolveCarouselCardPolicy,
  type CarouselDismissPreset,
} from "@/domain/notifications/hub";

export interface SplitPendingItemSummary {
  id: string;
  title: string;
  pendingCents: number;
  pendingFriendsCount: number;
  totalFriendsCount: number;
}

export interface SplitPendingBannerProps {
  pendingCents: number;
  activeCount: number;
  totalExpensesCents?: number;
  items?: SplitPendingItemSummary[];
  calculationBreakdown?: CalculationBreakdown;
  onDismiss?: (days: 7 | 30) => void;
  onSelectPreset?: (preset: CarouselDismissPreset) => void;
  className?: string;
}

export function SplitPendingBanner({
  pendingCents,
  activeCount,
  items,
  calculationBreakdown,
  onDismiss,
  onSelectPreset,
  className,
}: SplitPendingBannerProps) {
  const navigate = useNavigate();
  const policy = resolveCarouselCardPolicy("split.pending");

  const handleNavigate = () => {
    const firstId = items?.[0]?.id;
    if (firstId) {
      navigate(`/transacoes?gerenciar_racha=${firstId}`);
    } else {
      navigate("/transacoes?tab=splits");
    }
  };

  return (
    <AlertCarouselCard
      id="split.pending"
      tone="portfolio"
      role="region"
      ariaLabel="Despesas a Rachar e Receber"
      className={className}
      icon={<Users className="size-4.5" />}
      title="Despesas a Rachar e Receber"
      badge={{
        label: `${activeCount} ${activeCount === 1 ? "racha a receber" : "rachas a receber"}`,
        variant: "portfolio",
      }}
      description={
        <>
          Total de{" "}
          <MoneyText
            cents={pendingCents}
            tone="portfolio"
            className="font-semibold"
          />{" "}
          a receber em reembolsos.
        </>
      }
      calculationBreakdown={calculationBreakdown}
      calculationMemoryLabel="Memória de cálculo dos rachas pendentes"
      primaryAction={{
        label: "Ver e Cobrar",
        onClick: handleNavigate,
        variant: "outline",
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
              label: "Dispensar aviso de despesas a rachar",
            }
          : undefined
      }
    />
  );
}
