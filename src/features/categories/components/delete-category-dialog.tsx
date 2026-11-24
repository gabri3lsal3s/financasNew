import { useState } from "react";
import { Alert, Button, FormField, Modal, ModalFooter, Select, Skeleton } from "@/components/ui";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
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
  /** Callback executado somente quando a exclusão é concluída com êxito. */
  onDeleted?: () => void;
  /** Eleva o z-index quando aberto sobre outro modal (default true). */
  elevated?: boolean;
}

interface DeleteCategoryContentProps {
  category: Category;
  siblings: Category[];
  usage: { expenses: number; incomes: number } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
  elevated: boolean;
}

function DeleteCategoryContent({
  category,
  siblings,
  usage,
  open,
  onOpenChange,
  onDeleted,
  elevated,
}: DeleteCategoryContentProps) {
  const [migrateTo, setMigrateTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const deleteCategory = useDeleteCategory();

  const total = usage ? usage.expenses + usage.incomes : 0;

  const handleConfirm = async () => {
    setError(null);
    try {
      await deleteCategory.mutateAsync({ id: category.id, migrateTo: migrateTo || null });
      triggerSensory("destructive");
      onOpenChange(false);
      onDeleted?.();
    } catch (err) {
      triggerSensory("error");
      setError(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Excluir ${category.name}?`}
      size="sm"
      elevated={elevated}
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteCategory.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            sensoryIntent={false}
            disabled={deleteCategory.isPending || usage === null || (total > 0 && migrateTo === "")}
            onClick={() => void handleConfirm()}
          >
            {deleteCategory.isPending ? "Excluindo…" : "Excluir categoria"}
          </Button>
        </ModalFooter>
      }
    >
      <div className="mt-2 flex flex-col gap-3.5">
        {error ? <Alert variant="error">{error}</Alert> : null}

        {usage === null ? (
          <Skeleton className="h-10 w-full" />
        ) : total > 0 ? (
          <>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Esta categoria tem <strong className="text-foreground">{total}</strong> lançamento(s).
              Para excluí-la, os lançamentos precisam ser movidos para outra categoria do mesmo tipo.
            </p>
            <FormField label="Mover lançamentos para">
              <Select
                value={migrateTo}
                onValueChange={setMigrateTo}
                options={siblings.map((sibling) => ({ value: sibling.id, label: sibling.name }))}
                placeholder="Selecione a categoria"
                ariaLabel="Categoria de destino da migração"
              />
            </FormField>
          </>
        ) : (
          <p className="text-sm text-muted-foreground leading-relaxed">
            Esta categoria não tem lançamentos — pode ser excluída diretamente.
          </p>
        )}
      </div>
    </Modal>
  );
}

/** Exclusão de categoria com migração opcional (§3.5.1 — RPC delete_category_migrate). */
export function DeleteCategoryDialog({
  category,
  siblings,
  usage,
  open,
  onOpenChange,
  onDeleted,
  elevated = true,
}: DeleteCategoryDialogProps) {
  if (!open) return null;

  return (
    <DeleteCategoryContent
      key={category.id}
      category={category}
      siblings={siblings}
      usage={usage}
      open={open}
      onOpenChange={onOpenChange}
      onDeleted={onDeleted}
      elevated={elevated}
    />
  );
}
