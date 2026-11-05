import { useState } from "react";
import { FolderCheck } from "lucide-react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { CategoryIcon } from "@/components/modules/category-icon";
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
  const [selectedId, setSelectedId] = useState<string>(() => {
    return categories[0]?.id ?? "";
  });

  const handleConfirm = () => {
    if (!selectedId) return;
    onConfirm(selectedId);
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
    >
      <div className="space-y-4 py-1">
        <div className="rounded-xl border border-border/70 bg-surface/80 p-3 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground truncate">{title}</span>
            <MoneyText cents={amountCents} variant="value" className="font-semibold" />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Sua cota a ser salva no extrato
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            Categorias disponíveis ({categories.length})
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
            {categories.map((category) => {
              const isSelected = selectedId === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedId(category.id)}
                  className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                      : "border-border/70 bg-surface hover:bg-surface-hover text-muted-foreground"
                  }`}
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

      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => onOpenChange(false)}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          variant="default"
          disabled={!selectedId || isPending}
          onClick={handleConfirm}
          className="gap-1.5"
        >
          <FolderCheck className="size-3.5" aria-hidden="true" />
          <span>{isPending ? "Salvando…" : "Salvar nesta Categoria"}</span>
        </Button>
      </ModalFooter>
    </Modal>
  );
}
