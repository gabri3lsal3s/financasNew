import { Archive, ArchiveRestore, Check, Eye, EyeOff, RotateCw, Trash2 } from "lucide-react";
import { Button, ModalFooter } from "@/components/ui";

export interface ShareGoalActiveFooterProps {
  isShared: boolean;
  isRevoked: boolean;
  isArchived: boolean;
  isCompleted: boolean;
  isPending: boolean;
  onClose: () => void;
  onRequestDelete: () => void;
  onRequestRevoke: () => void;
  onRestoreLink: () => void;
  onRequestRegenerate: () => void;
  onToggleArchive: () => void;
  onToggleStatus: () => void;
}

export function ShareGoalActiveFooter({
  isShared,
  isRevoked,
  isArchived,
  isCompleted,
  isPending,
  onClose,
  onRequestDelete,
  onRequestRevoke,
  onRestoreLink,
  onRequestRegenerate,
  onToggleArchive,
  onToggleStatus,
}: ShareGoalActiveFooterProps) {
  return (
    <ModalFooter borderless className="block w-full [&_button]:sm:min-w-0 p-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 w-full min-w-0">
        <div className="flex items-center gap-1.5 shrink-0 order-last sm:order-first pt-2 sm:pt-0 border-t border-border/60 sm:border-t-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Excluir meta"
            title="Excluir meta definitivamente"
            className="size-8 !size-8 !min-w-8 !w-8 p-0 text-critical-strong hover:text-critical-strong hover:bg-critical/10 shrink-0 justify-center"
            onClick={onRequestDelete}
            disabled={isPending}
          >
            <Trash2 className="size-4 shrink-0" aria-hidden="true" />
            <span className="sr-only">Excluir meta</span>
          </Button>

          {isShared &&
            (isRevoked ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                sensoryIntent="success"
                aria-label="Reativar link público"
                title="Reativar link público do termômetro"
                onClick={onRestoreLink}
                disabled={isPending}
                className="size-8 !size-8 !min-w-8 !w-8 p-0 text-warning-strong hover:text-warning-strong hover:bg-warning/10 shrink-0 justify-center"
              >
                <Eye className="size-4 shrink-0" aria-hidden="true" />
                <span className="sr-only">Reativar link público</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Pausar link público"
                title="Pausar link público temporariamente"
                className="size-8 !size-8 !min-w-8 !w-8 p-0 text-muted-foreground hover:text-foreground shrink-0 justify-center"
                onClick={onRequestRevoke}
                disabled={isPending}
              >
                <EyeOff className="size-4 shrink-0" aria-hidden="true" />
                <span className="sr-only">Pausar link público</span>
              </Button>
            ))}

          {isShared && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Regenerar link público"
              title="Regenerar link público (novo endereço)"
              onClick={onRequestRegenerate}
              disabled={isPending}
              className="size-8 !size-8 !min-w-8 !w-8 p-0 text-muted-foreground hover:text-foreground shrink-0 justify-center"
            >
              <RotateCw className="size-4 shrink-0" aria-hidden="true" />
              <span className="sr-only">Regenerar link público</span>
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={isArchived ? "Desarquivar meta" : "Arquivar meta"}
            title={
              isArchived
                ? "Desarquivar meta (voltar para ativas)"
                : "Arquivar meta (ocultar da Home e alertas)"
            }
            onClick={onToggleArchive}
            disabled={isPending}
            className="size-8 !size-8 !min-w-8 !w-8 p-0 text-muted-foreground hover:text-foreground shrink-0 justify-center"
          >
            {isArchived ? (
              <>
                <ArchiveRestore className="size-4 shrink-0" aria-hidden="true" />
                <span className="sr-only">Desarquivar meta</span>
              </>
            ) : (
              <>
                <Archive className="size-4 shrink-0" aria-hidden="true" />
                <span className="sr-only">Arquivar meta</span>
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto order-first sm:order-last">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs px-3 sm:px-4 !min-w-0 sm:!min-w-[80px]"
          >
            Fechar
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            sensoryIntent="success"
            aria-label={isCompleted ? "Reabrir meta" : "Marcar como concluída"}
            title={isCompleted ? "Reabrir meta" : "Marcar como concluída"}
            onClick={onToggleStatus}
            disabled={isPending}
            className="gap-1.5 h-8 text-xs font-semibold px-3 sm:px-4 !min-w-0 sm:!min-w-[120px] shrink-0"
          >
            <Check className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{isCompleted ? "Reabrir Meta" : "Concluir Meta"}</span>
          </Button>
        </div>
      </div>
    </ModalFooter>
  );
}
