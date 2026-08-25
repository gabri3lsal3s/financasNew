import { cn } from "@/lib/utils";

export interface DiagnosticCardProps {
  icon?: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  tone?: "positive" | "negative" | "neutral";
}

export function DiagnosticCard({ icon, label, value, subtitle, tone }: DiagnosticCardProps) {
  return (
    <div className="flex flex-col justify-between gap-2 rounded-xl border border-border bg-surface p-3.5 sm:p-4 min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
        {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
      </div>
      <div className="flex flex-col gap-0.5">
        <span
          className={cn(
            "num text-lg sm:text-xl font-semibold truncate",
            tone === "positive"
              ? "text-positive-strong"
              : tone === "negative"
                ? "text-critical"
                : "text-foreground",
          )}
        >
          {value}
        </span>
        {subtitle ? <span className="text-[11px] text-muted-foreground truncate">{subtitle}</span> : null}
      </div>
    </div>
  );
}
