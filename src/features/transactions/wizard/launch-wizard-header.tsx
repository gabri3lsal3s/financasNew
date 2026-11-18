import { ClipboardPaste, Paperclip, Zap } from "lucide-react";
import { Button } from "@/components/ui";
import type { WizardMode } from "./wizard-types";

export interface LaunchWizardHeaderActionsProps {
  mode: WizardMode;
  hasDetectedPix: boolean;
  onSwitchToQuick: () => void;
  onPastePix: () => void;
  onOpenAttach: () => void;
}

export function LaunchWizardHeaderActions({
  mode,
  hasDetectedPix,
  onSwitchToQuick,
  onPastePix,
  onOpenAttach,
}: LaunchWizardHeaderActionsProps) {
  return (
    <div className="flex items-center gap-1">
      {mode === "guided" ? (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          sensoryIntent="selection"
          onClick={onSwitchToQuick}
          className="gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Alternar para modo rápido"
        >
          <Zap className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Modo rápido</span>
        </Button>
      ) : null}
      {hasDetectedPix ? (
        <Button
          type="button"
          variant="outline"
          size="xs"
          sensoryIntent={false}
          onClick={onPastePix}
          className="gap-1 border-primary/30 bg-surface-raised px-2.5 text-xs font-medium text-primary-strong shadow-xs hover:bg-primary/5"
          aria-label="Colar comprovante Pix"
        >
          <ClipboardPaste className="size-3.5 text-primary-strong" aria-hidden="true" />
          <span className="hidden sm:inline">Colar Pix</span>
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="xs"
        onClick={onOpenAttach}
        className="gap-1.5 border-border/80 bg-surface-raised px-2.5 text-xs font-medium text-foreground shadow-xs hover:bg-surface-hover"
        aria-label="Anexar comprovante ou cupom fiscal"
      >
        <Paperclip className="size-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Anexar</span>
      </Button>
    </div>
  );
}
