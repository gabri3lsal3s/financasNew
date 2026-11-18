import type { ReactNode } from "react";
import { Badge, MoneyText } from "@/components/ui";
import {
  getDismissReason,
  isOccurrenceIgnored,
  type CalibrationDecision,
  type FeedbackDecision,
  type QualifiedDismissReason,
} from "@/domain/insights";
import { cn } from "@/lib/utils";
import { formatCentsAsBRL } from "@/services/masks/money";
import { triggerSensory } from "@/services/sensory";
import { InsightListActions } from "./InsightListActions";

export interface InsightListItemBadge {
  label: string;
  tone?: "default" | "positive" | "negative" | "warning" | "critical" | "muted";
}

export interface InsightListItemData {
  key: string;
  title: string;
  subtitle?: string;
  confidence?: number;
  tag?: string;
  tagTone?: "default" | "positive" | "negative" | "warning" | "critical" | "muted";
  badges?: readonly InsightListItemBadge[];
  amountCents?: number;
  icon?: ReactNode;
  dismissReason?: QualifiedDismissReason;
}

export interface InsightListRowProps {
  item: InsightListItemData;
  state?: FeedbackDecision;
  onIgnore?: (key: string) => void;
  onIgnoreWithReason?: (key: string, reason: CalibrationDecision) => void;
  onConfirm?: (key: string) => void;
  onRestore?: (key: string) => void;
  onItemClick?: (key: string) => void;
  onConvert?: (key: string) => void;
  formatAmount?: (cents: number) => string;
}

function getDismissBadgeLabel(reason: QualifiedDismissReason | undefined): string {
  if (reason === "already_cancelled") return "Cancelada";
  if (reason === "not_subscription") return "Não é assinatura";
  if (reason === "one_off") return "Pontual";
  return "Ignorada";
}

export function InsightListRow({
  item,
  state,
  onIgnore,
  onIgnoreWithReason,
  onConfirm,
  onRestore,
  onItemClick,
  onConvert,
  formatAmount,
}: InsightListRowProps) {
  const confirmed = state === "confirm";
  const isEssential = state === "essential";
  const ignored = isOccurrenceIgnored(state);
  const reason = item.dismissReason ?? getDismissReason(state);
  const isClickable = Boolean(onItemClick);
  const useCustomFormatter = Boolean(formatAmount && formatAmount !== formatCentsAsBRL);

  const handleOpenItem = () => {
    if (!onItemClick) return;
    triggerSensory("selection");
    onItemClick(item.key);
  };

  return (
    <li
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 rounded-xl border border-border/80 bg-surface p-3 shadow-xs transition-colors min-w-0",
        ignored && "opacity-65",
      )}
    >
      <div
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : undefined}
        aria-label={isClickable ? `Ver detalhes de ${item.title}` : undefined}
        onClick={isClickable ? handleOpenItem : undefined}
        onKeyDown={
          isClickable
            ? (e) => {
                if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  handleOpenItem();
                }
              }
            : undefined
        }
        className={cn(
          "flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3 rounded-lg p-1 -m-1",
          isClickable &&
            "cursor-pointer transition-colors hover:bg-surface-hover/60 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        )}
      >
        {item.icon ? (
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center text-muted-foreground">
            {item.icon}
          </span>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <h3 className="text-sm font-medium text-foreground line-clamp-2 break-words">
              {item.title}
            </h3>
            {item.badges?.map((b) => (
              <Badge
                key={b.label}
                variant={b.tone ?? "default"}
                size="xs"
                className="shrink-0 max-w-full truncate"
              >
                {b.label}
              </Badge>
            ))}
            {item.tag ? (
              <Badge
                variant={item.tagTone ?? "default"}
                size="xs"
                className="shrink-0 max-w-full truncate"
              >
                {item.tag}
              </Badge>
            ) : null}
            {ignored ? (
              <Badge
                variant={
                  reason === "already_cancelled"
                    ? "positive"
                    : reason === "not_subscription"
                      ? "warning"
                      : "muted"
                }
                size="xs"
                className="shrink-0 max-w-full truncate"
              >
                {getDismissBadgeLabel(reason)}
              </Badge>
            ) : null}
          </div>

          {item.subtitle ? (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 break-words">
              {item.subtitle}
            </p>
          ) : null}

          {item.confidence !== undefined ? (
            <p className="text-[11px] text-muted-foreground">
              Confiança{" "}
              <span className="num font-medium text-foreground">
                {Math.round(item.confidence * 100)}%
              </span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between sm:justify-end gap-2.5 pt-1 sm:pt-0">
        {item.amountCents !== undefined && item.amountCents > 0 ? (
          useCustomFormatter && formatAmount ? (
            <span className="num text-sm font-semibold text-negative-strong whitespace-nowrap tabular-nums">
              {formatAmount(item.amountCents)}
            </span>
          ) : (
            <MoneyText
              cents={item.amountCents}
              tone="negative"
              sign="none"
              className="text-sm font-semibold"
            />
          )
        ) : null}

        <InsightListActions
          itemKey={item.key}
          title={item.title}
          amountCents={item.amountCents}
          ignored={ignored}
          confirmed={confirmed}
          isEssential={isEssential}
          onIgnore={onIgnore}
          onIgnoreWithReason={onIgnoreWithReason}
          onConfirm={onConfirm}
          onRestore={onRestore}
          onConvert={onConvert}
        />
      </div>
    </li>
  );
}
