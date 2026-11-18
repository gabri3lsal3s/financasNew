import { useId } from "react";
import { Checkbox } from "@/components/ui";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";

export interface SplitParticipantOption {
  id: string;
  name: string;
}

export interface TripSplitParticipantsListProps {
  members: readonly SplitParticipantOption[];
  splitMode: "all" | "selected";
  onSplitModeChange: (mode: "all" | "selected") => void;
  selectedMemberIds: string[];
  onToggleMember: (memberId: string) => void;
  selectedModeLabel?: string;
}

export function TripSplitParticipantsList({
  members,
  splitMode,
  onSplitModeChange,
  selectedMemberIds,
  onToggleMember,
  selectedModeLabel = "Apenas alguns amigos",
}: TripSplitParticipantsListProps) {
  const baseId = useId();

  const handleModeClick = (mode: "all" | "selected") => {
    triggerSensory("selection");
    onSplitModeChange(mode);
  };

  return (
    <div className="space-y-2 pt-2 border-t border-border/80">
      <span className="text-xs font-semibold text-foreground block">
        Como dividir este gasto?
      </span>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => handleModeClick("all")}
          aria-pressed={splitMode === "all"}
          className={cn(
            "min-h-11 sm:min-h-10 p-2.5 rounded-xl text-xs font-medium text-center border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            splitMode === "all"
              ? "bg-primary/10 border-primary text-primary-strong"
              : "bg-surface-raised border-border text-muted-foreground hover:text-foreground",
          )}
        >
          Todos igualmente ({members.length})
        </button>
        <button
          type="button"
          onClick={() => handleModeClick("selected")}
          aria-pressed={splitMode === "selected"}
          className={cn(
            "min-h-11 sm:min-h-10 p-2.5 rounded-xl text-xs font-medium text-center border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            splitMode === "selected"
              ? "bg-primary/10 border-primary text-primary-strong"
              : "bg-surface-raised border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {selectedModeLabel} ({selectedMemberIds.length})
        </button>
      </div>

      {splitMode === "selected" && (
        <div className="space-y-2 mt-2 p-3 bg-surface-raised rounded-xl border border-border/80">
          <span className="text-[11px] text-muted-foreground block">
            Selecione quem participou desta despesa:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {members.map((m) => {
              const checkboxId = `${baseId}-member-${m.id}`;
              const isChecked = selectedMemberIds.includes(m.id);
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-2.5 text-xs px-2.5 py-2 min-h-11 sm:min-h-9 rounded-xl bg-surface border border-border/80 hover:bg-surface-hover transition-colors"
                >
                  <Checkbox
                    id={checkboxId}
                    checked={isChecked}
                    onCheckedChange={() => onToggleMember(m.id)}
                    aria-label={m.name}
                  />
                  <label
                    htmlFor={checkboxId}
                    className="flex-1 cursor-pointer text-foreground truncate font-medium select-none"
                  >
                    {m.name}
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
