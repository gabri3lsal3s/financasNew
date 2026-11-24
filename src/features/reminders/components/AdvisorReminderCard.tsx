import {
  AlertTriangle,
  ArrowDownLeft,
  HelpCircle,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { Badge, Button, MoneyText } from "@/components/ui";
import type { SmartAdvisorInsight } from "@/domain/insights/advisor";
import {
  resolveSmartAdvisorPresentation,
  type AdvisorIconKind,
} from "@/features/overview/components/smart-advisor/smart-advisor-routing";
import { cn } from "@/lib/utils";

const ADVISOR_ICON_MAP: Record<AdvisorIconKind, typeof AlertTriangle> = {
  household: Users,
  aporte: TrendingUp,
  critical: AlertTriangle,
  income: ArrowDownLeft,
  savings: TrendingDown,
  calibration: HelpCircle,
  celebration: Sparkles,
};

const CONTAINER_TONES: Record<
  "critical" | "muted" | "portfolio" | "positive" | "warning",
  string
> = {
  critical: "bg-critical/10 border-critical/20 text-critical-strong",
  positive: "bg-positive/10 border-positive/20 text-positive-strong",
  portfolio: "bg-portfolio/10 border-portfolio/20 text-portfolio",
  warning: "bg-warning/15 border-warning/20 text-warning-strong",
  muted: "bg-primary/10 border-primary/20 text-primary-strong",
};

export interface AdvisorReminderCardProps {
  advisorItem: SmartAdvisorInsight;
  onOpen: (item: SmartAdvisorInsight) => void;
  onDismiss: (themeKey: string) => void;
}

export function AdvisorReminderCard({
  advisorItem,
  onOpen,
  onDismiss,
}: AdvisorReminderCardProps) {
  const presentation = resolveSmartAdvisorPresentation(advisorItem);
  const Icon = ADVISOR_ICON_MAP[presentation.iconKind];
  const isIncome = advisorItem.category === "income";
  const cardName = advisorItem.cardContext?.cardName ?? advisorItem.metadata?.cardName;

  return (
    <article className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface p-4 shadow-xs min-w-0 overflow-hidden">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl border",
            CONTAINER_TONES[presentation.badgeVariant],
          )}
        >
          <Icon className="size-4.5" aria-hidden="true" />
        </span>

        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h3 className="text-sm font-semibold text-foreground line-clamp-2 break-words min-w-0">
              {advisorItem.title}
            </h3>
            <Badge variant={presentation.badgeVariant} size="xs" className="shrink-0">
              {presentation.badgeLabel}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {advisorItem.description}
          </p>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-xs text-muted-foreground">
            {advisorItem.metadata?.valueCents !== undefined ? (
              <MoneyText
                cents={advisorItem.metadata.valueCents}
                tone="default"
                className="font-semibold text-foreground text-xs"
              />
            ) : null}
            {cardName ? (
              <span
                className={cn(
                  advisorItem.metadata?.valueCents !== undefined && "border-l border-border/80 pl-1.5",
                )}
              >
                {cardName}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
        <Button
          type="button"
          size="sm"
          variant={isIncome ? "default" : "outline"}
          onClick={() => onOpen(advisorItem)}
          className="h-8 max-sm:min-h-11 text-xs font-medium"
        >
          {advisorItem.primaryAction?.label ?? (isIncome ? "Informar valor" : "Ver detalhe")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          sensoryIntent="selection"
          className="size-8 max-sm:min-h-11 max-sm:min-w-11 shrink-0 text-muted-foreground hover:text-foreground hover:bg-surface-active"
          onClick={() => onDismiss(advisorItem.themeKey)}
          title="Dispensar aviso por 30 dias"
          aria-label={`Dispensar ${advisorItem.title}`}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </article>
  );
}
