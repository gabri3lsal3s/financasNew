import { useId, useState } from "react";
import { Trash2 } from "lucide-react";
import { Alert, Button, Modal, ModalFooter } from "@/components/ui";
import type { Category, CategoryType } from "@/types";
import { CategoryFormFields } from "./category-form-fields";
import { DeleteCategoryDialog } from "./delete-category-dialog";
import { useCategoryForm } from "./use-category-form";

export interface CategoryFormDialogProps {
  /** Categoria em edição; `null` = criação. */
  category: Category | null;
  /** Tipo pré-selecionado (criação). */
  defaultType: CategoryType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Irmãs de mesmo tipo (destinos de migração na exclusão). Obrigatório em edição. */
  siblings?: Category[];
  /** Uso atual da categoria (lançamentos vinculados). Obrigatório em edição. */
  usage?: { expenses: number; incomes: number } | null;
  /** Z-index elevado para sobreposição segura em outro modal. */
  elevated?: boolean;
  /** Callback opcional chamado quando uma categoria for criada ou atualizada. */
  onSuccess?: (category: Category) => void;
}

interface CategoryFormContentProps {
  category: Category | null;
  defaultType: CategoryType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siblings?: Category[];
  onOpenDelete?: () => void;
  elevated: boolean;
  onSuccess?: (category: Category) => void;
}

function CategoryFormContent({
  category,
  defaultType,
  open,
  onOpenChange,
  siblings,
  onOpenDelete,
  elevated,
  onSuccess,
}: CategoryFormContentProps) {
  const formId = useId();
  const state = useCategoryForm({
    category,
    defaultType,
    onClose: () => onOpenChange(false),
    onSuccess,
  });

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={category ? "Editar categoria" : "Nova categoria"}
        description={
          category ? undefined : "A sugestão inteligente infere ícone, cor e limite por nome."
        }
        size="md"
        elevated={elevated}
        confirmDiscard
        isDirty={state.isDirty}
        discardTitle="Descartar alterações da categoria?"
        discardDescription="Você possui informações modificadas no formulário. Se sair agora, as alterações serão descartadas."
        footer={
          <ModalFooter
            borderless
            destructiveAction={
              category && siblings !== undefined ? (
                <Button
                  type="button"
                  variant="ghost"
                  sensoryIntent="selection"
                  className="text-critical-strong hover:bg-critical/10 gap-1.5"
                  onClick={() => state.guardAction(() => onOpenDelete?.(), "Excluir Categoria")}
                  disabled={state.pending}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Excluir
                </Button>
              ) : null
            }
          >
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={state.pending}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form={formId}
              sensoryIntent={false}
              aria-label={category ? "Salvar alterações" : "Criar categoria"}
              disabled={state.name.trim() === "" || state.pending}
            >
              {state.pending ? (
                "Salvando…"
              ) : (
                <>
                  <span className="hidden sm:inline">{category ? "Salvar alterações" : "Criar categoria"}</span>
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
            if (state.name.trim() !== "" && !state.pending) void state.handleSubmit();
          }}
          className="mt-2 flex flex-col gap-3.5"
        >
          {state.error ? <Alert variant="error">{state.error}</Alert> : null}

          <CategoryFormFields
            isEditing={Boolean(category)}
            name={state.name}
            onNameChange={state.handleNameChange}
            type={state.type}
            onTypeChange={state.setType}
            icon={state.icon}
            onIconChange={state.setIcon}
            color={state.color}
            onColorChange={state.setColor}
            isFamilyActive={state.isFamilyActive}
            isFamily={state.isFamily}
            onIsFamilyChange={state.setIsFamily}
          />
        </form>
      </Modal>
      {state.upgradeModal}
    </>
  );
}

/** Formulário de categoria (CRUD §3.5.1) com sugestão inteligente por nome. */
export function CategoryFormDialog({
  category,
  defaultType,
  open,
  onOpenChange,
  siblings,
  usage,
  elevated = false,
  onSuccess,
}: CategoryFormDialogProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!open) return null;

  return (
    <>
      <CategoryFormContent
        key={category?.id ?? "new-category"}
        category={category}
        defaultType={defaultType}
        open={open}
        onOpenChange={onOpenChange}
        siblings={siblings}
        onOpenDelete={() => setDeleteOpen(true)}
        elevated={elevated}
        onSuccess={onSuccess}
      />

      {category && siblings !== undefined ? (
        <DeleteCategoryDialog
          category={category}
          siblings={siblings}
          usage={usage ?? null}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          elevated
          onDeleted={() => onOpenChange(false)}
        />
      ) : null}
    </>
  );
}
