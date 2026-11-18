import { ConfirmDialog } from "@/components/ui";

export interface ShareGoalConfirmDialogsProps {
  isRevokeOpen: boolean;
  onRevokeOpenChange: (open: boolean) => void;
  onConfirmRevoke: () => void;
  isRegenerateOpen: boolean;
  onRegenerateOpenChange: (open: boolean) => void;
  onConfirmRegenerate: () => void;
  isDeleteOpen: boolean;
  onDeleteOpenChange: (open: boolean) => void;
  onConfirmDelete: () => void;
  isPending: boolean;
}

export function ShareGoalConfirmDialogs({
  isRevokeOpen,
  onRevokeOpenChange,
  onConfirmRevoke,
  isRegenerateOpen,
  onRegenerateOpenChange,
  onConfirmRegenerate,
  isDeleteOpen,
  onDeleteOpenChange,
  onConfirmDelete,
  isPending,
}: ShareGoalConfirmDialogsProps) {
  return (
    <>
      <ConfirmDialog
        open={isRevokeOpen}
        onOpenChange={onRevokeOpenChange}
        title="Pausar Link do Termômetro"
        description="Esta ação pausa temporariamente o acesso público à página desta meta."
        cancelLabel="Manter ativo"
        confirmLabel={isPending ? "Pausando…" : "Pausar link"}
        variant="destructive"
        confirmPending={isPending}
        elevated
        onConfirm={onConfirmRevoke}
      >
        <p className="text-xs text-muted-foreground">
          Os participantes não conseguirão mais consultar o progresso ou a chave Pix por este endereço. Você poderá reativar o link público a qualquer momento sem perder seus dados.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={isRegenerateOpen}
        onOpenChange={onRegenerateOpenChange}
        title="Regenerar Link do Termômetro"
        description="Um novo link público será gerado e o link anterior deixará de funcionar."
        cancelLabel="Cancelar"
        confirmLabel={isPending ? "Regenerando…" : "Regenerar e copiar"}
        confirmPending={isPending}
        elevated
        onConfirm={onConfirmRegenerate}
      >
        <p className="text-xs text-muted-foreground">
          Recomendado caso você tenha compartilhado o link por engano com pessoas não autorizadas.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={onDeleteOpenChange}
        title="Excluir Meta de Arrecadação?"
        description="Esta ação excluirá permanentemente a meta de arrecadação, o link público e todas as contribuições registradas. Esta ação não poderá ser desfeita."
        confirmLabel={isPending ? "Excluindo…" : "Excluir Meta"}
        variant="destructive"
        confirmPending={isPending}
        elevated
        onConfirm={onConfirmDelete}
      />
    </>
  );
}
