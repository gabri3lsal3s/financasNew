import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui";
import { InsightList, type InsightListItemData } from "@/components/modules";
import type { CalibrationDecision, FeedbackMap } from "@/domain/insights";

export interface CollapsibleOccurrencesSectionProps {
  ariaLabel: string;
  toggleLabel: string;
  description: string;
  icon: ReactNode;
  open: boolean;
  onToggle: () => void;
  items: readonly InsightListItemData[];
  feedbackMap: FeedbackMap;
  onIgnore?: (key: string) => void;
  onIgnoreWithReason?: (key: string, reason: CalibrationDecision) => void;
  onConfirm?: (key: string) => void;
  onRestore: (key: string) => void;
  onItemClick: (key: string) => void;
  onConvert: (key: string) => void;
}

export function CollapsibleOccurrencesSection({
  ariaLabel,
  toggleLabel,
  description,
  icon,
  open,
  onToggle,
  items,
  feedbackMap,
  onIgnore,
  onIgnoreWithReason,
  onConfirm,
  onRestore,
  onItemClick,
  onConvert,
}: CollapsibleOccurrencesSectionProps) {
  return (
    <section aria-label={ariaLabel} className="flex flex-col gap-2 pt-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        sensoryIntent="selection"
        onClick={onToggle}
        className="flex items-center justify-between gap-2 self-start max-sm:min-h-11 text-xs text-muted-foreground hover:text-foreground"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5 font-medium">
          {icon}
          {toggleLabel}
        </span>
        {open ? (
          <ChevronUp className="size-3.5" aria-hidden="true" />
        ) : (
          <ChevronDown className="size-3.5" aria-hidden="true" />
        )}
      </Button>

      {open ? (
        <div className="flex flex-col gap-2.5 rounded-xl border border-dashed border-border/80 bg-surface-raised/50 p-3 sm:p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          <InsightList
            items={items}
            feedback={feedbackMap}
            onIgnore={onIgnore}
            onIgnoreWithReason={onIgnoreWithReason}
            onConfirm={onConfirm}
            onRestore={onRestore}
            onItemClick={onItemClick}
            onConvert={onConvert}
          />
        </div>
      ) : null}
    </section>
  );
}
