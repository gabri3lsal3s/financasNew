import { useState } from "react";
import { FolderCheck } from "lucide-react";
import { Button, Modal, ModalFooter, MoneyText } from "@/components/ui";
import { CategoryIcon } from "@/components/modules/category-icon";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

export interface SelectSplitCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  amountCents: number;
  sentCategoryName?: string;
  categories: Category[];
  isPending?: boolean;
  onConfirm: (categoryId: string) => void;
}

export function SelectSplitCategoryDialog({
  open,
  onOpenChange,
  title,
  amountCents,
  sentCategoryName,
  categories,
  isPending = false,
  onConfirm,
}: SelectSplitCategoryDialogProps) {
  const [selectedId, setSelectedId] = useState<string>("");

  const effectiveSelectedId =
    selectedId && categories.some((c) => c.id === selectedId)
      ? selectedId
      : (categories[0]?.id ?? "");

  const handleConfirm = () => {
    if (!effectiveSelectedId) return;
    onConfirm(effectiveSelectedId);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Escolha uma Categoria"
      description={
        sentCategoryName
          ? `A despesa original veio como "${sentCategoryName}", mas não encontramos uma categoria correspondente na sua conta.`
          : "Selecione em qual categoria da sua conta você deseja registrar esta despesa."
      }
      footer={
        <ModalFooter borderless>
          <Button type="button" variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={!effectiveSelectedId || isPending}
            loading={isPending}
            onClick={handleConfirm}
            className="gap-1.5"
          >
            <FolderCheck className="size-3.5" aria-hidden="true" />
            <span>Salvar nesta Categoria</span>
          </Button>
        </ModalFooter>
      }
    >
      <div className="space-y-4 py-1">
        <div className="rounded-xl border border-border/80 bg-surface/80 p-3 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground truncate">{title}</span>
            <MoneyText cents={amountCents} variant="value" tone="default" className="font-semibold" />
          </div>
          <p className="text-[11px] text-muted-foreground">Sua cota a ser salva no extrato</p>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-foreground block">
            Categorias disponíveis ({categories.length})
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {categories.map((category) => {
              const isSelected = effectiveSelectedId === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    triggerSensory("selection");
                    setSelectedId(category.id);
                  }}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    isSelected
                      ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                      : "border-border/80 bg-surface hover:bg-surface-hover text-muted-foreground",
                  )}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-hover">
                    <CategoryIcon icon={category.icon} color={category.color} className="size-4" />
                  </span>
                  <span className="text-xs font-medium text-foreground truncate">
                    {category.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
