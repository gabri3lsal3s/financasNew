import { cn } from "@/lib/utils";

export interface DiagnosticCardProps {
  icon?: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  tone?: "positive" | "negative" | "neutral";
  badge?: React.ReactNode;
}


export function DiagnosticCard({ icon, label, value, subtitle, tone, badge }: DiagnosticCardProps) {
  return (
    <div className="flex flex-col justify-between gap-2 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 min-w-0 shadow-xs">
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <span className="line-clamp-2 text-xs font-medium text-muted-foreground leading-snug break-words">
            {label}
          </span>
          {badge ? <div className="self-start">{badge}</div> : null}
        </div>
        {icon ? <span className="shrink-0 text-muted-foreground mt-0.5">{icon}</span> : null}
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span
          className={cn(
            "text-base sm:text-lg lg:text-xl font-semibold tabular-nums tracking-tight whitespace-nowrap overflow-x-auto no-scrollbar",
            tone === "positive"
              ? "text-positive-strong"
              : tone === "negative"
                ? "text-critical-strong"
                : "text-foreground",
          )}
        >
          {value}
        </span>
        {subtitle ? (
          <span className="text-[11px] text-muted-foreground line-clamp-1 break-words">{subtitle}</span>
        ) : null}
      </div>
    </div>
  );
}

