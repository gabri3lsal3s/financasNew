import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { TourTrackId } from "@/domain/demo-simulation";
import type { TrackOptionMeta } from "./demo-tracks-metadata";

export interface TrackOptionCardProps {
  track: TrackOptionMeta;
  onSelect: (track: TourTrackId) => void;
}

/**
 * Cartão interativo para seleção de trilha de demonstração guiada.
 */
export function TrackOptionCard({ track, onSelect }: TrackOptionCardProps) {
  const Icon = track.icon;

  return (
    <button
      type="button"
      onClick={() => onSelect(track.id)}
      className={cn(
        "w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all flex items-start gap-3.5 group cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        track.isPrimary
          ? "border-primary/40 bg-surface hover:bg-surface-hover/80 hover:border-primary"
          : "border-border/80 bg-surface hover:bg-surface-hover/70 hover:border-primary/50",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0 mt-0.5 transition-colors",
          track.iconColorClass ?? "text-muted-foreground",
        )}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap sm:flex-nowrap">
            <h4 className="text-sm font-semibold text-foreground group-hover:text-primary-strong transition-colors">
              {track.title}
            </h4>
            {track.badge ? (
              <Badge variant={track.badgeVariant ?? "default"} size="xs" className="shrink-0">
                {track.badge}
              </Badge>
            ) : null}
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {track.description}
        </p>
      </div>

      <ChevronRight
        className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 self-center"
        aria-hidden="true"
      />
    </button>
  );
}
