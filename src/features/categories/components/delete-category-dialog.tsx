import { useState } from "react";
import { Alert, Button, Modal, Select, Skeleton } from "@/components/ui";
import { getErrorMessage } from "@/services/errors";
import { useDeleteCategory } from "@/state";
import type { Category } from "@/types";

export interface DeleteCategoryDialogProps {
  category: Category;
  /** Outras categorias do MESMO tipo (destinos possíveis de migração). */
  siblings: Category[];
  /** Uso atual da categoria (lançamentos vinculados). */
  usage: { expenses: number; incomes: number } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Exclusão de categoria com migração opcional (§3.5.1 — RPC delete_category_migrate). */
export function DeleteCategoryDialog({ category, siblings, usage, open, onOpenChange }: DeleteCategoryDialogProps) {
  const [migrateTo, setMigrateTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const deleteCategory = useDeleteCategory();

  const total = usage ? usage.expenses + usage.incomes : 0;

  const reset = () => {
    setError(null);
    setMigrateTo("");
  };

  const handleConfirm = async () => {
    setError(null);
    try {
      await deleteCategory.mutateAsync({ id: category.id, migrateTo: migrateTo || null });
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (next) reset();
        onOpenChange(next);
      }}
      title={`Excluir ${category.name}?`}
    >
      <div className="mt-4 flex flex-col gap-4">
        {error ? <Alert variant="error">{error}</Alert> : null}

        {usage === null ? (
          <Skeleton className="h-10 w-full" />
        ) : total > 0 ? (
          <>
            <p className="text-sm text-muted-foreground">
              Esta categoria tem <strong className="text-foreground">{total}</strong> lançamento(s). Para excluí-la, os
              lançamentos precisam ser movidos para outra categoria do mesmo tipo.
            </p>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Mover lançamentos para</span>
              <Select
                value={migrateTo}
                onValueChange={setMigrateTo}
                options={siblings.map((sibling) => ({ value: sibling.id, label: sibling.name }))}
                placeholder="Selecione a categoria"
                ariaLabel="Categoria de destino da migração"
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Esta categoria não tem lançamentos — pode ser excluída diretamente.</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={total > 0 && migrateTo === ""}
            onClick={() => void handleConfirm()}
          >
            {deleteCategory.isPending ? "Excluindo…" : "Excluir categoria"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
