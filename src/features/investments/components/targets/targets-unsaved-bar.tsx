import { Button } from "@/components/ui";

export interface TargetsUnsavedBarProps {
  onDiscard: () => void;
}

export function TargetsUnsavedBar({ onDiscard }: TargetsUnsavedBarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl border border-warning/20 bg-warning/10">
      <span className="text-xs sm:text-sm font-medium text-warning-strong">
        Existem alterações não salvas no rascunho de metas.
      </span>
      <div className="flex items-center gap-2 self-stretch sm:self-auto">
        <Button
          type="button"
          variant="outline"
          size="sm"
          sensoryIntent="selection"
          onClick={onDiscard}
          className="flex-1 sm:flex-none"
        >
          Descartar alterações
        </Button>
      </div>
    </div>
  );
}
