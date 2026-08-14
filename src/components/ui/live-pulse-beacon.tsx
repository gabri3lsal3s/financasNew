import { cn } from "@/lib/utils";

export interface LivePulseBeaconProps {
  variant?: "primary" | "positive" | "warning" | "critical";
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}

const colorClasses = {
  primary: "bg-primary text-primary",
  positive: "bg-positive text-positive",
  warning: "bg-warning text-warning",
  critical: "bg-critical text-critical",
};

const sizeClasses = {
  sm: "size-2",
  md: "size-2.5",
  lg: "size-3",
};

export function LivePulseBeacon({
  variant = "primary",
  size = "md",
  className,
  label,
}: LivePulseBeaconProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="relative flex">
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
            colorClasses[variant].split(" ")[0],
          )}
        />
        <span
          className={cn(
            "relative inline-flex rounded-full",
            sizeClasses[size],
            colorClasses[variant].split(" ")[0],
          )}
        />
      </span>
      {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
    </span>
  );
}
