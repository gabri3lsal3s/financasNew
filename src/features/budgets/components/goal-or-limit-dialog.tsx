import { useId, type ReactNode } from "react";
import { Edit2 } from "lucide-react";
import { Alert, Button, FormField, Modal, ModalFooter, MoneyInput } from "@/components/ui";
import type { Category } from "@/types";

export interface GoalOrLimitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  inputId: string;
  amountLabel: string;
  inputAriaLabel: string;
  inputPlaceholder?: string;
  statusNote?: string;
  helperText?: string;
  cents: number;
  onCentsChange: (cents: number) => void;
  error: string | null;
  pending: boolean;
  saveDisabled?: boolean;
  saveLabel: string;
  saveAriaLabel: string;
  canRemove: boolean;
  removeLabel: string;
  onSave: () => void;
  onRemove: () => void;
  extraContent?: ReactNode;
  category: Category;
  onEditCategory?: (category: Category) => void;
}

/**
 * Base compartilhada para definição de limite de despesa (`LimitDialog`)
 * e meta de renda (`IncomeGoalDialog`), garantindo paridade visual e ergonômica.
 */
export function GoalOrLimitDialog({
  open,
  onOpenChange,
  title,
  description,
  inputId,
  amountLabel,
  inputAriaLabel,
  inputPlaceholder,
  statusNote,
  helperText,
  cents,
  onCentsChange,
  error,
  pending,
  saveDisabled = false,
  saveLabel,
  saveAriaLabel,
  canRemove,
  removeLabel,
  onSave,
  onRemove,
  extraContent,
  category,
  onEditCategory,
}: GoalOrLimitDialogProps) {
  const formId = useId();
  const handleClose = () => onOpenChange(false);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="md"
      showCalculator
      footer={
        <ModalFooter
          borderless
          destructiveAction={
            canRemove ? (
              <Button
                type="button"
                variant="ghost"
                sensoryIntent={false}
                className="text-critical-strong hover:bg-critical/10"
                onClick={onRemove}
                disabled={pending}
              >
                {removeLabel}
              </Button>
            ) : null
          }
        >
          <Button type="button" variant="outline" onClick={handleClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            sensoryIntent={false}
            disabled={saveDisabled || pending}
            aria-label={saveAriaLabel}
          >
            {pending ? (
              "Salvando…"
            ) : (
              <>
                <span className="hidden sm:inline">{saveLabel}</span>
                <span className="sm:hidden">Salvar</span>
              </>
            )}
          </Button>
        </ModalFooter>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          if (!saveDisabled && !pending) {
            onSave();
          }
        }}
        className="mt-2 flex flex-col gap-4"
      >
        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="flex flex-col gap-1.5">
          {statusNote ? (
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={inputId} className="text-xs font-semibold text-foreground select-none">
                {amountLabel}
              </label>
              <span className="text-[11px] text-muted-foreground font-medium">{statusNote}</span>
            </div>
          ) : null}

          <FormField
            label={statusNote ? undefined : amountLabel}
            htmlFor={inputId}
            helperText={helperText}
          >
            <MoneyInput
              id={inputId}
              cents={cents}
              onCentsChange={onCentsChange}
              aria-label={inputAriaLabel}
              placeholder={inputPlaceholder}
            />
          </FormField>
        </div>

        {extraContent}

        {onEditCategory ? (
          <div className="flex items-center justify-between border-t border-border/80 pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              sensoryIntent="selection"
              className="text-xs text-muted-foreground hover:text-foreground gap-1.5 px-0"
              onClick={() => {
                handleClose();
                onEditCategory(category);
              }}
            >
              <Edit2 className="size-3.5" aria-hidden="true" />
              <span>Editar detalhes da categoria (nome, cor, ícone)</span>
            </Button>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
